import { describe, expect, it } from 'vitest';
import { adjustPixels, coverDrawSize, isIdentityAdjust } from './imageOps';
import { captureFileName } from './stageDraw';

const px = (...v: number[]) => new Uint8ClampedArray(v);

describe('adjustPixels', () => {
  it('identity leaves data unchanged', () => {
    const d = px(10, 20, 30, 40);
    adjustPixels(d, { saturation: 1, brightness: 1, contrast: 1 });
    expect([...d]).toEqual([10, 20, 30, 40]);
    expect(isIdentityAdjust({ saturation: 1, brightness: 1, contrast: 1 })).toBe(true);
  });
  it('brightness multiplies rgb and keeps alpha', () => {
    const d = px(100, 50, 200, 128);
    adjustPixels(d, { saturation: 1, brightness: 0.5, contrast: 1 });
    expect([...d]).toEqual([50, 25, 100, 128]);
    adjustPixels(d, { saturation: 1, brightness: 10, contrast: 1 });
    expect([...d]).toEqual([255, 250, 255, 128]);
  });
  it('saturation 0 gives gray (luminance)', () => {
    const d = px(255, 0, 0, 255);
    adjustPixels(d, { saturation: 0, brightness: 1, contrast: 1 });
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    expect(d[0]).toBe(Math.round(0.213 * 255));
  });
  it('contrast 0 gives mid gray', () => {
    const d = px(0, 128, 255, 255);
    adjustPixels(d, { saturation: 1, brightness: 1, contrast: 0 });
    expect([...d]).toEqual([128, 128, 128, 255]);
  });
});

describe('captureFileName', () => {
  it('has no personal data and a stable format', () => {
    expect(captureFileName('live', new Date(2026, 0, 2, 3, 4, 5))).toBe('somsom-live-20260102-030405.png');
  });
});

describe('coverDrawSize', () => {
  it('covers the target keeping aspect', () => {
    expect(coverDrawSize(1536, 1024, 1000, 1000)).toEqual({ w: 1500, h: 1000 });
    expect(coverDrawSize(100, 400, 300, 600)).toEqual({ w: 300, h: 1200 });
  });
});
