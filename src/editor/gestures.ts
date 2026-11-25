// editor-engine 소유 (T1). 제스처 순수 계산.
import type { Point } from './transforms';

export interface TwoFinger { a: Point; b: Point }

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleDeg(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 두 손가락 시작/현재 위치로 핀치 배율·회전 변화·중점 이동량을 계산.
 * 손가락이 거의 겹쳐 있으면 배율 1.
 */
export function pinchDelta(start: TwoFinger, now: TwoFinger): { scale: number; rotation: number; translate: Point } {
  const d0 = distance(start.a, start.b);
  const d1 = distance(now.a, now.b);
  const scale = d0 < 4 ? 1 : d1 / d0;
  let rotation = angleDeg(now.a, now.b) - angleDeg(start.a, start.b);
  if (rotation > 180) rotation -= 360;
  if (rotation < -180) rotation += 360;
  const m0 = midpoint(start.a, start.b);
  const m1 = midpoint(now.a, now.b);
  return { scale, rotation, translate: { x: m1.x - m0.x, y: m1.y - m0.y } };
}

/** 탭 판정 이동 허용치 (CSS px) */
export const TAP_SLOP = 8;

/** 각도 스냅: 목표에 threshold 이내면 스냅 (0/90/180/270). */
export function snapAngle(deg: number, threshold = 4): number {
  const nearest = Math.round(deg / 90) * 90;
  return Math.abs(deg - nearest) <= threshold ? nearest : deg;
}
