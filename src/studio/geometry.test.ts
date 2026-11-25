import { describe, expect, it } from 'vitest';
import {
  captureSize, clamp, clampCrop, clampPlacement, computeGestureDelta, containRect, coverSourceRect,
  moveCrop, placementRect, resizeCrop, scaleCrop,
} from './geometry';

describe('clamp', () => {
  it('limits and handles NaN', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(NaN, 0, 3)).toBe(0);
  });
});

describe('clampCrop', () => {
  it('keeps crop inside the image', () => {
    expect(clampCrop({ x: 900, y: -20, width: 300, height: 300 }, 1000, 800)).toEqual({ x: 700, y: 0, width: 300, height: 300 });
  });
  it('enforces min size and max size', () => {
    expect(clampCrop({ x: 0, y: 0, width: 5, height: 5000 }, 1000, 800)).toEqual({ x: 0, y: 0, width: 32, height: 800 });
  });
  it('handles images smaller than the min size', () => {
    expect(clampCrop({ x: 3, y: 3, width: 1, height: 1 }, 10, 20)).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });
});

describe('moveCrop', () => {
  it('moves and stops at edges', () => {
    const c = { x: 100, y: 100, width: 200, height: 200 };
    expect(moveCrop(c, 50, -500, 1000, 1000)).toEqual({ x: 150, y: 0, width: 200, height: 200 });
    expect(moveCrop(c, 5000, 0, 1000, 1000).x).toBe(800);
  });
});

describe('resizeCrop', () => {
  const c = { x: 100, y: 100, width: 200, height: 200 };
  it('se handle grows keeping nw anchored', () => {
    expect(resizeCrop(c, 'se', 50, 20, 1000, 1000)).toEqual({ x: 100, y: 100, width: 250, height: 220 });
  });
  it('nw handle keeps se anchored', () => {
    expect(resizeCrop(c, 'nw', -50, -50, 1000, 1000)).toEqual({ x: 50, y: 50, width: 250, height: 250 });
  });
  it('square lock uses larger side', () => {
    const r = resizeCrop(c, 'se', 80, 10, 1000, 1000, true);
    expect(r.width).toBe(r.height);
    expect(r.width).toBe(280);
  });
  it('square lock respects image bounds', () => {
    const r = resizeCrop(c, 'se', 2000, 0, 500, 1000, true);
    expect(r).toEqual({ x: 100, y: 100, width: 400, height: 400 });
  });
  it('does not shrink below min', () => {
    const r = resizeCrop(c, 'se', -500, -500, 1000, 1000);
    expect(r.width).toBeGreaterThanOrEqual(32);
    expect(r.height).toBeGreaterThanOrEqual(32);
    expect(r.x).toBe(100);
  });
});

describe('scaleCrop', () => {
  it('scales around center keeping aspect', () => {
    const r = scaleCrop({ x: 400, y: 400, width: 200, height: 100 }, 2, 2000, 2000);
    expect(r).toEqual({ x: 300, y: 350, width: 400, height: 200 });
  });
  it('caps at image size', () => {
    const r = scaleCrop({ x: 0, y: 0, width: 500, height: 500 }, 10, 800, 600);
    expect(r.width).toBe(600);
    expect(r.height).toBe(600);
  });
  it('ignores invalid factor', () => {
    const c = { x: 10, y: 10, width: 100, height: 100 };
    expect(scaleCrop(c, 0, 1000, 1000)).toEqual(c);
  });
});

describe('computeGestureDelta', () => {
  it('single pointer pan', () => {
    const d = computeGestureDelta([{ x: 0, y: 0 }], [{ x: 10, y: -5 }]);
    expect(d).toMatchObject({ dx: 10, dy: -5, scale: 1, rotation: 0 });
  });
  it('pinch scale and rotation', () => {
    const d = computeGestureDelta(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: 200 }],
    );
    expect(d.scale).toBeCloseTo(2);
    expect(d.rotation).toBeCloseTo(90);
  });
  it('pointer count change yields no jump', () => {
    const d = computeGestureDelta([{ x: 0, y: 0 }], [{ x: 50, y: 50 }, { x: 100, y: 100 }]);
    expect(d).toMatchObject({ dx: 0, dy: 0, scale: 1, rotation: 0 });
  });
  it('wraps rotation across ±180', () => {
    const d = computeGestureDelta(
      [{ x: 0, y: 0 }, { x: -100, y: 1 }],
      [{ x: 0, y: 0 }, { x: -100, y: -1 }],
    );
    expect(Math.abs(d.rotation)).toBeLessThan(5);
  });
});

describe('fit rects', () => {
  it('cover crops wider source', () => {
    expect(coverSourceRect(2000, 1000, 100, 100)).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });
  it('cover crops taller source', () => {
    expect(coverSourceRect(1000, 2000, 200, 100)).toEqual({ x: 0, y: 750, width: 1000, height: 500 });
  });
  it('contain', () => {
    expect(containRect(200, 100, 100, 100)).toEqual({ x: 0, y: 25, width: 100, height: 50 });
  });
});

describe('placement', () => {
  it('rect centered at placement point', () => {
    const r = placementRect({ x: 0.5, y: 0.5, scale: 1, shadow: 0, brightness: 1 }, 1000, 2000, 1, 1);
    expect(r.width).toBeCloseTo(620);
    expect(r.x + r.width / 2).toBeCloseTo(500);
    expect(r.y + r.height / 2).toBeCloseTo(1000);
  });
  it('clampPlacement', () => {
    expect(clampPlacement({ x: 2, y: -1, scale: 99, shadow: 3, brightness: -1 })).toEqual({ x: 1, y: 0, scale: 3, shadow: 1, brightness: 0 });
  });
  it('captureSize portrait/landscape', () => {
    expect(captureSize(390, 520)).toEqual({ width: 1080, height: 1440 });
    expect(captureSize(1600, 900)).toEqual({ width: 1920, height: 1080 });
    expect(captureSize(300, 900)).toEqual({ width: 640, height: 1920 });
  });
});
