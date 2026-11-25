// ─────────────────────────────────────────────────────────────
// T0 모듈 호출 계약 (리더 소유). 각 담당자는 아래 이름/시그니처를
// 그대로 export 한다. 변경 필요 시 리더에게 요청.
// ─────────────────────────────────────────────────────────────
import type {
  Background, BaseId, CameraPlacement, ContainerId, Layer, LayerTarget,
  Photo, Profile, Result, Scene, Stage,
} from './scene';

// ── editor-engine: src/editor/index.ts ───────────────────────
export interface EditorState {
  scene: Scene;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export type ZMove = 'up' | 'down' | 'top' | 'bottom';

/**
 * 모든 변경 메서드는 기본적으로 history 1단계를 기록한다.
 * 연속 제스처(드래그/핀치/슬라이더)는 beginGesture() → update…(…) → endGesture()
 * 로 감싸면 하나의 undo 단계로 합쳐진다.
 */
export interface SceneStore {
  getState(): EditorState;
  subscribe(listener: () => void): () => void;

  setStage(stage: Stage): void; // history 미기록
  select(id: string | null): void; // history 미기록

  addLayer(target: LayerTarget, assetId: string, init?: Partial<Layer>): string;
  addPhotoLayer(photo: Photo, init?: Partial<Layer>): string; // snowman 대상
  updateLayer(id: string, patch: Partial<Layer>): void;
  updatePhoto(id: string, patch: Partial<Photo>): void;
  removeLayer(id: string): void;
  duplicateLayer(id: string): string | null;
  moveLayerZ(id: string, move: ZMove): void;
  setTint(id: string, color: string | null): void;

  setContainer(id: ContainerId): void;
  setBase(id: BaseId): void;
  setBackground(which: 'inner' | 'outer', bg: Background): void;
  setProfile(patch: Partial<Profile>): void;
  setCameraPlacement(patch: Partial<CameraPlacement>): void;

  beginGesture(): void;
  endGesture(): void;
  undo(): void;
  redo(): void;

  /** 검증된 장면으로 교체 (history 초기화) */
  loadScene(scene: Scene): void;
  reset(): void;
}

/*
 editor-engine export 목록 (src/editor/index.ts):
   export const sceneStore: SceneStore;
   export function useEditor<T>(selector: (s: EditorState) => T): T;
   export function findLayer(scene: Scene, id: string): { layer: Layer; target: LayerTarget } | null;

   // 편집 캔버스: 선택/이동(1손가락·마우스), 핀치 크기·2손가락 회전, 핸들,
   // 캔버스 확대(보기) 모드와 객체 변형 모드 분리, touch-action 제어
   export function EditorCanvas(props: EditorCanvasProps): JSX.Element;

   // Roll 단계: 드래그 거리 기반 눈덩이 성장 + 즉시 추가
   export function RollCanvas(props: RollCanvasProps): JSX.Element;

 render export 목록 (src/render/index.ts):
   export function renderSnowman(scene: Scene, opts: SnowmanRenderOptions): Promise<HTMLCanvasElement>;
   export function renderSnowGlobe(scene: Scene, opts: GlobeRenderOptions): Promise<HTMLCanvasElement>;
   export function renderCertificate(scene: Scene, opts: CertificateRenderOptions): Promise<HTMLCanvasElement>;
   export function SnowGlobeView(props: SnowGlobeViewProps): JSX.Element; // 흔들기 눈 입자, 유리 클립
   export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob>;
   export function downloadBlob(blob: Blob, filename: string): void;
   export function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'>;
   export function serializeScene(scene: Scene): string;
   export function parseScene(text: string): Result<Scene>; // version/schema 검증
   export function renderPhoto(photo: Photo, size: number): Promise<HTMLCanvasElement>; // 마스크/보정/양모 텍스처

 studio-qa export 목록 (src/studio/index.ts):
   export function loadPhotoFile(file: File, opts?: PhotoLoadOptions): Promise<Result<Photo>>;
   export function PhotoAdjustPanel(props: PhotoAdjustPanelProps): JSX.Element; // crop/채도/밝기/대비/경계/질감
   export function BackgroundEditor(props: BackgroundEditorProps): JSX.Element; // inner/outer 독립
   export function StudioStage(props: StudioStageProps): JSX.Element; // Keep: Studio/Photo/Live/Clear
*/

export interface EditorCanvasProps {
  target: LayerTarget;
  /** world 편집 시 유리 용기·받침대를 함께 그려 위치 가늠 */
  showContainer?: boolean;
  className?: string;
  /** 객체를 놓을 수 있는 드롭 지원 (PC 드래그 앤 드롭) */
  onDropAsset?: (assetId: string, x: number, y: number) => void;
}

export interface RollCanvasProps {
  /** 눈덩이를 완성해 장면에 추가했을 때 */
  onAdded?: (layerId: string) => void;
  className?: string;
}

export interface SnowmanRenderOptions {
  /** 출력 정사각 픽셀 (1080 | 2048 제안) */
  size: number;
}

export interface GlobeRenderOptions {
  width: number;
  height: number;
  /** 외부 배경 포함 여부 (false면 투명) */
  includeOuterBackground: boolean;
  /** 0..1 입자 시간 (정지 이미지면 생략) */
  particleTime?: number;
}

export interface CertificateRenderOptions {
  width: number;
  height: number;
}

export interface SnowGlobeViewProps {
  className?: string;
  /** 흔들기 트리거 카운터 — 값이 바뀌면 눈이 흩날림 */
  shakeKey?: number;
  includeOuterBackground?: boolean;
  /** 세계(world) 편집 모드 — EditorCanvas 대신 미리보기만 할 때 false */
  interactive?: boolean;
}

export interface PhotoLoadOptions {
  /** 기본 15MB */
  maxBytes?: number;
  /** decode 후 긴 변 최대 px, 기본 2048 */
  maxDimension?: number;
}

export interface PhotoAdjustPanelProps {
  photo: Photo;
  onChange: (patch: Partial<Photo>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

export interface BackgroundEditorProps {
  which: 'inner' | 'outer';
}

export type StudioMode = 'studio' | 'photo' | 'live' | 'clear';

export interface StudioStageProps {
  mode: StudioMode;
  className?: string;
  /** 촬영 결과 PNG */
  onCapture?: (blob: Blob) => void;
}

export type { Result };
