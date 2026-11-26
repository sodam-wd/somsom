import { describe, expect, it } from 'vitest';
import { createDefaultPhoto, createDefaultScene, PHOTO_ASSET_ID } from '../types/scene';
import { DUPLICATE_OFFSET, HISTORY_LIMIT, createSceneStore, findLayer, normalizeHex } from './store';

function setup() {
  return createSceneStore();
}

describe('sceneStore basics', () => {
  it('adds layers on top with normalized z and selects the new layer', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    const b = s.addLayer('snowman', 'A004', { x: 100, y: 200 });
    const st = s.getState();
    expect(st.scene.snowman.map((l) => l.z)).toEqual([0, 1]);
    expect(findLayer(st.scene, b)?.layer).toMatchObject({ x: 100, y: 200, assetId: 'A004', z: 1, tint: null });
    expect(findLayer(st.scene, a)?.target).toBe('snowman');
    expect(st.selectedId).toBe(b);
  });

  it('keeps snowman and world separate', () => {
    const s = setup();
    const w = s.addLayer('world', 'A048');
    expect(findLayer(s.getState().scene, w)?.target).toBe('world');
    expect(s.getState().scene.snowman).toHaveLength(0);
  });

  it('updates only the target layer immutably', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    const b = s.addLayer('snowman', 'A002');
    const before = s.getState().scene;
    const bBefore = findLayer(before, b)!.layer;
    s.updateLayer(a, { x: 10, rotation: 45, flipX: true });
    const after = s.getState().scene;
    expect(after).not.toBe(before);
    expect(findLayer(after, a)!.layer).toMatchObject({ x: 10, rotation: 45, flipX: true });
    expect(findLayer(after, b)!.layer).toBe(bBefore);
    expect(findLayer(before, a)!.layer.x).toBe(500);
  });

  it('ignores id changes in patches and no-op updates do not record history', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    s.updateLayer(a, { id: 'hack' } as never);
    expect(findLayer(s.getState().scene, a)).not.toBeNull();
    s.undo(); // undo add
    expect(s.getState().scene.snowman).toHaveLength(0);
  });

  it('removes layers and clears selection', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    s.addLayer('snowman', 'A002');
    s.select(a);
    s.removeLayer(a);
    const st = s.getState();
    expect(st.scene.snowman).toHaveLength(1);
    expect(st.scene.snowman[0].z).toBe(0);
    expect(st.selectedId).toBeNull();
  });

  it('duplicates with offset on top', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A017', { x: 300, y: 300, tint: '#BD716B' });
    s.addLayer('snowman', 'A004');
    const c = s.duplicateLayer(a)!;
    const st = s.getState();
    const copy = findLayer(st.scene, c)!.layer;
    expect(copy.id).not.toBe(a);
    expect(copy).toMatchObject({ assetId: 'A017', x: 300 + DUPLICATE_OFFSET, y: 300 + DUPLICATE_OFFSET, z: 2, tint: '#bd716b' });
    expect(st.selectedId).toBe(c);
    expect(s.duplicateLayer('missing')).toBeNull();
  });

  it('moves layers in z order', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    const b = s.addLayer('snowman', 'A002');
    const c = s.addLayer('snowman', 'A003');
    const order = () => [...s.getState().scene.snowman].sort((x, y) => x.z - y.z).map((l) => l.id);
    s.moveLayerZ(a, 'up');
    expect(order()).toEqual([b, a, c]);
    s.moveLayerZ(a, 'top');
    expect(order()).toEqual([b, c, a]);
    s.moveLayerZ(a, 'bottom');
    expect(order()).toEqual([a, b, c]);
    s.moveLayerZ(c, 'down');
    expect(order()).toEqual([a, c, b]);
    const zs = s.getState().scene.snowman.map((l) => l.z).sort();
    expect(zs).toEqual([0, 1, 2]);
  });

  it('applies independent tint per layer and null restores original', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A017');
    const b = s.addLayer('snowman', 'A017');
    s.setTint(a, '#AAB8A0');
    expect(findLayer(s.getState().scene, a)!.layer.tint).toBe('#aab8a0');
    expect(findLayer(s.getState().scene, b)!.layer.tint).toBeNull();
    s.setTint(a, 'not-a-color');
    expect(findLayer(s.getState().scene, a)!.layer.tint).toBe('#aab8a0');
    s.setTint(a, null);
    expect(findLayer(s.getState().scene, a)!.layer.tint).toBeNull();
  });

  it('adds photo layers to snowman and updates photo', () => {
    const s = setup();
    const photo = createDefaultPhoto('data:image/png;base64,AAA', 400, 300);
    const p = s.addPhotoLayer(photo);
    const layer = findLayer(s.getState().scene, p)!;
    expect(layer.target).toBe('snowman');
    expect(layer.layer.assetId).toBe(PHOTO_ASSET_ID);
    s.updatePhoto(p, { saturation: 1.5 });
    const updated = findLayer(s.getState().scene, p)!.layer.photo!;
    expect(updated.saturation).toBe(1.5);
    expect(updated.crop).toEqual(photo.crop);
    expect(photo.saturation).toBe(1);
  });

  it('setStage and select do not record history', () => {
    const s = setup();
    s.setStage('dress');
    const a = s.addLayer('snowman', 'A001');
    s.select(null);
    s.select(a);
    s.setStage('build');
    expect(s.getState().canUndo).toBe(true);
    s.undo();
    expect(s.getState().scene.snowman).toHaveLength(0);
    expect(s.getState().scene.stage).toBe('build');
    expect(s.getState().canUndo).toBe(false);
  });

  it('select ignores unknown ids', () => {
    const s = setup();
    s.select('nope');
    expect(s.getState().selectedId).toBeNull();
  });

  it('scene-level setters record history', () => {
    const s = setup();
    s.setContainer('arch');
    s.setBase('A063');
    s.setBaseColor('#BD716B');
    s.setBaseColor('nope'); // 무시
    s.setProfile({ name: '몽실' });
    s.setProfile({ name: '몽실' }); // no-op
    s.setCameraPlacement({ shadow: 0.2 });
    s.setBackground('inner', { kind: 'preset', presetId: 'BG01', x: 500, y: 500, scale: 1, rotation: 0 });
    const sc = s.getState().scene;
    expect(sc.containerId).toBe('arch');
    expect(sc.baseColor).toBe('#bd716b');
    expect(sc.baseId).toBe('A063');
    expect(sc.profile.name).toBe('몽실');
    expect(sc.cameraPlacement.shadow).toBe(0.2);
    expect(sc.innerBackground.kind).toBe('preset');
    expect(sc.outerBackground.kind).toBe('none');
    for (let i = 0; i < 6; i++) s.undo();
    expect(s.getState().scene).toMatchObject({ containerId: 'round', baseId: 'A062', profile: { name: '' } });
    expect(s.getState().scene.baseColor).toBeUndefined();
    expect(s.getState().canUndo).toBe(false);
  });
});

