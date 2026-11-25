// studio-qa 소유 (T3). 순수 기하 함수 — crop 클램프, 제스처 계산, 배치 사각형.
import type { CameraPlacement, PhotoCrop } from '../types/scene';

export function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/** crop 최소 변 (원본 px). 이미지가 더 작으면 이미지 크기로 제한. */
export const MIN_CROP = 32;

/** 사각형을 이미지 경계 안으로 클램프하고 최소 크기를 보장한다. */
export function clampCrop(crop: PhotoCrop, imgW: number, imgH: number, minSize = MIN_CROP): PhotoCrop {
  const minW = Math.min(minSize, imgW);
  const minH = Math.min(minSize, imgH);
  const width = clamp(crop.width, minW, imgW);
  const height = clamp(crop.height, minH, imgH);
  const x = clamp(crop.x, 0, imgW - width);
  const y = clamp(crop.y, 0, imgH - height);
  return { x, y, width, height };
}

/** 이동 (크기 유지, 경계 클램프). */
export function moveCrop(crop: PhotoCrop, dx: number, dy: number, imgW: number, imgH: number): PhotoCrop {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, imgW, imgH);
}

export type CropHandle = 'nw' | 'ne' | 'sw' | 'se';

/**
 * 모서리 핸들로 크기 조절. 반대쪽 모서리를 고정한다.
 * square=true 이면 정사각 비율 유지 (얼굴 마스크용).
 */
export function resizeCrop(
  crop: PhotoCrop,
  handle: CropHandle,
  dx: number,
  dy: number,
  imgW: number,
  imgH: number,
  square = false,
  minSize = MIN_CROP,
): PhotoCrop {
  const left = crop.x;
  const top = crop.y;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const west = handle === 'nw' || handle === 'sw';
  const north = handle === 'nw' || handle === 'ne';
  // 고정 모서리
  const ax = west ? right : left;
  const ay = north ? bottom : top;
  // 움직이는 모서리
  let mx = (west ? left : right) + dx;
  let my = (north ? top : bottom) + dy;
  // 이미지 경계
  mx = clamp(mx, 0, imgW);
  my = clamp(my, 0, imgH);
  const minW = Math.min(minSize, imgW);
  const minH = Math.min(minSize, imgH);
  let w = Math.max(minW, Math.abs(ax - mx));
  let h = Math.max(minH, Math.abs(ay - my));
  if (square) {
    const maxW = west ? ax : imgW - ax;
    const maxH = north ? ay : imgH - ay;
    const s = clamp(Math.max(w, h), Math.min(minW, minH), Math.min(maxW, maxH));
    w = s;
    h = s;
  } else {
    w = Math.min(w, west ? ax : imgW - ax);
    h = Math.min(h, north ? ay : imgH - ay);
  }
  const x = west ? ax - w : ax;
  const y = north ? ay - h : ay;
  return clampCrop({ x, y, width: w, height: h }, imgW, imgH, minSize);
}

/**
 * 중심(cx,cy, 원본 px) 기준 crop 크기 배율. factor>1 이면 crop이 커짐(축소 보기).
 */
export function scaleCrop(
  crop: PhotoCrop,
  factor: number,
  imgW: number,
  imgH: number,
  cx = crop.x + crop.width / 2,
  cy = crop.y + crop.height / 2,
): PhotoCrop {
  if (!(factor > 0) || !Number.isFinite(factor)) return clampCrop(crop, imgW, imgH);
  const aspect = crop.width / crop.height;
  let w = crop.width * factor;
  let h = crop.height * factor;
  // 비율 유지하며 이미지보다 커지지 않게
  if (w > imgW) {
    w = imgW;
    h = w / aspect;
  }
  if (h > imgH) {
    h = imgH;
    w = h * aspect;
  }
  const minW = Math.min(MIN_CROP, imgW);
  if (w < minW) {
    w = minW;
    h = w / aspect;
  }
  const rx = (cx - crop.x) / crop.width;
  const ry = (cy - crop.y) / crop.height;
  return clampCrop({ x: cx - rx * w, y: cy - ry * h, width: w, height: h }, imgW, imgH);
}

/** 전체 이미지 crop */
export function fullCrop(imgW: number, imgH: number): PhotoCrop {
  return { x: 0, y: 0, width: imgW, height: imgH };
}

// ── 제스처 ─────────────────────────────────────────────────
export interface Pt {
  x: number;
  y: number;
}

