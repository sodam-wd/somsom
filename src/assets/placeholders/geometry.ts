// workshop-ui 소유: 임시 유리/받침대 에셋 정렬 기준.
// editor-engine 의 render/globe.ts (GLOBE_LAYOUT, traceContainerInterior) 와 같은 정규화 좌표를 사용한다.
// - 유리 전·후면(A056–A061): 각자 정사각 프레임, 내부 형태는 아래 경로와 동일.
// - 받침대(A062/A063): 자체 정사각 프레임, 위쪽 약 28% 지점의 윗면이 유리 바닥과 겹친다.
// (임시 에셋 기준이며 실제 PNG와 다를 수 있다)
import type { ContainerId } from '../../types/scene';

export const BASE_GEOMETRY = { left: 0.04, right: 0.96, lip: 0.28, bottom: 0.56, ry: 0.06 } as const;

/** 유리 내부 경로 (정사각 w×w 프레임 기준) — render/globe.ts traceContainerInterior 와 동일 */
export function glassInteriorPath(kind: ContainerId, w: number, h: number = w): Path2D {
  const p = new Path2D();
  const s = Math.min(w, h);
  const x = (w - s) / 2;
  const y = (h - s) / 2;
  const P = (u: number, v: number): [number, number] => [x + u * s, y + v * s];
  if (kind === 'round') {
    const cx = 0.5;
    const cy = 0.528;
    const r = 0.43;
    const flat = 0.915;
    const a = Math.asin((flat - cy) / r);
    p.moveTo(...P(cx + Math.cos(a) * r, flat));
    p.arc(x + cx * s, y + cy * s, r * s, a, Math.PI - a, true);
    p.closePath();
  } else if (kind === 'arch') {
    p.moveTo(...P(0.22, 0.915));
    p.lineTo(...P(0.22, 0.4));
    p.ellipse(x + 0.5 * s, y + 0.4 * s, 0.28 * s, 0.245 * s, 0, Math.PI, Math.PI * 2, false);
    p.lineTo(...P(0.78, 0.915));
    p.closePath();
  } else {
    p.moveTo(...P(0.428, 0.215));
    p.lineTo(...P(0.588, 0.215));
    p.lineTo(...P(0.588, 0.262));
    p.quadraticCurveTo(...P(0.71, 0.29), ...P(0.714, 0.42));
    p.lineTo(...P(0.714, 0.85));
    p.quadraticCurveTo(...P(0.714, 0.905), ...P(0.66, 0.905));
    p.lineTo(...P(0.35, 0.905));
    p.quadraticCurveTo(...P(0.294, 0.905), ...P(0.294, 0.85));
    p.lineTo(...P(0.294, 0.42));
    p.quadraticCurveTo(...P(0.298, 0.29), ...P(0.428, 0.262));
    p.closePath();
  }
  return p;
}

/** 전면 반사 하이라이트 기준점 (정규화) */
export const GLASS_HIGHLIGHT: Record<ContainerId, { x: number; y: number; len: number }> = {
  round: { x: 0.2, y: 0.26, len: 0.36 },
  arch: { x: 0.21, y: 0.3, len: 0.42 },
  bottle: { x: 0.25, y: 0.4, len: 0.36 },
};
