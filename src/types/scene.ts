// ─────────────────────────────────────────────────────────────
// T0 공통 계약 (리더 소유). 변경이 필요하면 리더에게 요청한다.
// 좌표는 고정 논리 캔버스 단위(LOGICAL_SIZE)를 사용하며
// 화면 CSS 배율 및 출력 해상도와 분리한다.
// ─────────────────────────────────────────────────────────────

export const SCENE_VERSION = 1 as const;

/** 정사각 논리 캔버스 한 변의 크기 (snowman/world 공통). */
export const LOGICAL_SIZE = 1000;

/** Welcome → Roll → Dress → Build → Born → Keep */
export type Stage = 'welcome' | 'roll' | 'dress' | 'build' | 'born' | 'keep';
export const STAGES: readonly Stage[] = ['welcome', 'roll', 'dress', 'build', 'born', 'keep'];

export type LayerTarget = 'snowman' | 'world';

export interface PhotoCrop {
  /** 원본 이미지 픽셀 단위 사각형 */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Photo {
  /** 로컬 decode 후 저장된 data URL (외부 통신 금지) */
  dataUrl: string;
  crop: PhotoCrop;
  /** 0..2, 1 = 원본 */
  saturation: number;
  /** 0..2, 1 = 원본 */
  brightness: number;
  /** 0..2, 1 = 원본 */
  contrast: number;
  /** 0..1 부드러운 마스크 경계 */
  feather: number;
  /** 0..1 양모 텍스처 합성 강도 */
  textureStrength: number;
}

export interface Layer {
  id: string;
  /** manifest id (예: 'A017'). 사진 레이어는 PHOTO_ASSET_ID */
  assetId: string;
  /** 논리 좌표 (레이어 중심) */
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** degrees */
  rotation: number;
  flipX: boolean;
  /** 같은 배열 내 쌓임 순서. 큰 값이 위. */
  z: number;
  /** null = 원본 색상. '#rrggbb' = 밝기/섬유 질감 보존 tint */
  tint: string | null;
  visible: boolean;
  photo?: Photo;
}

/** 얼굴 사진 레이어의 assetId */
export const PHOTO_ASSET_ID = 'photo';

/** 레이어 scale 1 일 때 논리 캔버스상의 기본 그리기 크기(긴 변). */
export const LAYER_BASE_SIZE = 200;

export type BackgroundKind = 'none' | 'preset' | 'photo';

export interface Background {
  kind: BackgroundKind;
  /** kind==='preset' 일 때 manifest id (BG01..BG04, 제안 상태) */
  presetId?: string;
  /** kind==='photo' 일 때 */
  photo?: Photo;
  /** 배경 자체 변형 (논리 단위, 중심 기준) */
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface Profile {
  name: string;
  /** YYYY-MM-DD */
  birthDate: string;
  traits: string[];
  likes: string[];
  bio: string;
}

/** Keep 단계 카메라/사진 합성 시 작품 배치 (2D 합성, 공간 추적 없음) */
export interface CameraPlacement {
  /** 0..1 화면 비율 기준 중심 */
  x: number;
  y: number;
  scale: number;
  /** 0..1 */
  shadow: number;
  /** 0..2, 1 = 원본 */
  brightness: number;
}

export type ContainerId = 'round' | 'arch' | 'bottle';
export const CONTAINERS: Record<ContainerId, { back: string; front: string }> = {
  round: { back: 'A056', front: 'A057' },
  arch: { back: 'A058', front: 'A059' },
  bottle: { back: 'A060', front: 'A061' },
};
export type BaseId = 'A062' | 'A063';

export interface Scene {
  version: typeof SCENE_VERSION;
  stage: Stage;
  snowman: Layer[];
  world: Layer[];
  containerId: ContainerId;
  baseId: BaseId;
  /** 스노우볼 내부(유리 안쪽) 배경 */
  innerBackground: Background;
  /** 스노우볼 외부(촬영/전시) 배경 */
  outerBackground: Background;
  profile: Profile;
  cameraPlacement: CameraPlacement;
}

// ── Assets ───────────────────────────────────────────────────
export type AssetGroup = 'decor' | 'ui' | 'brand' | 'background';

export interface AssetEntry {
  id: string;
  /** public/ 기준 경로. 예: 'assets/hat/beanie.png' — 변경 금지 */
  path: string;
  group: AssetGroup;
  category: string;
  name: string;
  width: number;
  height: number;
}

export interface LoadedAsset {
  id: string;
  /** 실제 PNG 또는 임시 Canvas */
  image: HTMLImageElement | HTMLCanvasElement;
  width: number;
  height: number;
  /** true = 실제 PNG 없음 → 임시 에셋 사용 중 (미완료) */
  isPlaceholder: boolean;
  /** UI용 URL (실제 PNG URL 또는 임시 에셋 data URL) */
  url: string;
}

// ── Defaults ─────────────────────────────────────────────────
export function createDefaultBackground(): Background {
  return { kind: 'none', x: LOGICAL_SIZE / 2, y: LOGICAL_SIZE / 2, scale: 1, rotation: 0 };
}

export function createDefaultScene(): Scene {
  return {
    version: SCENE_VERSION,
    stage: 'welcome',
    snowman: [],
    world: [],
    containerId: 'round',
    baseId: 'A062',
    innerBackground: createDefaultBackground(),
    outerBackground: createDefaultBackground(),
    profile: { name: '', birthDate: '', traits: [], likes: [], bio: '' },
    cameraPlacement: { x: 0.5, y: 0.6, scale: 1, shadow: 0.5, brightness: 1 },
  };
}

export function createDefaultPhoto(dataUrl: string, width: number, height: number): Photo {
  const side = Math.min(width, height);
  return {
    dataUrl,
    crop: { x: (width - side) / 2, y: (height - side) / 2, width: side, height: side },
    saturation: 1,
    brightness: 1,
    contrast: 1,
    feather: 0.35,
    textureStrength: 0.4,
  };
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
