// editor-engine 소유 (T1). 이미지 캐시: tint 결과·사진 렌더·배경 사진. 원본 에셋은 변경하지 않는다.
import { getLoadedAsset, loadAsset } from '../assets/loader';
import { PHOTO_ASSET_ID, type Layer, type LoadedAsset, type Photo } from '../types/scene';
import { tintPixels } from './pixels';

export type Drawable = HTMLImageElement | HTMLCanvasElement;
export interface SizedImage { image: Drawable; width: number; height: number }

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const listeners = new Set<() => void>();
/** 비동기 캐시(사진 등)가 준비되면 알림 → 캔버스 재그리기 */
export function subscribeRenderCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notify() {
  listeners.forEach((l) => l());
}

export function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = url;
  });
}

// ── tint ────────────────────────────────────────────────────
const TINT_CACHE_MAX = 48;
/** 편집/출력용 tint 결과 최대 변 길이 (메모리 절약) */
const TINT_MAX_SIDE = 1024;
const tintCache = new Map<string, HTMLCanvasElement>();

function tintKey(asset: LoadedAsset, tint: string): string {
  return `${asset.id}|${asset.isPlaceholder ? 'p' : 'r'}|${tint}`;
}

/** 밝기·섬유 질감을 보존하여 tint 한 사본 (원본 보존). 캐시됨. */
export function getTintedImage(asset: LoadedAsset, tint: string): HTMLCanvasElement {
  const key = tintKey(asset, tint);
  const hit = tintCache.get(key);
  if (hit) {
    tintCache.delete(key);
    tintCache.set(key, hit);
    return hit;
  }
  const k = Math.min(1, TINT_MAX_SIDE / Math.max(asset.width, asset.height));
  const c = createCanvas(asset.width * k, asset.height * k);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(asset.image, 0, 0, c.width, c.height);
    try {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      img.data.set(tintPixels(img.data, tint));
      ctx.putImageData(img, 0, 0);
    } catch {
      // 픽셀 접근 불가 시: 'color' 합성으로 근사 후 원본 알파 유지
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(asset.image, 0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  tintCache.set(key, c);
  while (tintCache.size > TINT_CACHE_MAX) {
    const first = tintCache.keys().next().value;
    if (first === undefined) break;
    tintCache.delete(first);
  }
  return c;
}

// ── 알파 히트 테스트용 픽셀 샘플 ─────────────────────────────
const alphaCache = new WeakMap<Drawable, { data: Uint8ClampedArray; w: number; h: number } | null>();
const ALPHA_SAMPLE_SIDE = 128;

/** 이미지 정규화 좌표 (u,v ∈ 0..1) 의 알파 > 임계 여부. 판단 불가 시 null. */
export function isOpaqueAt(image: Drawable, u: number, v: number): boolean | null {
  let entry = alphaCache.get(image);
  if (entry === undefined) {
    entry = null;
    try {
      const c = createCanvas(ALPHA_SAMPLE_SIDE, ALPHA_SAMPLE_SIDE);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(image, 0, 0, c.width, c.height);
        entry = { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
      }
    } catch {
      entry = null;
    }
    alphaCache.set(image, entry);
  }
  if (!entry) return null;
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  const x = Math.min(entry.w - 1, Math.floor(u * entry.w));
  const y = Math.min(entry.h - 1, Math.floor(v * entry.h));
  return entry.data[(y * entry.w + x) * 4 + 3] > 24;
}

// ── 사진 (얼굴/배경) 캐시 ───────────────────────────────────
/** 편집 화면용 사진 렌더 크기 */
export const EDITOR_PHOTO_SIZE = 512;

type PhotoRenderer = (photo: Photo, size: number) => Promise<HTMLCanvasElement>;
let photoRenderer: PhotoRenderer | null = null;
/** photo.ts 가 등록 (순환 import 방지) */
export function registerPhotoRenderer(fn: PhotoRenderer) {
  photoRenderer = fn;
}

interface PhotoEntry { canvas: HTMLCanvasElement | null; promise: Promise<HTMLCanvasElement | null> }
const photoCache = new WeakMap<Photo, PhotoEntry>();

/** 얼굴 사진 레이어의 렌더 결과 (동기). 준비 전이면 생성 시작 후 null. */
export function getPhotoCanvas(photo: Photo): HTMLCanvasElement | null {
  const hit = photoCache.get(photo);
  if (hit) return hit.canvas;
  ensurePhotoCanvas(photo);
  return null;
}

export function ensurePhotoCanvas(photo: Photo): Promise<HTMLCanvasElement | null> {
  const hit = photoCache.get(photo);
  if (hit) return hit.promise;
  const entry: PhotoEntry = { canvas: null, promise: Promise.resolve(null) };
  entry.promise = (photoRenderer ? photoRenderer(photo, EDITOR_PHOTO_SIZE) : Promise.reject(new Error('no renderer')))
    .then((c) => {
      entry.canvas = c;
      notify();
      return c;
    })
    .catch(() => null);
  photoCache.set(photo, entry);
  return entry.promise;
}

type BgRenderer = (photo: Photo) => Promise<HTMLCanvasElement>;
let bgRenderer: BgRenderer | null = null;
export function registerBackgroundRenderer(fn: BgRenderer) {
  bgRenderer = fn;
}
const bgCache = new WeakMap<Photo, PhotoEntry>();

/** 배경 사진(crop + 보정, 마스크 없음) 동기 조회. 준비 전이면 생성 시작 후 null. */
export function getBackgroundCanvas(photo: Photo): HTMLCanvasElement | null {
  const hit = bgCache.get(photo);
  if (hit) return hit.canvas;
  ensureBackgroundCanvas(photo);
  return null;
}

export function ensureBackgroundCanvas(photo: Photo): Promise<HTMLCanvasElement | null> {
  const hit = bgCache.get(photo);
  if (hit) return hit.promise;
  const entry: PhotoEntry = { canvas: null, promise: Promise.resolve(null) };
  entry.promise = (bgRenderer ? bgRenderer(photo) : Promise.reject(new Error('no renderer')))
    .then((c) => {
      entry.canvas = c;
      notify();
      return c;
    })
    .catch(() => null);
  bgCache.set(photo, entry);
  return entry.promise;
}

// ── 출력용 고해상도 사진 (출력 렌더 동안만 적용) ─────────────
let photoOverrides: Map<Photo, HTMLCanvasElement> | null = null;

/** 출력 그리기 동안 사용할 사진 렌더 결과를 지정 (null = 해제). 동기 그리기 구간에서만 사용. */
export function setPhotoOverrides(map: Map<Photo, HTMLCanvasElement> | null) {
  photoOverrides = map;
}

// ── 레이어 이미지 해석 ─────────────────────────────────────
/** 레이어를 그릴 이미지 (tint/사진 반영). 아직 로딩 중이면 null. */
export function getLayerImage(layer: Layer): SizedImage | null {
  if (layer.assetId === PHOTO_ASSET_ID) {
    if (!layer.photo) return null;
    const c = photoOverrides?.get(layer.photo) ?? getPhotoCanvas(layer.photo);
    return c ? { image: c, width: c.width, height: c.height } : null;
  }
  const asset = getLoadedAsset(layer.assetId);
  if (!asset) return null;
  if (layer.tint) {
    const t = getTintedImage(asset, layer.tint);
    return { image: t, width: asset.width, height: asset.height };
  }
  return { image: asset.image, width: asset.width, height: asset.height };
}

/** 레이어 원본 크기 (종횡비용). 로딩 전이면 null(정사각 가정). */
export function getLayerSize(layer: Layer): { width: number; height: number } | null {
  if (layer.assetId === PHOTO_ASSET_ID) return { width: 1, height: 1 };
  const a = getLoadedAsset(layer.assetId);
  return a ? { width: a.width, height: a.height } : null;
}

/** 출력 전: 레이어들이 쓰는 에셋/사진을 모두 준비 */
export async function prepareLayers(layers: Layer[]): Promise<void> {
  await Promise.all(layers.map(async (l) => {
    if (l.assetId === PHOTO_ASSET_ID) {
      if (l.photo) await ensurePhotoCanvas(l.photo);
    } else {
      await loadAsset(l.assetId).catch(() => null);
    }
  }));
}
