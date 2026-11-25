// studio-qa 소유 (T3). 배경 관련 순수 함수.
import { LOGICAL_SIZE, type Background, type Photo } from '../types/scene';
import { clamp, fullCrop } from './geometry';

export const BG_SCALE_MIN = 0.5;
export const BG_SCALE_MAX = 4;

/** createDefaultPhoto 의 중앙 정사각 crop 으로부터 원본 크기를 복원하고 전체 crop 으로 바꾼다. */
export function toBackgroundPhoto(p: Photo): Photo {
  const w = Math.round(p.crop.width + 2 * p.crop.x);
  const h = Math.round(p.crop.height + 2 * p.crop.y);
  return { ...p, crop: fullCrop(w, h), feather: 0, textureStrength: 0 };
}

/** 배경 변형 값 정규화 */
export function clampBackground(bg: Background): Background {
  return {
    ...bg,
    x: clamp(bg.x, 0, LOGICAL_SIZE),
    y: clamp(bg.y, 0, LOGICAL_SIZE),
    scale: clamp(bg.scale, BG_SCALE_MIN, BG_SCALE_MAX),
    rotation: wrapDegrees(bg.rotation),
  };
}

/** -180..180 범위로 정규화 (경계값 ±180 은 그대로 유지) */
export function wrapDegrees(d: number): number {
  if (!Number.isFinite(d)) return 0;
  if (d >= -180 && d <= 180) return d;
  return ((((d + 180) % 360) + 360) % 360) - 180;
}