describe('history', () => {
  it('undo/redo restores states and new change clears redo', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    s.updateLayer(a, { x: 1 });
    s.updateLayer(a, { x: 2 });
    s.undo();
    expect(findLayer(s.getState().scene, a)!.layer.x).toBe(1);
    expect(s.getState().canRedo).toBe(true);
    s.redo();
    expect(findLayer(s.getState().scene, a)!.layer.x).toBe(2);
    s.undo();
    s.updateLayer(a, { x: 3 });
    expect(s.getState().canRedo).toBe(false);
    s.undo(); // x3 -> x1
    s.undo(); // x1 -> 500
    s.undo(); // remove add
    expect(s.getState().scene.snowman).toHaveLength(0);
  });

  it('undo of add clears selection of removed layer', () => {
    const s = setup();
    s.addLayer('snowman', 'A001');
    s.undo();
    expect(s.getState().selectedId).toBeNull();
  });

  it('merges a gesture into one undo step', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    s.beginGesture();
    for (let i = 1; i <= 20; i++) s.updateLayer(a, { x: 500 + i, rotation: i });
    s.endGesture();
    expect(findLayer(s.getState().scene, a)!.layer).toMatchObject({ x: 520, rotation: 20 });
    s.undo();
    expect(findLayer(s.getState().scene, a)!.layer).toMatchObject({ x: 500, rotation: 0 });
    s.redo();
    expect(findLayer(s.getState().scene, a)!.layer.x).toBe(520);
  });

  it('nested gestures merge and empty gestures leave no history', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    s.beginGesture();
    s.endGesture();
    s.beginGesture();
    s.beginGesture();
    s.updateLayer(a, { x: 1 });
    s.endGesture();
    s.updateLayer(a, { x: 2 });
    s.endGesture();
    s.undo();
    expect(findLayer(s.getState().scene, a)!.layer.x).toBe(500);
    s.undo();
    expect(s.getState().scene.snowman).toHaveLength(0);
    expect(s.getState().canUndo).toBe(false);
  });

  it('gesture returning to the same scene leaves no history entry', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    const base = s.getState().scene;
    s.beginGesture();
    s.updateLayer(a, { x: 600 });
    s.undo(); // undo during gesture ends it first
    expect(s.getState().scene).toBe(base);
  });

  it('caps history length', () => {
    const s = setup();
    const a = s.addLayer('snowman', 'A001');
    for (let i = 0; i < HISTORY_LIMIT + 30; i++) s.updateLayer(a, { x: i });
    let n = 0;
    while (s.getState().canUndo) {
      s.undo();
      n++;
    }
    expect(n).toBe(HISTORY_LIMIT);
  });

  it('loadScene replaces scene, normalizes z, and clears history', () => {
    const s = setup();
    s.addLayer('snowman', 'A001');
    const scene = createDefaultScene();
    scene.snowman = [
      { id: 'x', assetId: 'A001', x: 1, y: 1, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, z: 7, tint: null, visible: true },
      { id: 'y', assetId: 'A002', x: 1, y: 1, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, z: 3, tint: null, visible: true },
    ];
    s.loadScene(scene);
    const st = s.getState();
    expect(st.canUndo).toBe(false);
    expect(st.canRedo).toBe(false);
    expect(st.selectedId).toBeNull();
    expect(st.scene.snowman.map((l) => [l.id, l.z])).toEqual([['y', 0], ['x', 1]]);
    s.reset();
    expect(s.getState().scene.snowman).toHaveLength(0);
  });

  it('notifies subscribers and unsubscribes', () => {
    const s = setup();
    let n = 0;
    const off = s.subscribe(() => n++);
    s.addLayer('snowman', 'A001');
    expect(n).toBeGreaterThan(0);
    off();
    const m = n;
    s.addLayer('snowman', 'A002');
    expect(n).toBe(m);
  });
});

describe('normalizeHex', () => {
  it('normalizes colors', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizeHex('red')).toBeUndefined();
  });
});
