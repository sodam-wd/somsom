// editor-engine 소유 (T1). 작업 JSON 저장/불러오기 (version/schema 전체 검증).
// 실패 시 { ok:false, error } 를 반환하므로 호출 측은 기존 장면을 유지할 수 있다.
import {
  CONTAINERS, SCENE_VERSION, STAGES,
  type Background, type CameraPlacement, type Layer, type Photo, type PhotoCrop, type Profile,
  type Result, type Scene,
} from '../types/scene';

/** 파일 식별자 */
export const SCENE_FILE_KIND = 'somsom-scene';
/** 불러오기 허용 최대 텍스트 크기 (사진 포함 고려) */
export const MAX_SCENE_TEXT = 60 * 1024 * 1024;

export function serializeScene(scene: Scene): string {
  return JSON.stringify({ kind: SCENE_FILE_KIND, ...scene });
}

class SchemaError extends Error {}

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new SchemaError(`${path}: ${msg}`);
}
function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, '객체가 아닙니다');
  return v as Obj;
}
function num(v: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, '숫자가 아닙니다');
  if (v < min || v > max) fail(path, `범위(${min}..${max})를 벗어났습니다`);
  return v;
}
function str(v: unknown, path: string, maxLen = 10_000): string {
  if (typeof v !== 'string') fail(path, '문자열이 아닙니다');
  if (v.length > maxLen) fail(path, '너무 깁니다');
  return v;
}
function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, '참/거짓 값이 아닙니다');
  return v;
}
function strArr(v: unknown, path: string): string[] {
  if (!Array.isArray(v)) fail(path, '배열이 아닙니다');
  if (v.length > 50) fail(path, '항목이 너무 많습니다');
  return v.map((s, i) => str(s, `${path}[${i}]`, 200));
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) fail(path, `허용되지 않은 값입니다`);
  return v as T;
}

const LIMIT = 100_000; // 논리 좌표 허용 범위 (화면 밖 배치 허용)

function parseCrop(v: unknown, path: string): PhotoCrop {
  const o = obj(v, path);
  return {
    x: num(o.x, `${path}.x`, 0, LIMIT),
    y: num(o.y, `${path}.y`, 0, LIMIT),
    width: num(o.width, `${path}.width`, 1, LIMIT),
    height: num(o.height, `${path}.height`, 1, LIMIT),
  };
}

function parsePhoto(v: unknown, path: string): Photo {
  const o = obj(v, path);
  const dataUrl = str(o.dataUrl, `${path}.dataUrl`, MAX_SCENE_TEXT);
  if (!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(dataUrl)) fail(`${path}.dataUrl`, '이미지 data URL 이 아닙니다');
  let mask: string | undefined;
  if (o.mask !== undefined) {
    mask = str(o.mask, `${path}.mask`, MAX_SCENE_TEXT);
    if (!/^data:image\/png;base64,/i.test(mask)) fail(`${path}.mask`, 'PNG data URL 이 아닙니다');
  }
  return {
    ...(mask ? { mask } : {}),
    dataUrl,
    crop: parseCrop(o.crop, `${path}.crop`),
    saturation: num(o.saturation, `${path}.saturation`, 0, 2),
    brightness: num(o.brightness, `${path}.brightness`, 0, 2),
    contrast: num(o.contrast, `${path}.contrast`, 0, 2),
    feather: num(o.feather, `${path}.feather`, 0, 1),
    textureStrength: num(o.textureStrength, `${path}.textureStrength`, 0, 1),
  };
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function parseLayer(v: unknown, path: string): Layer {
  const o = obj(v, path);
  const id = str(o.id, `${path}.id`, 64);
  if (!ID_RE.test(id)) fail(`${path}.id`, '형식이 잘못되었습니다');
  const assetId = str(o.assetId, `${path}.assetId`, 32);
  if (!ID_RE.test(assetId)) fail(`${path}.assetId`, '형식이 잘못되었습니다');
  let tint: string | null = null;
  if (o.tint !== null) {
    const t = str(o.tint, `${path}.tint`, 7);
    if (!HEX_RE.test(t)) fail(`${path}.tint`, '#rrggbb 형식이 아닙니다');
    tint = t.toLowerCase();
  }
  const layer: Layer = {
    id,
    assetId,
    x: num(o.x, `${path}.x`, -LIMIT, LIMIT),
    y: num(o.y, `${path}.y`, -LIMIT, LIMIT),
    scaleX: num(o.scaleX, `${path}.scaleX`, 0.001, 100),
    scaleY: num(o.scaleY, `${path}.scaleY`, 0.001, 100),
    rotation: num(o.rotation, `${path}.rotation`, -LIMIT, LIMIT),
    flipX: bool(o.flipX, `${path}.flipX`),
    z: num(o.z, `${path}.z`, -LIMIT, LIMIT),
    tint,
    visible: bool(o.visible, `${path}.visible`),
  };
  if (assetId === 'photo') {
    layer.photo = parsePhoto(o.photo, `${path}.photo`);
  } else if (o.photo !== undefined) {
    fail(`${path}.photo`, '사진 레이어가 아닌데 사진이 있습니다');
  }
  return layer;
}

function parseLayers(v: unknown, path: string, seen: Set<string>): Layer[] {
  if (!Array.isArray(v)) fail(path, '배열이 아닙니다');
  if (v.length > 500) fail(path, '레이어가 너무 많습니다');
  return v.map((l, i) => {
    const layer = parseLayer(l, `${path}[${i}]`);
    if (seen.has(layer.id)) fail(`${path}[${i}].id`, '중복된 id 입니다');
    seen.add(layer.id);
    return layer;
  });
}

function parseBackground(v: unknown, path: string): Background {
  const o = obj(v, path);
  const kind = oneOf(o.kind, ['none', 'preset', 'photo'] as const, `${path}.kind`);
  const bg: Background = {
    kind,
    x: num(o.x, `${path}.x`, -LIMIT, LIMIT),
    y: num(o.y, `${path}.y`, -LIMIT, LIMIT),
    scale: num(o.scale, `${path}.scale`, 0.01, 100),
    rotation: num(o.rotation, `${path}.rotation`, -LIMIT, LIMIT),
  };
  if (kind === 'preset') {
    const id = str(o.presetId, `${path}.presetId`, 32);
    if (!ID_RE.test(id)) fail(`${path}.presetId`, '형식이 잘못되었습니다');
    bg.presetId = id;
  } else if (o.presetId !== undefined) {
    bg.presetId = str(o.presetId, `${path}.presetId`, 32);
  }
  if (kind === 'photo') bg.photo = parsePhoto(o.photo, `${path}.photo`);
  return bg;
}

function parseProfile(v: unknown, path: string): Profile {
  const o = obj(v, path);
  const birthDate = str(o.birthDate, `${path}.birthDate`, 10);
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) fail(`${path}.birthDate`, 'YYYY-MM-DD 형식이 아닙니다');
  return {
    name: str(o.name, `${path}.name`, 100),
    birthDate,
    traits: strArr(o.traits, `${path}.traits`),
    likes: strArr(o.likes, `${path}.likes`),
    bio: str(o.bio, `${path}.bio`, 2000),
  };
}

