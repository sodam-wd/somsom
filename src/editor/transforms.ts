// editor-engine 소유 (T1). 순수 기하 함수: 레이어 크기·좌표 변환·히트테스트·bbox·보기 변환.
import { LAYER_BASE_SIZE, LOGICAL_SIZE, type Layer } from '../types/scene';

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect { x: number; y: number; width: number; height: number }

/** 에셋 원본 크기 조회 (없으면 정사각 가정). */
export type SizeResolver = (layer: Layer) => Size | null;

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clampScale(s: number): number {
  return clamp(s, MIN_SCALE, MAX_SCALE);
}

/** 각도를 (-180, 180] 범위로 정규화 */
export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

/**
 * 레이어의 논리 그리기 크기. 긴 변 = LAYER_BASE_SIZE, 에셋 종횡비 유지, scaleX/Y 곱.
 */
export function layerDrawSize(layer: Layer, asset: Size | null): Size {
  const aw = asset?.width || 1;
  const ah = asset?.height || 1;
  const long = Math.max(aw, ah);
  return {
    width: (LAYER_BASE_SIZE * aw / long) * Math.abs(layer.scaleX),
    height: (LAYER_BASE_SIZE * ah / long) * Math.abs(layer.scaleY),
  };
}

/** 논리(부모) 좌표 → 레이어 로컬 좌표 (중심 원점, 회전·반전 제거). */
export function toLocal(layer: Layer, p: Point): Point {
  const dx = p.x - layer.x;
  const dy = p.y - layer.y;
  const r = (-layer.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  let x = dx * cos - dy * sin;
  const y = dx * sin + dy * cos;
  if (layer.flipX) x = -x;
  return { x, y };
}

/** 레이어 로컬 좌표 → 논리 좌표. */
export function toParent(layer: Layer, p: Point): Point {
  const lx = layer.flipX ? -p.x : p.x;
  const r = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: layer.x + lx * cos - p.y * sin, y: layer.y + lx * sin + p.y * cos };
}

/** 레이어 사각형의 네 모서리 (논리 좌표, 순서: 좌상, 우상, 우하, 좌하 — 로컬 기준). */
export function layerCorners(layer: Layer, size: Size): Point[] {
  const hw = size.width / 2;
  const hh = size.height / 2;
  return [
    { x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh },
  ].map((p) => toParent(layer, p));
}

export function pointInLayer(layer: Layer, size: Size, p: Point, pad = 0): boolean {
  const l = toLocal(layer, p);
  return Math.abs(l.x) <= size.width / 2 + pad && Math.abs(l.y) <= size.height / 2 + pad;
}

/**
 * 로컬 점 → 에셋 픽셀 좌표 (알파 히트용). 범위 밖이면 null.
 */
export function localToAssetPixel(local: Point, size: Size, asset: Size): Point | null {
  const u = local.x / size.width + 0.5;
  const v = local.y / size.height + 0.5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return {
    x: Math.min(asset.width - 1, Math.floor(u * asset.width)),
    y: Math.min(asset.height - 1, Math.floor(v * asset.height)),
  };
}

export interface HitOptions {
  /** 알파 픽셀 판정 (true = 불투명). 없으면 사각형 판정. */
  alphaAt?: (layer: Layer, local: Point, size: Size) => boolean | null;
  /** 사각형 여유 (논리 단위) */
  pad?: number;
}

/** 최상위(z 큰 것 우선) 보이는 레이어 히트테스트. */
export function hitTest(layers: Layer[], p: Point, sizeOf: SizeResolver, opts: HitOptions = {}): Layer | null {
  const sorted = [...layers].filter((l) => l.visible).sort((a, b) => b.z - a.z);
  for (const layer of sorted) {
    const size = layerDrawSize(layer, sizeOf(layer));
    if (!pointInLayer(layer, size, p, opts.pad ?? 0)) continue;
    if (opts.alphaAt) {
      const local = toLocal(layer, p);
      const a = opts.alphaAt(layer, local, size);
      if (a === false) continue;
    }
    return layer;
  }
  return null;
}

/** 레이어 집합의 축정렬 bbox (회전 반영). 비어 있으면 null. */
export function layersBBox(layers: Layer[], sizeOf: SizeResolver): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const c of layerCorners(layer, layerDrawSize(layer, sizeOf(layer)))) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** rect를 box 안에 contain 맞춤하는 균등 배율 변환 (dst = src*scale + offset). */
export function fitRect(src: Rect, box: Rect, align: 'center' | 'bottom' = 'center'): { scale: number; dx: number; dy: number } {
  const w = Math.max(src.width, 1e-6);
  const h = Math.max(src.height, 1e-6);
  const scale = Math.min(box.width / w, box.height / h);
  const dx = box.x + (box.width - w * scale) / 2 - src.x * scale;
  const dy = align === 'bottom'
    ? box.y + box.height - h * scale - src.y * scale
    : box.y + (box.height - h * scale) / 2 - src.y * scale;
  return { scale, dx, dy };
}

// ── 보기(뷰포트) 변환 ───────────────────────────────────────
/** 보기 확대/이동 상태. pan 은 CSS px. */
export interface View { zoom: number; panX: number; panY: number }
export const IDENTITY_VIEW: View = { zoom: 1, panX: 0, panY: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** CSS px(캔버스 기준) → 논리 좌표 */
export function screenToLogical(p: Point, cssSize: number, view: View): Point {
  const k = (cssSize / LOGICAL_SIZE) * view.zoom;
  return { x: (p.x - view.panX) / k, y: (p.y - view.panY) / k };
}

/** 논리 좌표 → CSS px */
export function logicalToScreen(p: Point, cssSize: number, view: View): Point {
  const k = (cssSize / LOGICAL_SIZE) * view.zoom;
  return { x: p.x * k + view.panX, y: p.y * k + view.panY };
}

/** pan 을 제한하여 내용이 화면을 벗어나지 않게 한다. */
export function clampView(view: View, cssSize: number): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
  const minPan = cssSize - cssSize * zoom; // ≤ 0
  return { zoom, panX: clamp(view.panX, minPan, 0), panY: clamp(view.panY, minPan, 0) };
}

/** 화면 점 anchor 를 고정한 채 zoom 을 factor 배 */
export function zoomViewAt(view: View, factor: number, anchor: Point, cssSize: number): View {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const f = zoom / view.zoom;
  return clampView({
    zoom,
    panX: anchor.x - (anchor.x - view.panX) * f,
    panY: anchor.y - (anchor.y - view.panY) * f,
  }, cssSize);
}
