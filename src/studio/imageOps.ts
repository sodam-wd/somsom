// studio-qa 소유 (T3). 배경/작품 그리기 보조 — 픽셀 보정, 배경 소스 로드, 배경 변형 그리기.
// ctx.filter 는 Safari 지원이 불안정하므로 픽셀 연산으로 통일한다.
import { loadAsset } from '../assets/loader';
import type { Background, Photo } from '../types/scene';
import { LOGICAL_SIZE } from '../types/scene';
import { coverSourceRect } from './geometry';
import { loadDataUrlImage } from './photoFile';

export interface ColorAdjust {
  saturation: number;
  brightness: number;
  contrast: number;
}

export function isIdentityAdjust(a: ColorAdjust): boolean {
  return a.saturation === 1 && a.brightness === 1 && a.contrast === 1;
}

/** RGBA 픽셀에 CSS filter 와 같은 순서(saturate → brightness → contrast)로 보정. 알파 유지. */
export function adjustPixels(data: Uint8ClampedArray, a: ColorAdjust): void {
  if (isIdentityAdjust(a)) return;
  const s = a.saturation;
  const b = a.brightness;
  const c = a.contrast;
  // saturate 행렬 (CSS Filter Effects 명세)
  const m00 = 0.213 + 0.787 * s, m01 = 0.715 - 0.715 * s, m02 = 0.072 - 0.072 * s;
  const m10 = 0.213 - 0.213 * s, m11 = 0.715 + 0.285 * s, m12 = 0.072 - 0.072 * s;
  const m20 = 0.213 - 0.213 * s, m21 = 0.715 - 0.715 * s, m22 = 0.072 + 0.928 * s;
  const off = 128 * (1 - c);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], bl = data[i + 2];
    let nr = m00 * r + m01 * g + m02 * bl;
    let ng = m10 * r + m11 * g + m12 * bl;
    let nb = m20 * r + m21 * g + m22 * bl;
    nr = nr * b * c + off;
    ng = ng * b * c + off;
    nb = nb * b * c + off;
    data[i] = nr; // Uint8ClampedArray 가 0..255 클램프 + 반올림
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

/** 소스를 (sx,sy,sw,sh) 영역만 잘라 보정한 새 캔버스. 최대 maxDim 으로 제한. */
export function adjustedCanvas(
  src: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  adjust: ColorAdjust,
  maxDim = 2048,
): HTMLCanvasElement {
  const k = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  if (!isIdentityAdjust(adjust)) {
    try {
      const img = ctx.getImageData(0, 0, w, h);
      adjustPixels(img.data, adjust);
      ctx.putImageData(img, 0, 0);
    } catch {
      /* tainted canvas 등 → 보정 없이 사용 */
    }
  }
  return canvas;
}

export interface BgSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** 프리셋이 실제 PNG 없이 임시 에셋인 경우 */
  isPlaceholder: boolean;
}

const photoCache = new WeakMap<Photo, Promise<BgSource>>();

/** 사진 배경: crop 영역 + 채도/밝기/대비 적용 (feather/양모 질감 마스크는 배경에 적용하지 않음) */
export function loadPhotoBgSource(photo: Photo): Promise<BgSource> {
  const hit = photoCache.get(photo);
  if (hit) return hit;
  const p = loadDataUrlImage(photo.dataUrl).then((img) => {
    const { x, y, width, height } = photo.crop;
    const c = adjustedCanvas(img, x, y, width, height, photo);
    return { source: c, width: c.width, height: c.height, isPlaceholder: false };
  });
  photoCache.set(photo, p);
  p.catch(() => photoCache.delete(photo));
  return p;
}

/** 배경 소스 로드. kind==='none' 이면 null. presetFallback 을 주면 none 대신 그 프리셋 사용. */
export async function loadBackgroundSource(bg: Background, presetFallback?: string): Promise<BgSource | null> {
  if (bg.kind === 'photo' && bg.photo) return loadPhotoBgSource(bg.photo);
  const presetId = bg.kind === 'preset' && bg.presetId ? bg.presetId : presetFallback;
  if (!presetId) return null;
  const a = await loadAsset(presetId);
  return { source: a.image, width: a.width, height: a.height, isPlaceholder: a.isPlaceholder };
}

/**
 * 배경 그리기 규칙 (editor-engine 과 공유):
 * 대상 w×h 에 cover-fit 중앙 배치 → translate(w/2+(x/L-0.5)w, h/2+(y/L-0.5)h) → rotate → scale.
 */
export function drawBackground(ctx: CanvasRenderingContext2D, src: BgSource, bg: Pick<Background, 'x' | 'y' | 'scale' | 'rotation'>, w: number, h: number): void {
  const r = coverSourceRect(src.width, src.height, w, h);
  ctx.save();
  ctx.translate(w / 2 + (bg.x / LOGICAL_SIZE - 0.5) * w, h / 2 + (bg.y / LOGICAL_SIZE - 0.5) * h);
  ctx.rotate((bg.rotation * Math.PI) / 180);
  ctx.scale(bg.scale, bg.scale);
  ctx.drawImage(src.source, r.x, r.y, r.width, r.height, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** 작품 밝기 보정 캔버스 (1 이면 원본 반환) */
export function brightenedArtwork(art: HTMLCanvasElement, brightness: number): HTMLCanvasElement {
  if (Math.abs(brightness - 1) < 0.005) return art;
  return adjustedCanvas(art, 0, 0, art.width, art.height, { saturation: 1, brightness, contrast: 1 }, Math.max(art.width, art.height));
}