export interface GestureDelta {
  /** 중심 이동 */
  dx: number;
  dy: number;
  /** 거리 배율 (1 = 변화 없음) */
  scale: number;
  /** 각도 변화 (degrees) */
  rotation: number;
  /** 현재 중심 */
  center: Pt;
}

export function centroid(pts: Pt[]): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

/**
 * 이전/현재 포인터 위치로 이동·핀치·회전 변화를 계산한다.
 * 포인터 수가 다르면(손가락 추가/제거 순간) 변화 없음으로 처리해 점프를 막는다.
 */
export function computeGestureDelta(prev: Pt[], next: Pt[]): GestureDelta {
  const center = centroid(next);
  if (prev.length === 0 || prev.length !== next.length) {
    return { dx: 0, dy: 0, scale: 1, rotation: 0, center };
  }
  const pc = centroid(prev);
  let scale = 1;
  let rotation = 0;
  if (next.length >= 2) {
    const [a0, b0] = prev;
    const [a1, b1] = next;
    const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
    const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
    if (d0 > 1 && d1 > 1) scale = d1 / d0;
    const ang0 = Math.atan2(b0.y - a0.y, b0.x - a0.x);
    const ang1 = Math.atan2(b1.y - a1.y, b1.x - a1.x);
    let da = ((ang1 - ang0) * 180) / Math.PI;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;
    rotation = da;
  }
  return { dx: center.x - pc.x, dy: center.y - pc.y, scale, rotation, center };
}

// ── 배치/맞춤 ──────────────────────────────────────────────
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** src 를 dst 에 꽉 채우는(cover) 원본 영역 — drawImage(src, sx,sy,sw,sh, 0,0,dw,dh) 용 */
export function coverSourceRect(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return { x: 0, y: 0, width: srcW, height: srcH };
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    const w = srcH * dstAspect;
    return { x: (srcW - w) / 2, y: 0, width: w, height: srcH };
  }
  const h = srcW / dstAspect;
  return { x: 0, y: (srcH - h) / 2, width: srcW, height: h };
}

/** src 를 dst 안에 모두 보이게(contain) 놓는 목적 사각형 */
export function containRect(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const s = Math.min(dstW / srcW, dstH / srcH);
  const width = srcW * s;
  const height = srcH * s;
  return { x: (dstW - width) / 2, y: (dstH - height) / 2, width, height };
}

/** 배치 scale 1 일 때 작품의 긴 변 = 화면 짧은 변 × 이 값 */
export const PLACEMENT_BASE = 0.62;
export const PLACEMENT_SCALE_MIN = 0.2;
export const PLACEMENT_SCALE_MAX = 3;

/** CameraPlacement → 화면(view) 상 작품 사각형. 미리보기와 캡처가 같은 함수를 쓴다. */
export function placementRect(
  p: CameraPlacement,
  viewW: number,
  viewH: number,
  artW: number,
  artH: number,
): Rect {
  const long = Math.min(viewW, viewH) * PLACEMENT_BASE * p.scale;
  const aspect = artW > 0 && artH > 0 ? artW / artH : 1;
  const width = aspect >= 1 ? long : long * aspect;
  const height = aspect >= 1 ? long / aspect : long;
  return { x: p.x * viewW - width / 2, y: p.y * viewH - height / 2, width, height };
}

/** 배치 값을 허용 범위로 정규화 */
export function clampPlacement(p: CameraPlacement): CameraPlacement {
  return {
    x: clamp(p.x, 0, 1),
    y: clamp(p.y, 0, 1),
    scale: clamp(p.scale, PLACEMENT_SCALE_MIN, PLACEMENT_SCALE_MAX),
    shadow: clamp(p.shadow, 0, 1),
    brightness: clamp(p.brightness, 0, 2),
  };
}

/** 캡처 출력 크기: 화면 비율 유지, 짧은 변 1080, 긴 변 최대 1920 */
export function captureSize(viewW: number, viewH: number, short = 1080, maxLong = 1920): { width: number; height: number } {
  if (viewW <= 0 || viewH <= 0) return { width: short, height: short };
  const portrait = viewH >= viewW;
  const ratio = portrait ? viewH / viewW : viewW / viewH;
  let s = short;
  let l = Math.round(s * ratio);
  if (l > maxLong) {
    l = maxLong;
    s = Math.round(l / ratio);
  }
  return portrait ? { width: s, height: l } : { width: l, height: s };
}
