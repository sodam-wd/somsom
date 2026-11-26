// workshop-ui 소유: 엔진/렌더/스튜디오 모듈 얇은 어댑터.
// contracts.ts 의 시그니처로 타입을 고정하고, 상대 모듈이 아직 export 를 제공하지 않으면
// 안전한 대체(준비 중 안내)를 사용한다. 상대 소유 파일은 수정하지 않는다.
import { createElement, type JSX } from 'react';
import * as editorNs from '../editor';
import * as renderNs from '../render';
import * as studioNs from '../studio';
import type {
  BackgroundEditorProps, CertificateRenderOptions, EditorCanvasProps, EditorState,
  GlobeRenderOptions, PhotoAdjustPanelProps, PhotoLoadOptions, RollCanvasProps, SceneStore,
  SnowGlobeViewProps, SnowmanRenderOptions, StudioStageProps,
} from '../types/contracts';
import {
  createDefaultScene, type Layer, type LayerTarget, type Photo, type Result, type Scene,
} from '../types/scene';

interface EditorModule {
  sceneStore: SceneStore;
  useEditor<T>(selector: (s: EditorState) => T): T;
  findLayer(scene: Scene, id: string): { layer: Layer; target: LayerTarget } | null;
  EditorCanvas(props: EditorCanvasProps): JSX.Element;
  RollCanvas(props: RollCanvasProps): JSX.Element;
}

interface RenderModule {
  renderSnowman(scene: Scene, opts: SnowmanRenderOptions): Promise<HTMLCanvasElement>;
  renderSnowGlobe(scene: Scene, opts: GlobeRenderOptions): Promise<HTMLCanvasElement>;
  renderCertificate(scene: Scene, opts: CertificateRenderOptions): Promise<HTMLCanvasElement>;
  SnowGlobeView(props: SnowGlobeViewProps): JSX.Element;
  canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob>;
  downloadBlob(blob: Blob, filename: string): void;
  shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'>;
  serializeScene(scene: Scene): string;
  parseScene(text: string): Result<Scene>;
}

interface StudioModule {
  loadPhotoFile(file: File, opts?: PhotoLoadOptions): Promise<Result<Photo>>;
  PhotoAdjustPanel(props: PhotoAdjustPanelProps): JSX.Element;
  BackgroundEditor(props: BackgroundEditorProps): JSX.Element;
  StudioStage(props: StudioStageProps): JSX.Element;
}

const ed = editorNs as unknown as Partial<EditorModule>;
const rd = renderNs as unknown as Partial<RenderModule>;
const st = studioNs as unknown as Partial<StudioModule>;

function pending(name: string) {
  return function Pending(): JSX.Element {
    return createElement(
      'div',
      { className: 'pending-module', role: 'status' },
      `${name} 모듈 준비 중 (미구현)`,
    );
  };
}

function notReady(name: string): never {
  throw new Error(`${name} 기능이 아직 연결되지 않았습니다.`);
}

// ── editor ──────────────────────────────────────────────────
const fallbackState: EditorState = { scene: createDefaultScene(), selectedId: null, canUndo: false, canRedo: false };
const noop = () => {};
const fallbackStore: SceneStore = {
  getState: () => fallbackState,
  subscribe: () => noop,
  setStage: noop, select: noop,
  addLayer: () => '', addPhotoLayer: () => '', updateLayer: noop, updatePhoto: noop,
  removeLayer: noop, duplicateLayer: () => null, moveLayerZ: noop, setTint: noop,
  setContainer: noop, setBase: noop, setBaseColor: noop, setBackground: noop, setProfile: noop, setCameraPlacement: noop,
  beginGesture: noop, endGesture: noop, undo: noop, redo: noop, loadScene: noop, reset: noop,
};

export const engineReady = Boolean(ed.sceneStore && ed.useEditor);
export const sceneStore: SceneStore = ed.sceneStore ?? fallbackStore;
export const useEditor: EditorModule['useEditor'] = ed.useEditor ?? ((sel) => sel(fallbackState));
export const findLayer: EditorModule['findLayer'] =
  ed.findLayer ??
  ((scene, id) => {
    for (const target of ['snowman', 'world'] as const) {
      const layer = scene[target].find((l) => l.id === id);
      if (layer) return { layer, target };
    }
    return null;
  });
export const EditorCanvas: EditorModule['EditorCanvas'] = ed.EditorCanvas ?? pending('편집 캔버스');
export const RollCanvas: EditorModule['RollCanvas'] = ed.RollCanvas ?? pending('눈덩이 굴리기');

// ── render ──────────────────────────────────────────────────
export const renderSnowman: RenderModule['renderSnowman'] = (s, o) => (rd.renderSnowman ?? (() => notReady('눈사람 PNG')))(s, o);
export const renderSnowGlobe: RenderModule['renderSnowGlobe'] = (s, o) => (rd.renderSnowGlobe ?? (() => notReady('스노우볼 PNG')))(s, o);
export const renderCertificate: RenderModule['renderCertificate'] = (s, o) =>
  (rd.renderCertificate ?? (() => notReady('증명서 PNG')))(s, o);
export const hasRenderCertificate = () => Boolean(rd.renderCertificate);
export const SnowGlobeView: RenderModule['SnowGlobeView'] = rd.SnowGlobeView ?? pending('스노우볼 미리보기');
export const canvasToBlob: RenderModule['canvasToBlob'] =
  rd.canvasToBlob ??
  ((c) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG 변환 실패'))), 'image/png')));
export const downloadBlob: RenderModule['downloadBlob'] =
  rd.downloadBlob ??
  ((blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
export const shareOrDownload: RenderModule['shareOrDownload'] =
  rd.shareOrDownload ??
  (async (blob, filename) => {
    downloadBlob(blob, filename);
    return 'downloaded';
  });
export const serializeScene: RenderModule['serializeScene'] = rd.serializeScene ?? ((s) => JSON.stringify(s));
export const parseScene: RenderModule['parseScene'] =
  rd.parseScene ?? (() => ({ ok: false, error: '작업 파일 검증 기능이 아직 연결되지 않았습니다.' }));

// ── studio ──────────────────────────────────────────────────
export const loadPhotoFile: StudioModule['loadPhotoFile'] =
  st.loadPhotoFile ?? (async () => ({ ok: false, error: '사진 불러오기 기능이 아직 연결되지 않았습니다.' }));
export const PhotoAdjustPanel: StudioModule['PhotoAdjustPanel'] = st.PhotoAdjustPanel ?? pending('사진 보정');
export const BackgroundEditor: StudioModule['BackgroundEditor'] = st.BackgroundEditor ?? pending('배경 편집');
export const StudioStage: StudioModule['StudioStage'] = st.StudioStage ?? pending('촬영 스튜디오');

export function useSelectedLayer(): { layer: Layer; target: LayerTarget } | null {
  const scene = useEditor((s) => s.scene);
  const id = useEditor((s) => s.selectedId);
  return id ? findLayer(scene, id) : null;
}
