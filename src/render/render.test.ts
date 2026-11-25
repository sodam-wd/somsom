import { describe, expect, it } from 'vitest';
import { createDefaultPhoto, createDefaultScene, type Scene } from '../types/scene';
import { parseScene, serializeScene } from './sceneio';
import { adjustPixels, ellipseMaskAlpha, hexToRgb, luminance, seededRandom, tintPixels } from './pixels';
import { createFlakes, floatingFlakesAt, shakeFlakes, stepFlakes } from './particles';
import { SNOW_FLOOR_Y } from './globe';
import { formatBirthDate, wrapText } from './output';

function sampleScene(): Scene {
  const s = createDefaultScene();
  s.stage = 'born';
  s.snowman = [
    { id: 'a1', assetId: 'A001', x: 500, y: 700, scaleX: 1.5, scaleY: 1.5, rotation: 0, flipX: false, z: 0, tint: null, visible: true },
    {
      id: 'p1', assetId: 'photo', x: 500, y: 400, scaleX: 1, scaleY: 1, rotation: 10, flipX: true, z: 1, tint: null, visible: true,
      photo: createDefaultPhoto('data:image/png;base64,iVBORw0KGgo=', 640, 480),
    },
  ];
  s.world = [{ id: 'w1', assetId: 'A048', x: 200, y: 600, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, z: 0, tint: '#aab8a0', visible: true }];
  s.innerBackground = { kind: 'preset', presetId: 'BG02', x: 500, y: 500, scale: 1.2, rotation: 0 };
  s.outerBackground = { kind: 'photo', photo: createDefaultPhoto('data:image/jpeg;base64,/9j/4AAQ', 100, 100), x: 500, y: 500, scale: 1, rotation: 5 };
  s.profile = { name: '몽실', birthDate: '2026-11-26', traits: ['다정함'], likes: ['코코아'], bio: '안녕' };
  return s;
}