function parseCamera(v: unknown, path: string): CameraPlacement {
  const o = obj(v, path);
  return {
    x: num(o.x, `${path}.x`, -10, 10),
    y: num(o.y, `${path}.y`, -10, 10),
    scale: num(o.scale, `${path}.scale`, 0.01, 100),
    shadow: num(o.shadow, `${path}.shadow`, 0, 1),
    brightness: num(o.brightness, `${path}.brightness`, 0, 2),
  };
}

/** JSON 텍스트 → 검증된 Scene. 실패 시 사용자 안내용 오류 메시지. */
export function parseScene(text: string): Result<Scene> {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: '빈 파일입니다.' };
  if (text.length > MAX_SCENE_TEXT) return { ok: false, error: '파일이 너무 큽니다.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON 형식이 올바르지 않습니다.' };
  }
  try {
    const o = obj(raw, 'scene');
    if (o.kind !== undefined && o.kind !== SCENE_FILE_KIND) fail('kind', 'somsom 작업 파일이 아닙니다');
    if (o.version !== SCENE_VERSION) {
      return { ok: false, error: `지원하지 않는 작업 파일 버전입니다 (version ${String(o.version)}).` };
    }
    const seen = new Set<string>();
    const scene: Scene = {
      version: SCENE_VERSION,
      stage: oneOf(o.stage, STAGES, 'stage'),
      snowman: parseLayers(o.snowman, 'snowman', seen),
      world: parseLayers(o.world, 'world', seen),
      containerId: oneOf(o.containerId, Object.keys(CONTAINERS) as (keyof typeof CONTAINERS)[], 'containerId'),
      baseId: oneOf(o.baseId, ['A062', 'A063'] as const, 'baseId'),
      innerBackground: parseBackground(o.innerBackground, 'innerBackground'),
      outerBackground: parseBackground(o.outerBackground, 'outerBackground'),
      profile: parseProfile(o.profile, 'profile'),
      cameraPlacement: parseCamera(o.cameraPlacement, 'cameraPlacement'),
    };
    if (o.baseColor !== undefined && o.baseColor !== null) {
      const t = str(o.baseColor, 'baseColor', 7);
      if (!HEX_RE.test(t)) fail('baseColor', '#rrggbb 형식이 아닙니다');
      scene.baseColor = t.toLowerCase();
    }
    return { ok: true, value: scene };
  } catch (e) {
    if (e instanceof SchemaError) return { ok: false, error: `작업 파일 구조가 올바르지 않습니다 (${e.message}).` };
    return { ok: false, error: '작업 파일을 읽을 수 없습니다.' };
  }
}
