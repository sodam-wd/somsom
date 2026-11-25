// editor-engine 소유 (T1). Roll 단계 순수 로직 (D11 눈덩이 굴리기 + 자유 조립).
import { LAYER_BASE_SIZE, LOGICAL_SIZE, type Layer } from '../types/scene';

/** 몸통(눈덩이) 에셋: round / oval / irregular */
export const BODY_ASSET_IDS = ['A001', 'A002', 'A003'] as const;
export type BodyAssetId = (typeof BODY_ASSET_IDS)[number];

/** 눈덩이 반지름 범위 (논리 단위) */
export const ROLL_MIN_RADIUS = 70;
export const ROLL_MAX_RADIUS = 220;
/** 성장 속도 상수: 이 거리만큼 굴리면 최대치의 약 63% 도달 */
export const ROLL_GROWTH_DISTANCE = 1800;
/** 스택 시 위아래 눈덩이 겹침 비율 */
export const STACK_OVERLAP = 0.18;
/** 첫 몸통의 바닥 y (논리) */
export const STACK_FLOOR_Y = 900;

/** 굴린 거리 → 반지름. 단조 증가, [MIN, MAX] 클램프. */
export function rollRadius(distance: number): number {
  const d = Math.max(0, Number.isFinite(distance) ? distance : 0);
  const r = ROLL_MIN_RADIUS + (ROLL_MAX_RADIUS - ROLL_MIN_RADIUS) * (1 - Math.exp(-d / ROLL_GROWTH_DISTANCE));
  return Math.min(ROLL_MAX_RADIUS, Math.max(ROLL_MIN_RADIUS, r));
}

/** 반지름 → 굴린 거리 (rollRadius 역함수, 키보드/리셋용). */
export function distanceForRadius(radius: number): number {
  const t = (Math.min(ROLL_MAX_RADIUS - 1e-6, Math.max(ROLL_MIN_RADIUS, radius)) - ROLL_MIN_RADIUS) /
    (ROLL_MAX_RADIUS - ROLL_MIN_RADIUS);
  return -ROLL_GROWTH_DISTANCE * Math.log(1 - t);
}

/** 반지름 → 레이어 scale (지름이 LAYER_BASE_SIZE * scale) */
export function radiusToScale(radius: number): number {
  return (radius * 2) / LAYER_BASE_SIZE;
}

/** 이동 거리만큼 굴렀을 때의 회전각 증가 (도). 굴림: 호 길이 = 거리. */
export function rollAngleDelta(dx: number, radius: number): number {
  return (dx / Math.max(1, radius)) * (180 / Math.PI);
}

export function isBodyLayer(layer: Layer): boolean {
  return (BODY_ASSET_IDS as readonly string[]).includes(layer.assetId);
}

/**
 * 새 눈덩이를 기존 몸통 위에 자동 스택할 중심 위치.
 * 기존 몸통이 없으면 바닥(STACK_FLOOR_Y) 위 가운데.
 */
export function stackPosition(snowman: Layer[], radius: number): { x: number; y: number } {
  const bodies = snowman.filter((l) => l.visible && isBodyLayer(l));
  if (!bodies.length) return { x: LOGICAL_SIZE / 2, y: STACK_FLOOR_Y - radius };
  // 가장 위쪽 끝(top)이 작은 몸통을 기준
  let top = bodies[0];
  let topEdge = Infinity;
  for (const b of bodies) {
    const half = (LAYER_BASE_SIZE * Math.abs(b.scaleY)) / 2;
    const edge = b.y - half;
    if (edge < topEdge) {
      topEdge = edge;
      top = b;
    }
  }
  const y = topEdge - radius * (1 - STACK_OVERLAP * 2);
  return { x: top.x, y: Math.max(radius * 0.5, y) };
}
