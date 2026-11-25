// editor-engine 소유 (T1). 캔버스 보기(확대/이동) 상태 — 객체 변형과 분리.
import { useCallback, useSyncExternalStore } from 'react';
import type { LayerTarget } from '../types/scene';
import { IDENTITY_VIEW, clampView, zoomViewAt, type View } from './transforms';

const views: Record<LayerTarget, View> = { snowman: IDENTITY_VIEW, world: IDENTITY_VIEW };
const cssSizes: Record<LayerTarget, number> = { snowman: 0, world: 0 };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const viewStore = {
  get(target: LayerTarget): View {
    return views[target];
  },
  set(target: LayerTarget, view: View) {
    const size = cssSizes[target];
    const next = size > 0 ? clampView(view, size) : view;
    if (next.zoom === views[target].zoom && next.panX === views[target].panX && next.panY === views[target].panY) return;
    views[target] = next;
    emit();
  },
  /** EditorCanvas가 CSS 크기를 알려줌 (zoom 버튼 중심 계산용) */
  setCssSize(target: LayerTarget, size: number) {
    cssSizes[target] = size;
    if (size > 0) viewStore.set(target, views[target]);
  },
  reset(target: LayerTarget) {
    viewStore.set(target, IDENTITY_VIEW);
  },
  zoomBy(target: LayerTarget, factor: number) {
    const size = cssSizes[target] || 1;
    viewStore.set(target, zoomViewAt(views[target], factor, { x: size / 2, y: size / 2 }, size));
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export interface ViewControls {
  zoom: number;
  isZoomed: boolean;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
}

/** 보기 확대/리셋 버튼용 훅 (workshop-ui). target 별 독립 상태. */
export function useViewControls(target: LayerTarget): ViewControls {
  const zoom = useSyncExternalStore(viewStore.subscribe, () => views[target].zoom, () => 1);
  const zoomIn = useCallback(() => viewStore.zoomBy(target, 1.25), [target]);
  const zoomOut = useCallback(() => viewStore.zoomBy(target, 0.8), [target]);
  const reset = useCallback(() => viewStore.reset(target), [target]);
  return { zoom, isZoomed: zoom > 1.001, zoomIn, zoomOut, reset };
}
