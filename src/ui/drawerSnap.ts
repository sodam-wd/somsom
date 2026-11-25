// workshop-ui 소유: 모바일 하단 재료 서랍 3단 스냅 계산 (순수 함수).
export type DrawerSnap = 'collapsed' | 'half' | 'expanded';
export const SNAP_ORDER: readonly DrawerSnap[] = ['collapsed', 'half', 'expanded'];

export interface SnapHeights {
  collapsed: number;
  half: number;
  expanded: number;
}

/** 화면 높이(px)에 따른 서랍 높이. 접힘은 손잡이+탭이 보이는 높이. */
export function snapHeights(viewportH: number, safeBottom = 0): SnapHeights {
  const collapsed = Math.round(92 + safeBottom);
  const expanded = Math.round(Math.max(collapsed + 120, viewportH * 0.86));
  const half = Math.round(Math.min(expanded - 60, Math.max(collapsed + 120, viewportH * 0.44)));
  return { collapsed, half, expanded };
}

export function clampHeight(h: number, s: SnapHeights): number {
  return Math.min(s.expanded, Math.max(s.collapsed, h));
}

/**
 * 드래그를 놓았을 때 스냅 위치 결정.
 * velocity: px/ms, 위로(+높이 증가) 양수. 빠른 플릭은 진행 방향의 다음 단계로.
 */
export function resolveSnap(height: number, velocity: number, s: SnapHeights, flick = 0.5): DrawerSnap {
  const entries = SNAP_ORDER.map((k) => [k, s[k]] as const);
  if (Math.abs(velocity) >= flick) {
    if (velocity > 0) {
      const next = entries.find(([, v]) => v > height + 1);
      return next ? next[0] : 'expanded';
    }
    const prev = [...entries].reverse().find(([, v]) => v < height - 1);
    return prev ? prev[0] : 'collapsed';
  }
  let best: DrawerSnap = 'collapsed';
  let dist = Infinity;
  for (const [k, v] of entries) {
    const d = Math.abs(v - height);
    if (d < dist) {
      dist = d;
      best = k;
    }
  }
  return best;
}

/** 손잡이 탭: 접힘 → 절반 → 확장 → 접힘 */
export function cycleSnap(cur: DrawerSnap): DrawerSnap {
  return cur === 'collapsed' ? 'half' : cur === 'half' ? 'expanded' : 'collapsed';
}

/** 이동량이 작으면 탭으로 간주 */
export function isTap(dy: number, dtMs: number, slop = 6): boolean {
  return Math.abs(dy) <= slop && dtMs < 500;
}
