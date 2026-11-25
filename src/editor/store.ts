// editor-engine 소유 (T1). 불변 업데이트 장면 스토어 + history.
import {
  LOGICAL_SIZE, PHOTO_ASSET_ID, createDefaultScene,
  type Background, type BaseId, type CameraPlacement, type ContainerId, type Layer,
  type LayerTarget, type Photo, type Profile, type Scene, type Stage,
} from '../types/scene';
import type { EditorState, SceneStore, ZMove } from '../types/contracts';

export const HISTORY_LIMIT = 100;
/** 복제 시 오프셋 (논리 단위) */
export const DUPLICATE_OFFSET = 24;

let idCounter = 0;
export function createLayerId(): string {
  idCounter += 1;
  const rnd = Math.floor(Math.random() * 0x10000).toString(36);
  return `L${Date.now().toString(36)}${idCounter.toString(36)}${rnd}`;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;
/** '#rgb' / '#rrggbb' → '#rrggbb' (소문자). 잘못된 값은 undefined. */
export function normalizeHex(color: string): string | undefined {
  const c = color.trim();
  if (HEX_RE.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  }
  return undefined;
}

export function findLayer(scene: Scene, id: string): { layer: Layer; target: LayerTarget } | null {
  for (const target of ['snowman', 'world'] as const) {
    const layer = scene[target].find((l) => l.id === id);
    if (layer) return { layer, target };
  }
  return null;
}

/** z 오름차순 정렬 후 0..n-1 로 재부여 (변경이 없으면 같은 배열 반환). */
export function normalizeZ(layers: Layer[]): Layer[] {
  const sorted = [...layers].sort((a, b) => a.z - b.z);
  let changed = sorted.some((l, i) => l !== layers[i]);
  const out = sorted.map((l, i) => {
    if (l.z === i) return l;
    changed = true;
    return { ...l, z: i };
  });
  return changed ? out : layers;
}

function clampNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function makeLayer(assetId: string, z: number, init?: Partial<Layer>): Layer {
  const base: Layer = {
    id: createLayerId(),
    assetId,
    x: LOGICAL_SIZE / 2,
    y: LOGICAL_SIZE / 2,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flipX: false,
    z,
    tint: null,
    visible: true,
  };
  const merged: Layer = { ...base, ...init, id: base.id, assetId, z };
  merged.x = clampNum(merged.x, base.x);
  merged.y = clampNum(merged.y, base.y);
  merged.scaleX = clampNum(merged.scaleX, 1);
  merged.scaleY = clampNum(merged.scaleY, 1);
  merged.rotation = clampNum(merged.rotation, 0);
  if (merged.tint != null) merged.tint = normalizeHex(merged.tint) ?? null;
  return merged;
}

function shallowSame<T extends object>(base: T, patch: Partial<T>): boolean {
  return (Object.keys(patch) as (keyof T)[]).every((k) => base[k] === patch[k]);
}

export function createSceneStore(initial: Scene = createDefaultScene()): SceneStore {
  let scene: Scene = initial;
  let selectedId: string | null = null;
  let past: Scene[] = [];
  let future: Scene[] = [];
  let gestureDepth = 0;
  let gestureBase: Scene | null = null;
  let gesturePushed = false;
  let state: EditorState = { scene, selectedId, canUndo: false, canRedo: false };
  const listeners = new Set<() => void>();

  function emit() {
    const next: EditorState = {
      scene,
      selectedId,
      canUndo: past.length > 0 || gesturePushed,
      canRedo: future.length > 0,
    };
    if (
      next.scene === state.scene && next.selectedId === state.selectedId &&
      next.canUndo === state.canUndo && next.canRedo === state.canRedo
    ) return;
    state = next;
    listeners.forEach((l) => l());
  }

  function pushPast(s: Scene) {
    past.push(s);
    if (past.length > HISTORY_LIMIT) past = past.slice(past.length - HISTORY_LIMIT);
  }

  /** history 기록 변경 */
  function commit(next: Scene) {
    if (next === scene) return;
    if (gestureDepth > 0) {
      if (!gesturePushed && gestureBase) {
        pushPast(gestureBase);
        gesturePushed = true;
      }
      future = [];
    } else {
      pushPast(scene);
      future = [];
    }
    scene = next;
    if (selectedId && !findLayer(scene, selectedId)) selectedId = null;
    emit();
  }

  function mapLayer(id: string, fn: (l: Layer) => Layer): Scene | null {
    const found = findLayer(scene, id);
    if (!found) return null;
    const { target, layer } = found;
    const updated = fn(layer);
    if (updated === layer) return scene;
    const arr = scene[target].map((l) => (l.id === id ? updated : l));
    return { ...scene, [target]: normalizeZ(arr) };
  }

  function forceEndGesture() {
    gestureDepth = 0;
    gestureBase = null;
    gesturePushed = false;
  }

  const store: SceneStore = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setStage(stage: Stage) {
      if (scene.stage === stage) return;
      scene = { ...scene, stage };
      emit();
    },
    select(id) {
      const next = id && findLayer(scene, id) ? id : null;
      if (next === selectedId) return;
      selectedId = next;
      emit();
    },

    addLayer(target, assetId, init) {
      const arr = scene[target];
      const z = arr.length ? Math.max(...arr.map((l) => l.z)) + 1 : 0;
      const layer = makeLayer(assetId, z, init);
      if (assetId !== PHOTO_ASSET_ID) delete layer.photo;
      commit({ ...scene, [target]: normalizeZ([...arr, layer]) });
      selectedId = layer.id;
      emit();
      return layer.id;
    },
    addPhotoLayer(photo: Photo, init) {
      return store.addLayer('snowman', PHOTO_ASSET_ID, { ...init, photo });
    },
    updateLayer(id, patch) {
      const next = mapLayer(id, (l) => {
        const merged: Layer = { ...l, ...patch, id: l.id };
        if (patch.tint !== undefined) merged.tint = patch.tint === null ? null : normalizeHex(patch.tint) ?? l.tint;
        const keys = Object.keys(patch) as (keyof Layer)[];
        if (keys.every((k) => merged[k] === l[k])) return l;
        return merged;
      });
      if (next) commit(next);
    },
    updatePhoto(id, patch) {
      const next = mapLayer(id, (l) => {
        if (!l.photo) return l;
        return { ...l, photo: { ...l.photo, ...patch, crop: { ...l.photo.crop, ...patch.crop } } };
      });
      if (next) commit(next);
    },
    removeLayer(id) {
      const found = findLayer(scene, id);
      if (!found) return;
      const arr = scene[found.target].filter((l) => l.id !== id);
      commit({ ...scene, [found.target]: normalizeZ(arr) });
    },
    duplicateLayer(id) {
      const found = findLayer(scene, id);
      if (!found) return null;
      const { layer, target } = found;
      const arr = scene[target];
      const z = Math.max(...arr.map((l) => l.z)) + 1;
      const copy: Layer = {
        ...layer,
        id: createLayerId(),
        x: layer.x + DUPLICATE_OFFSET,
        y: layer.y + DUPLICATE_OFFSET,
        z,
      };
      if (layer.photo) copy.photo = { ...layer.photo, crop: { ...layer.photo.crop } };
      commit({ ...scene, [target]: normalizeZ([...arr, copy]) });
      selectedId = copy.id;
      emit();
      return copy.id;
    },
    moveLayerZ(id, move: ZMove) {
      const found = findLayer(scene, id);
      if (!found) return;
      const arr = [...scene[found.target]].sort((a, b) => a.z - b.z);
      const i = arr.findIndex((l) => l.id === id);
      const [item] = arr.splice(i, 1);
      let j = i;
      if (move === 'up') j = Math.min(arr.length, i + 1);
      else if (move === 'down') j = Math.max(0, i - 1);
      else if (move === 'top') j = arr.length;
      else j = 0;
      if (j === i) return;
      arr.splice(j, 0, item);
      const renum = arr.map((l, k) => (l.z === k ? l : { ...l, z: k }));
      commit({ ...scene, [found.target]: renum });
    },
    setTint(id, color) {
      if (color !== null && normalizeHex(color) === undefined) return;
      store.updateLayer(id, { tint: color });
    },

    setContainer(id: ContainerId) {
      if (scene.containerId !== id) commit({ ...scene, containerId: id });
    },
    setBase(id: BaseId) {
      if (scene.baseId !== id) commit({ ...scene, baseId: id });
    },
    setBackground(which, bg: Background) {
      const key = which === 'inner' ? 'innerBackground' : 'outerBackground';
      if (scene[key] !== bg) commit({ ...scene, [key]: bg });
    },
    setProfile(patch: Partial<Profile>) {
      if (shallowSame(scene.profile, patch)) return;
      commit({ ...scene, profile: { ...scene.profile, ...patch } });
    },
    setCameraPlacement(patch: Partial<CameraPlacement>) {
      if (shallowSame(scene.cameraPlacement, patch)) return;
      commit({ ...scene, cameraPlacement: { ...scene.cameraPlacement, ...patch } });
    },

    beginGesture() {
      if (gestureDepth === 0) {
        gestureBase = scene;
        gesturePushed = false;
      }
      gestureDepth += 1;
    },
    endGesture() {
      if (gestureDepth === 0) return;
      gestureDepth -= 1;
      if (gestureDepth === 0) {
        // 제스처 중 실제 변화가 없었다면 기록 제거
        if (gesturePushed && gestureBase === scene) past.pop();
        forceEndGesture();
        emit();
      }
    },
    undo() {
      while (gestureDepth > 0) store.endGesture();
      const prev = past.pop();
      if (!prev) return;
      future.push(scene);
      scene = prev.stage === scene.stage ? prev : { ...prev, stage: scene.stage };
      if (selectedId && !findLayer(scene, selectedId)) selectedId = null;
      emit();
    },
    redo() {
      while (gestureDepth > 0) store.endGesture();
      const next = future.pop();
      if (!next) return;
      pushPast(scene);
      scene = next.stage === scene.stage ? next : { ...next, stage: scene.stage };
      if (selectedId && !findLayer(scene, selectedId)) selectedId = null;
      emit();
    },

    loadScene(next: Scene) {
      forceEndGesture();
      scene = { ...next, snowman: normalizeZ(next.snowman), world: normalizeZ(next.world) };
      past = [];
      future = [];
      selectedId = null;
      emit();
    },
    reset() {
      store.loadScene(createDefaultScene());
    },
  };
  return store;
}
