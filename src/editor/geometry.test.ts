import { describe, expect, it } from 'vitest';
import { LAYER_BASE_SIZE, type Layer } from '../types/scene';
import {
  clampView, fitRect, hitTest, layerDrawSize, layersBBox, logicalToScreen, normalizeAngle,
  screenToLogical, toLocal, toParent, zoomViewAt,
} from './transforms';
import { pinchDelta, snapAngle } from './gestures';
import {
  ROLL_MAX_RADIUS, ROLL_MIN_RADIUS, STACK_FLOOR_Y, distanceForRadius, radiusToScale, rollAngleDelta,
  rollRadius, stackPosition,
} from './roll';

function layer(p: Partial<Layer>): Layer {
  return { id: 'l', assetId: 'A001', x: 500, y: 500, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, z: 0, tint: null, visible: true, ...p };
}
const square = () => ({ width: 1024, height: 1024 });

describe('transforms', () => {
  it('keeps aspect ratio with long side = LAYER_BASE_SIZE * scale', () => {
    expect(layerDrawSize(layer({ scaleX: 2, scaleY: 2 }), { width: 1536, height: 1024 })).toEqual({
      width: LAYER_BASE_SIZE * 2, height: (LAYER_BASE_SIZE * 2 * 1024) / 1536,
    });
    expect(layerDrawSize(layer({}), null)).toEqual({ width: LAYER_BASE_SIZE, height: LAYER_BASE_SIZE });
  });

  it('round-trips local/parent with rotation and flip', () => {
    const l = layer({ x: 120, y: 80, rotation: 33, flipX: true });
    const p = { x: 151, y: 47 };
    const back = toParent(l, toLocal(l, p));
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
    const rot = layer({ x: 0, y: 0, rotation: 90 });
    const local = toLocal(rot, { x: 0, y: 10 });
    expect(local.x).toBeCloseTo(10, 6);
    expect(local.y).toBeCloseTo(0, 6);
  });

  it('hit-tests top-most visible layer considering rotation', () => {
    const bottom = layer({ id: 'b', z: 0 });
    const top = layer({ id: 't', z: 1, x: 560 });
    const hidden = layer({ id: 'h', z: 2, visible: false });
    expect(hitTest([bottom, top, hidden], { x: 540, y: 500 }, square)?.id).toBe('t');
    expect(hitTest([bottom, top], { x: 420, y: 500 }, square)?.id).toBe('b');
    expect(hitTest([bottom, top], { x: 900, y: 900 }, square)).toBeNull();
    // 45도 회전한 정사각형: 축정렬 모서리 근처는 빗나감
    const rotated = layer({ id: 'r', rotation: 45 });
    expect(hitTest([rotated], { x: 595, y: 405 }, square)).toBeNull();
    expect(hitTest([rotated], { x: 500, y: 365 }, square)?.id).toBe('r');
  });

  it('uses alpha test when provided', () => {
    const a = layer({ id: 'a', z: 0 });
    const b = layer({ id: 'b', z: 1 });
    const alphaAt = (l: Layer) => l.id !== 'b';
    expect(hitTest([a, b], { x: 500, y: 500 }, square, { alphaAt })?.id).toBe('a');
  });

  it('computes rotated bbox and fit', () => {
    const bb = layersBBox([layer({ rotation: 45 })], square)!;
    const half = (LAYER_BASE_SIZE / 2) * Math.SQRT2;
    expect(bb.x).toBeCloseTo(500 - half, 6);
    expect(bb.width).toBeCloseTo(half * 2, 6);
    expect(layersBBox([], square)).toBeNull();
    const f = fitRect({ x: 0, y: 0, width: 100, height: 200 }, { x: 0, y: 0, width: 1000, height: 1000 }, 'bottom');
    expect(f.scale).toBe(5);
    expect(f.dx).toBe(250);
    expect(f.dy).toBe(0);
  });

  it('converts screen/logical with view and clamps zoom', () => {
    const view = { zoom: 2, panX: -100, panY: -50 };
    const p = screenToLogical({ x: 200, y: 150 }, 500, view);
    expect(p).toEqual({ x: 300, y: 200 });
    expect(logicalToScreen(p, 500, view)).toEqual({ x: 200, y: 150 });
    expect(clampView({ zoom: 10, panX: 50, panY: -9999 }, 500)).toEqual({ zoom: 4, panX: 0, panY: -1500 });
    const z = zoomViewAt({ zoom: 1, panX: 0, panY: 0 }, 2, { x: 250, y: 250 }, 500);
    expect(z).toEqual({ zoom: 2, panX: -250, panY: -250 });
    expect(zoomViewAt(z, 0.1, { x: 0, y: 0 }, 500)).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('normalizes angles', () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-190)).toBe(170);
    expect(normalizeAngle(180)).toBe(180);
  });
});

describe('gestures', () => {
  it('computes pinch scale, rotation and translation', () => {
    const d = pinchDelta(
      { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
      { a: { x: 10, y: 10 }, b: { x: 10, y: 210 } },
    );
    expect(d.scale).toBeCloseTo(2, 6);
    expect(d.rotation).toBeCloseTo(90, 6);
    expect(d.translate).toEqual({ x: -40, y: 110 });
    expect(snapAngle(88)).toBe(90);
    expect(snapAngle(80)).toBe(80);
  });
});

describe('roll', () => {
  it('grows monotonically and clamps', () => {
    expect(rollRadius(0)).toBe(ROLL_MIN_RADIUS);
    expect(rollRadius(-50)).toBe(ROLL_MIN_RADIUS);
    expect(rollRadius(NaN)).toBe(ROLL_MIN_RADIUS);
    let prev = 0;
    for (const d of [0, 100, 500, 1000, 3000, 8000]) {
      const r = rollRadius(d);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    expect(rollRadius(1e9)).toBeLessThanOrEqual(ROLL_MAX_RADIUS);
    expect(rollRadius(distanceForRadius(120))).toBeCloseTo(120, 6);
  });

  it('maps radius to scale and roll angle', () => {
    expect(radiusToScale(LAYER_BASE_SIZE / 2)).toBe(1);
    expect(rollAngleDelta(Math.PI * 50, 50)).toBeCloseTo(180, 6);
  });

  it('stacks new snowballs on top of existing bodies', () => {
    expect(stackPosition([], 100)).toEqual({ x: 500, y: STACK_FLOOR_Y - 100 });
    const base = layer({ id: 'b', x: 480, y: 750, scaleX: 1.5, scaleY: 1.5 }); // top edge 600
    const hat = layer({ id: 'h', assetId: 'A017', y: 100 });
    const pos = stackPosition([base, hat], 80);
    expect(pos.x).toBe(480);
    expect(pos.y).toBeLessThan(600);
    expect(pos.y).toBeGreaterThan(600 - 80);
  });
});