describe('serializeScene / parseScene', () => {
  it('round-trips a valid scene', () => {
    const s = sampleScene();
    const r = parseScene(serializeScene(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(s);
  });

  it('accepts files without kind field (plain scene JSON)', () => {
    const r = parseScene(JSON.stringify(createDefaultScene()));
    expect(r.ok).toBe(true);
  });

  it('rejects malformed JSON and empty text', () => {
    expect(parseScene('{not json').ok).toBe(false);
    expect(parseScene('').ok).toBe(false);
    expect(parseScene('null').ok).toBe(false);
    expect(parseScene('[]').ok).toBe(false);
  });

  it('rejects wrong version and wrong kind', () => {
    const s = JSON.parse(serializeScene(sampleScene()));
    expect(parseScene(JSON.stringify({ ...s, version: 2 }))).toMatchObject({ ok: false });
    expect(parseScene(JSON.stringify({ ...s, kind: 'other-app' }))).toMatchObject({ ok: false });
  });

  const mutations: [string, (o: Record<string, any>) => void][] = [
    ['bad stage', (o) => { o.stage = 'nope'; }],
    ['snowman not array', (o) => { o.snowman = {}; }],
    ['layer x string', (o) => { o.snowman[0].x = '1'; }],
    ['layer NaN-like', (o) => { o.snowman[0].scaleX = null; }],
    ['layer zero scale', (o) => { o.snowman[0].scaleX = 0; }],
    ['bad tint', (o) => { o.world[0].tint = 'green'; }],
    ['flip not bool', (o) => { o.snowman[0].flipX = 1; }],
    ['missing visible', (o) => { delete o.snowman[0].visible; }],
    ['duplicate ids', (o) => { o.world[0].id = 'a1'; }],
    ['photo layer without photo', (o) => { delete o.snowman[1].photo; }],
    ['photo not data url', (o) => { o.snowman[1].photo.dataUrl = 'https://example.com/x.png'; }],
    ['photo saturation range', (o) => { o.snowman[1].photo.saturation = 3; }],
    ['crop missing', (o) => { delete o.snowman[1].photo.crop; }],
    ['non-photo layer with photo', (o) => { o.snowman[0].photo = o.snowman[1].photo; }],
    ['bad container', (o) => { o.containerId = 'cube'; }],
    ['bad base', (o) => { o.baseId = 'A001'; }],
    ['bg kind', (o) => { o.innerBackground.kind = 'video'; }],
    ['preset without id', (o) => { delete o.innerBackground.presetId; }],
    ['photo bg without photo', (o) => { delete o.outerBackground.photo; }],
    ['profile traits not array', (o) => { o.profile.traits = '다정함'; }],
    ['profile trait not string', (o) => { o.profile.likes = [1]; }],
    ['bad birthDate', (o) => { o.profile.birthDate = '26/11/2026'; }],
    ['camera shadow range', (o) => { o.cameraPlacement.shadow = 2; }],
    ['missing profile', (o) => { delete o.profile; }],
    ['bad id chars', (o) => { o.snowman[0].id = '<script>'; }],
  ];
  it.each(mutations)('rejects invalid schema: %s', (_name, mutate) => {
    const o = JSON.parse(serializeScene(sampleScene()));
    mutate(o);
    const r = parseScene(JSON.stringify(o));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/올바르지|지원하지|아닙니다/);
  });
});

describe('pixels', () => {
  it('parses hex and luminance', () => {
    expect(hexToRgb('#bd716b')).toEqual([189, 113, 107]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 6);
  });

  it('tints preserving alpha and relative brightness without touching source', () => {
    const src = new Uint8ClampedArray([
      200, 200, 200, 255, // 밝음
      100, 100, 100, 255, // 어두움
      50, 50, 50, 0, // 투명
    ]);
    const copy = new Uint8ClampedArray(src);
    const out = tintPixels(src, '#bd716b');
    expect(src).toEqual(copy);
    expect(out[3]).toBe(255);
    expect(out[11]).toBe(0);
    // 밝은 픽셀이 어두운 픽셀보다 밝다 (질감 보존)
    expect(luminance(out[0], out[1], out[2])).toBeGreaterThan(luminance(out[4], out[5], out[6]));
    // 색조가 tint 쪽 (빨강 > 초록)
    expect(out[4]).toBeGreaterThan(out[5]);
  });

  it('adjusts saturation/brightness/contrast; identity is no-op', () => {
    const d = new Uint8ClampedArray([200, 100, 50, 255]);
    adjustPixels(d, 1, 1, 1);
    expect([...d]).toEqual([200, 100, 50, 255]);
    adjustPixels(d, 0, 1, 1);
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    const b = new Uint8ClampedArray([100, 100, 100, 255]);
    adjustPixels(b, 1, 1.5, 1);
    expect(b[0]).toBe(150);
  });

  it('builds a feathered mask', () => {
    expect(ellipseMaskAlpha(0, 0, 0.3)).toBe(1);
    expect(ellipseMaskAlpha(1, 0, 0.3)).toBe(0);
    const mid = ellipseMaskAlpha(0.85, 0, 0.3);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(ellipseMaskAlpha(0.8, 0.8, 0.3)).toBe(0);
  });

  it('seeded random is deterministic', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('particles', () => {
  it('starts settled, flies on shake, and settles again', () => {
    const flakes = createFlakes(30, 3);
    expect(flakes.every((f) => f.settled)).toBe(true);
    expect(stepFlakes(flakes, 0.016, 0)).toBe(false);
    shakeFlakes(flakes, 1, 42);
    expect(flakes.every((f) => !f.settled)).toBe(true);
    let t = 0;
    let moving = true;
    for (let i = 0; i < 3000 && moving; i++) {
      t += 0.05;
      moving = stepFlakes(flakes, 0.05, t);
    }
    expect(moving).toBe(false);
    expect(flakes.every((f) => f.y >= SNOW_FLOOR_Y - 10)).toBe(true);
  });

  it('floating flakes are deterministic per time', () => {
    expect(floatingFlakesAt(0.3)).toEqual(floatingFlakesAt(0.3));
    expect(floatingFlakesAt(0.3)[0].y).not.toBe(floatingFlakesAt(0.6)[0].y);
  });
});

describe('certificate text helpers', () => {
  const measure = (s: string) => s.length * 10;
  it('wraps by words and characters with ellipsis', () => {
    expect(wrapText(measure, '가나다 라마바', 40, 3)).toEqual(['가나다', '라마바']);
    expect(wrapText(measure, '가나다라마바사아', 30, 5)).toEqual(['가나다', '라마바', '사아']);
    const cut = wrapText(measure, '가나다라마바사아자차', 30, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1].endsWith('…')).toBe(true);
    expect(wrapText(measure, '첫줄\n둘째', 100, 5)).toEqual(['첫줄', '둘째']);
  });
  it('formats birth date', () => {
    expect(formatBirthDate('2026-01-05')).toBe('2026년 1월 5일');
    expect(formatBirthDate('')).toBe('');
  });
});
