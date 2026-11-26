import { describe, expect, it } from 'vitest';
import type { Layer } from '../types/scene';
import { snowmanPlacement, worldPlacement } from './placement';

const L = (assetId: string, x: number, y: number, s: number): Layer => ({
  id: assetId + x, assetId, x, y, scaleX: s, scaleY: s, rotation: 0, flipX: false, z: 0, tint: null, visible: true,
});

describe('placement', () => {
  const snow = [L('A001', 500, 720, 1.8), L('A001', 500, 460, 1.3)];
  it('puts face parts on the head and hat above it', () => {
    const eyes = snowmanPlacement('A004', snow);
    const hat = snowmanPlacement('A017', snow);
    const scarf = snowmanPlacement('A023', snow);
    expect(Math.abs((eyes.y ?? 0) - 460)).toBeLessThan(60);
    expect(hat.y!).toBeLessThan(eyes.y!);
    expect(scarf.y!).toBeGreaterThan(eyes.y!);
  });
  it('places single eyes and blush left then right on the head', () => {
    for (const id of ['A004', 'A015']) {
      const p1 = snowmanPlacement(id, snow);
      const p2 = snowmanPlacement(id, [...snow, L(id, p1.x!, p1.y!, p1.scaleX!)]);
      expect(p1.x!).toBeLessThan(500);
      expect(p2.x!).toBeGreaterThan(500);
      expect(Math.abs(p1.y! - 460)).toBeLessThan(60);
      // 한 개짜리 에셋이므로 머리 지름보다 훨씬 작게
      expect(p1.scaleX! * 200).toBeLessThan(1.3 * 200 * 0.92 * 0.4);
    }
  });
  it('alternates arms left/right with flip', () => {
    const a1 = snowmanPlacement('A028', snow);
    const a2 = snowmanPlacement('A028', [...snow, L('A028', a1.x!, a1.y!, 1)]);
    expect(a1.x!).toBeLessThan(500);
    expect(a2.x!).toBeGreaterThan(500);
    expect(a2.flipX).toBe(true);
  });
  it('spreads world items away from the centre', () => {
    const t1 = worldPlacement('A048', []);
    const t2 = worldPlacement('A048', [L('A048', t1.x!, t1.y!, 1)]);
    expect(Math.abs(t1.x! - 500)).toBeGreaterThan(200);
    expect(Math.sign(t1.x! - 500)).not.toBe(Math.sign(t2.x! - 500));
    expect(t1.y!).toBeGreaterThan(600);
  });
  it('works with an empty snowman', () => {
    const e = snowmanPlacement('A004', []);
    // 기본 머리(x=500) 기준 첫 눈은 왼쪽
    expect(e.x!).toBeLessThan(500);
    expect(e.x!).toBeGreaterThan(400);
  });
});
