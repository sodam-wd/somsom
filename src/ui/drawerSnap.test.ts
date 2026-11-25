import { describe, expect, it } from 'vitest';
import { clampHeight, cycleSnap, isTap, resolveSnap, snapHeights } from './drawerSnap';

describe('drawer snap', () => {
  const s = snapHeights(800, 0);

  it('computes ordered heights', () => {
    expect(s.collapsed).toBeLessThan(s.half);
    expect(s.half).toBeLessThan(s.expanded);
    expect(s.expanded).toBeLessThanOrEqual(800);
  });

  it('keeps a usable half height on very short screens (keyboard open / landscape)', () => {
    const t = snapHeights(320, 20);
    expect(t.collapsed).toBe(112);
    expect(t.half).toBeGreaterThan(t.collapsed);
    expect(t.expanded).toBeGreaterThan(t.half);
  });

  it('snaps to nearest when slow', () => {
    expect(resolveSnap(s.collapsed + 10, 0, s)).toBe('collapsed');
    expect(resolveSnap(s.half - 20, 0.1, s)).toBe('half');
    expect(resolveSnap(s.expanded - 5, -0.1, s)).toBe('expanded');
  });

  it('flick moves one step in the direction', () => {
    expect(resolveSnap(s.collapsed + 30, 1.2, s)).toBe('half');
    expect(resolveSnap(s.half + 10, 1.2, s)).toBe('expanded');
    expect(resolveSnap(s.half - 10, -1.2, s)).toBe('collapsed');
    expect(resolveSnap(s.expanded, 2, s)).toBe('expanded');
    expect(resolveSnap(s.collapsed, -2, s)).toBe('collapsed');
  });

  it('cycles on tap and clamps', () => {
    expect(cycleSnap('collapsed')).toBe('half');
    expect(cycleSnap('half')).toBe('expanded');
    expect(cycleSnap('expanded')).toBe('collapsed');
    expect(clampHeight(5, s)).toBe(s.collapsed);
    expect(clampHeight(5000, s)).toBe(s.expanded);
    expect(isTap(3, 120)).toBe(true);
    expect(isTap(20, 120)).toBe(false);
  });
});
