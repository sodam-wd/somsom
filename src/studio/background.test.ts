import { describe, expect, it } from 'vitest';
import { createDefaultBackground, createDefaultPhoto } from '../types/scene';
import { clampBackground, toBackgroundPhoto, wrapDegrees } from './background';

describe('toBackgroundPhoto', () => {
  it('restores full-image crop from default centered square crop', () => {
    const p = toBackgroundPhoto(createDefaultPhoto('data:x', 1600, 900));
    expect(p.crop).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
    expect(p.feather).toBe(0);
    expect(p.textureStrength).toBe(0);
    expect(p.saturation).toBe(1);
  });
  it('portrait', () => {
    expect(toBackgroundPhoto(createDefaultPhoto('data:x', 900, 2048)).crop).toEqual({ x: 0, y: 0, width: 900, height: 2048 });
  });
});

describe('clampBackground', () => {
  it('clamps position, scale, rotation without touching kind/photo', () => {
    const bg = { ...createDefaultBackground(), kind: 'preset' as const, presetId: 'BG02', x: -10, y: 5000, scale: 99, rotation: 270 };
    expect(clampBackground(bg)).toEqual({ ...bg, x: 0, y: 1000, scale: 4, rotation: -90 });
  });
  it('keeps ±180 boundaries', () => {
    expect(wrapDegrees(180)).toBe(180);
    expect(wrapDegrees(-180)).toBe(-180);
    expect(wrapDegrees(540)).toBe(-180);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(NaN)).toBe(0);
  });
});
