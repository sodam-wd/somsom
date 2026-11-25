// 공통 에셋 로더 (리더 소유).
// 1) public/<path> 의 실제 PNG를 우선 로드한다.
// 2) 없거나 로드 실패 시 src/assets/placeholders 의 임시 에셋(Canvas)을 사용한다.
// 실제 PNG를 지정 경로에 추가하면 코드 수정 없이 자동 교체된다.
import { useEffect, useState } from 'react';
import { ASSETS_BY_ID, ASSET_MANIFEST } from './manifest';
import { drawPlaceholder } from './placeholders';
import type { AssetEntry, LoadedAsset } from '../types/scene';

const cache = new Map<string, Promise<LoadedAsset>>();
const resolved = new Map<string, LoadedAsset>();
const listeners = new Set<() => void>();

export function assetUrl(entry: AssetEntry): string {
  return `${import.meta.env.BASE_URL}${entry.path}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`missing: ${url}`));
    img.src = url;
  });
}

/** 임시 에셋 해상도 (실제 목표 1024 대비 축소하여 메모리 절약) */
const PLACEHOLDER_SCALE = 0.5;

/**
 * 임시 에셋 생성을 한 번에 하나씩, 프레임 사이에 나눠 실행해 메인 스레드 장시간 점유를 막는다.
 * 가장 최근 요청을 먼저 처리(LIFO)하여, 화면에 막 나타난 썸네일이
 * 앞서 일괄 요청된(예: 에셋 현황) 항목 뒤에서 기다리지 않게 한다.
 */
const placeholderStack: Array<() => Promise<void>> = [];
let placeholderRunning = false;
const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

async function runPlaceholderStack(): Promise<void> {
  if (placeholderRunning) return;
  placeholderRunning = true;
  try {
    while (placeholderStack.length) {
      await nextTick();
      const job = placeholderStack.pop();
      if (job) await job();
    }
  } finally {
    placeholderRunning = false;
  }
}

function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    if (!canvas.toBlob) return resolve(canvas.toDataURL('image/png'));
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')), 'image/png');
  });
}

function makePlaceholder(entry: AssetEntry): Promise<LoadedAsset> {
  return new Promise<LoadedAsset>((resolve, reject) => {
    placeholderStack.push(async () => {
      try {
        const w = Math.round(entry.width * PLACEHOLDER_SCALE);
        const h = Math.round(entry.height * PLACEHOLDER_SCALE);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) drawPlaceholder(entry, ctx, w, h);
        const url = await canvasUrl(canvas);
        resolve({ id: entry.id, image: canvas, width: w, height: h, isPlaceholder: true, url });
      } catch (e) {
        reject(e);
      }
    });
    void runPlaceholderStack();
  });
}

export function loadAsset(id: string): Promise<LoadedAsset> {
  const hit = cache.get(id);
  if (hit) return hit;
  const entry = ASSETS_BY_ID[id];
  if (!entry) return Promise.reject(new Error(`unknown asset id: ${id}`));
  const url = assetUrl(entry);
  const p = loadImage(url)
    .then<LoadedAsset>((img) => ({
      id,
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      isPlaceholder: false,
      url,
    }))
    .catch(() => makePlaceholder(entry))
    .then((a) => {
      resolved.set(id, a);
      listeners.forEach((l) => l());
      return a;
    });
  cache.set(id, p);
  return p;
}

/** 이미 로드된 에셋을 동기적으로 얻는다 (렌더 루프용). 없으면 로드를 시작하고 null. */
export function getLoadedAsset(id: string): LoadedAsset | null {
  const a = resolved.get(id);
  if (a) return a;
  if (ASSETS_BY_ID[id]) void loadAsset(id);
  return null;
}

export function preloadAssets(ids: string[]): Promise<LoadedAsset[]> {
  return Promise.all(ids.map(loadAsset));
}

export function subscribeAssets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAsset(id: string | undefined): LoadedAsset | null {
  const [asset, setAsset] = useState<LoadedAsset | null>(() => (id ? resolved.get(id) ?? null : null));
  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadAsset(id).then((a) => alive && setAsset(a)).catch(() => alive && setAsset(null));
    return () => {
      alive = false;
    };
  }, [id]);
  return asset;
}

/** 실제/임시 에셋 현황 (누락 목록 UI용). 전체 manifest를 로드 시도한다. */
export async function getAssetStatus(): Promise<{ total: number; real: string[]; placeholder: string[] }> {
  const all = await preloadAssets(ASSET_MANIFEST.map((a) => a.id));
  return {
    total: all.length,
    real: all.filter((a) => !a.isPlaceholder).map((a) => a.id),
    placeholder: all.filter((a) => a.isPlaceholder).map((a) => a.id),
  };
}
