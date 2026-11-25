// workshop-ui 소유: 임시 에셋용 양모 펠트 Canvas 드로잉 헬퍼.
// 임시 에셋은 최종 에셋이 아니다. 투명 배경, 글자 없음, 좌상단 자연광, 확정 팔레트.

export const PAL = {
  cream: '#F5F0E6',
  wool: '#FEFCF7',
  oat: '#E5DACB',
  oak: '#91765E',
  sage: '#AAB8A0',
  snow: '#BDD5DF',
  berry: '#BD716B',
  cocoa: '#78634F',
  // 보조 톤 (팔레트 파생)
  sageDeep: '#7F9277',
  oakDeep: '#6E5643',
  ink: '#3B3029',
  carrot: '#D98A4E',
  blushPink: '#E2A3A0',
  blushPeach: '#EDB896',
  gold: '#C9A55A',
} as const;

/** 결정적 난수 (같은 에셋은 항상 같은 모양) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(hex);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amt -1..1 : 음수 = 어둡게, 양수 = 밝게 */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const m = (c: number) => Math.round(c + (t - c) * p);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FeltOptions {
  box: Box;
  seed?: number;
  /** 섬유 밀도 배율 (기본 1) */
  fibers?: number;
  /** 가장자리 보풀 강도 (기본 1) */
  fuzz?: number;
  /** 드롭 섀도 강도 (기본 1, 0 = 없음) */
  shadow?: number;
  /** 바느질 선 */
  stitch?: { path: Path2D; color?: string; width?: number; dash?: number };
  /** 하이라이트 강도 (기본 1) */
  light?: number;
}

// ── 섬유 패턴 (성능: 수천 개 stroke 대신 작은 타일 1장을 미리 그려 재사용) ──
const FIBER_TILE = 128;
let fiberTile: HTMLCanvasElement | null = null;
let fiberTileFine: HTMLCanvasElement | null = null;

function makeFiberTile(seed: number, count: number, lightA: number, darkA: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = FIBER_TILE;
  c.height = FIBER_TILE;
  const t = c.getContext('2d');
  if (!t) return c;
  const r = rng(seed);
  t.lineCap = 'round';
  // 타일 경계에서 이어지도록 3x3 위치에 반복해 그림
  for (let i = 0; i < count; i++) {
    const x = r() * FIBER_TILE;
    const y = r() * FIBER_TILE;
    const len = 3 + r() * 9;
    const a = r() * Math.PI * 2;
    const light = r() > 0.5;
    t.strokeStyle = light ? `rgba(255,255,255,${lightA * (0.5 + r())})` : `rgba(70,50,35,${darkA * (0.5 + r())})`;
    t.lineWidth = 0.5 + r() * 0.9;
    t.beginPath();
    for (const ox of [-FIBER_TILE, 0, FIBER_TILE]) {
      for (const oy of [-FIBER_TILE, 0, FIBER_TILE]) {
        const sx = x + ox;
        const sy = y + oy;
        if (sx < -14 || sy < -14 || sx > FIBER_TILE + 14 || sy > FIBER_TILE + 14) continue;
        t.moveTo(sx, sy);
        t.quadraticCurveTo(sx + Math.cos(a + 0.6) * len * 0.5, sy + Math.sin(a + 0.6) * len * 0.5, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      }
    }
    t.stroke();
  }
  return c;
}

function fiberPattern(ctx: CanvasRenderingContext2D, fine = false): CanvasPattern | null {
  if (fine) fiberTileFine ??= makeFiberTile(7331, 520, 0.2, 0.1);
  else fiberTile ??= makeFiberTile(1337, 900, 0.17, 0.08);
  return ctx.createPattern(fine ? fiberTileFine! : fiberTile!, 'repeat');
}

/** 클립된 영역에 섬유 패턴을 채운다 (offset/회전으로 반복감 완화) */
export function fillFibers(ctx: CanvasRenderingContext2D, box: Box, seed: number, density = 1, fine = false): void {
  const pat = fiberPattern(ctx, fine);
  if (!pat) return;
  const r = rng(seed);
  const unit = ctx.canvas.width / 512;
  const layers = density > 1.15 ? 2 : 1;
  for (let k = 0; k < layers; k++) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, density / layers + 0.15);
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.rotate(r() * Math.PI * 2);
    ctx.scale(unit, unit);
    ctx.translate(r() * FIBER_TILE, r() * FIBER_TILE);
    ctx.fillStyle = pat;
    const R = (Math.max(box.w, box.h) / unit) * 0.75 + FIBER_TILE;
    ctx.fillRect(-R - FIBER_TILE, -R - FIBER_TILE, R * 2 + FIBER_TILE, R * 2 + FIBER_TILE);
    ctx.restore();
  }
}

/** 저해상도 오프스크린에서 흐린 그림자를 만들어 확대해 붙인다 (shadowBlur 비용 1/16) */
function softShadow(ctx: CanvasRenderingContext2D, path: Path2D, size: number, strength: number): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const k = 0.25;
  const sc = document.createElement('canvas');
  sc.width = Math.max(1, Math.ceil(cw * k));
  sc.height = Math.max(1, Math.ceil(ch * k));
  const s = sc.getContext('2d');
  if (!s) return;
  const far = cw * 4;
  s.setTransform(k, 0, 0, k, 0, 0);
  // 현재 변환 반영
  const m = ctx.getTransform();
  s.transform(m.a, m.b, m.c, m.d, m.e - far, m.f);
  s.shadowColor = `rgba(60,45,30,${0.28 * strength})`;
  s.shadowBlur = size * 0.06 * k * Math.hypot(m.a, m.b);
  s.shadowOffsetX = (far + size * 0.02 * m.a) * k;
  s.shadowOffsetY = size * 0.035 * k * m.d;
  s.fillStyle = '#000';
  s.fill(path);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sc, 0, 0, cw, ch);
  ctx.restore();
}

/**
 * 펠트 덩어리 하나를 그린다: 부드러운 그림자 → 좌상단 광원 그라디언트 →
 * 섬유 노이즈(패턴) → 가장자리 보풀 → (선택) 바느질.
 */
export function felt(ctx: CanvasRenderingContext2D, path: Path2D, color: string, o: FeltOptions): void {
  const { box } = o;
  const size = Math.max(box.w, box.h);
  const seed = o.seed ?? seedOf(color + box.x + box.y);
  const unit = ctx.canvas.width / 512;

  // 1) 그림자 (오른쪽 아래)
  const sh = o.shadow ?? 1;
  if (sh > 0) softShadow(ctx, path, size, sh);

  // 2) 바탕 그라디언트 (좌상단 광원)
  const lx = box.x + box.w * 0.3;
  const ly = box.y + box.h * 0.25;
  const g = ctx.createRadialGradient(lx, ly, size * 0.02, box.x + box.w * 0.55, box.y + box.h * 0.6, size * 0.75);
  const lt = o.light ?? 1;
  g.addColorStop(0, shade(color, 0.35 * lt));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.28));
  ctx.fillStyle = g;
  ctx.fill(path);

  // 3) 섬유 노이즈 + 안쪽 음영 (클립 내부)
  ctx.save();
  ctx.clip(path);
  const fib = o.fibers ?? 1;
  if (fib > 0) fillFibers(ctx, box, seed, fib);
  const rim = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  rim.addColorStop(0, 'rgba(255,255,255,0.10)');
  rim.addColorStop(0.55, 'rgba(255,255,255,0)');
  rim.addColorStop(1, 'rgba(60,40,25,0.16)');
  ctx.fillStyle = rim;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();

  // 4) 가장자리 보풀: 섬유 패턴으로 테두리를 한 번 굵게 stroke (점선 반복 제거)
  const fz = o.fuzz ?? 1;
  if (fz > 0) {
    const pat = fiberPattern(ctx, true);
    ctx.save();
    ctx.lineWidth = 3.2 * unit * fz;
    ctx.strokeStyle = rgba(PAL.wool, 0.22);
    ctx.stroke(path);
    if (pat) {
      ctx.strokeStyle = pat;
      ctx.lineWidth = 5 * unit * fz;
      ctx.globalAlpha *= 0.9;
      ctx.stroke(path);
    }
    ctx.restore();
  }

  // 5) 바느질
  if (o.stitch) stitch(ctx, o.stitch.path, o.stitch.color ?? rgba(PAL.cocoa, 0.75), o.stitch.width, o.stitch.dash);
}

export function stitch(ctx: CanvasRenderingContext2D, path: Path2D, color: string, width?: number, dash?: number): void {
  const unit = ctx.canvas.width / 512;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([(dash ?? 7) * unit, (dash ?? 7) * 0.8 * unit]);
  ctx.lineWidth = (width ?? 2.2) * unit;
  // 실 그림자
  ctx.strokeStyle = 'rgba(60,40,25,0.25)';
  ctx.translate(0.8 * unit, 1 * unit);
  ctx.stroke(path);
  ctx.translate(-0.8 * unit, -1 * unit);
  ctx.strokeStyle = color;
  ctx.stroke(path);
  ctx.restore();
}

/** 털실/뜨개 질감: 평행한 V자 니트 이랑 */
export function knitRibs(ctx: CanvasRenderingContext2D, path: Path2D, box: Box, color: string, vertical = true, spacing = 14): void {
  const unit = ctx.canvas.width / 512;
  const s = spacing * unit;
  ctx.save();
  ctx.clip(path);
  ctx.lineWidth = 1.6 * unit;
  ctx.strokeStyle = shade(color, -0.3);
  ctx.globalAlpha = 0.4;
  if (vertical) {
    for (let x = box.x; x < box.x + box.w; x += s) {
      ctx.beginPath();
      for (let y = box.y; y < box.y + box.h; y += s * 0.7) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + s * 0.5, y + s * 0.35);
        ctx.lineTo(x + s, y);
      }
      ctx.stroke();
    }
  } else {
    for (let y = box.y; y < box.y + box.h; y += s) {
      ctx.beginPath();
      for (let x = box.x; x < box.x + box.w; x += s * 0.7) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + s * 0.35, y + s * 0.5);
        ctx.lineTo(x, y + s);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Path 빌더 ───────────────────────────────────────────────
export function circle(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.arcTo(x + w, y, x + w, y + h, rr);
  p.arcTo(x + w, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr);
  p.arcTo(x, y, x + w, y, rr);
  p.closePath();
  return p;
}

/** 불규칙한 양모 덩어리 (반지름 흔들림) */
export function blob(cx: number, cy: number, rx: number, ry: number, wobble: number, seed: number, pts = 14): Path2D {
  const r = rng(seed);
  const radii = Array.from({ length: pts }, () => 1 + (r() - 0.5) * 2 * wobble);
  const p = new Path2D();
  const pt = (i: number) => {
    const a = (i / pts) * Math.PI * 2;
    const k = radii[((i % pts) + pts) % pts];
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const;
  };
  const [sx, sy] = pt(0);
  const [nx, ny] = pt(1);
  p.moveTo((sx + nx) / 2, (sy + ny) / 2);
  for (let i = 1; i <= pts; i++) {
    const [x, y] = pt(i);
    const [x2, y2] = pt(i + 1);
    p.quadraticCurveTo(x, y, (x + x2) / 2, (y + y2) / 2);
  }
  p.closePath();
  return p;
}

export function star(cx: number, cy: number, ro: number, ri: number, n = 5, rot = -Math.PI / 2): Path2D {
  const p = new Path2D();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

export function heart(cx: number, cy: number, s: number): Path2D {
  const p = new Path2D();
  p.moveTo(cx, cy + s * 0.9);
  p.bezierCurveTo(cx - s * 1.3, cy + s * 0.1, cx - s * 0.9, cy - s * 0.95, cx, cy - s * 0.35);
  p.bezierCurveTo(cx + s * 0.9, cy - s * 0.95, cx + s * 1.3, cy + s * 0.1, cx, cy + s * 0.9);
  p.closePath();
  return p;
}

/** 단추: 원 + 구멍 4개 + 실 */
export function button(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, holes = 4, seed = 1): void {
  felt(ctx, circle(cx, cy, r), color, { box: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, seed, fibers: 0.4, fuzz: 0.3 });
  // 테두리 홈
  ctx.save();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = 'rgba(40,25,15,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  // 반짝임
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.42, r * 0.28, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  const hs = holes === 2 ? [[-0.22, 0], [0.22, 0]] : [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
  ctx.fillStyle = 'rgba(30,20,12,0.65)';
  for (const [hx, hy] of hs) {
    ctx.beginPath();
    ctx.arc(cx + hx * r, cy + hy * r, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(PAL.wool, 0.85);
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (holes === 2) {
    ctx.moveTo(cx - 0.22 * r, cy);
    ctx.lineTo(cx + 0.22 * r, cy);
  } else {
    ctx.moveTo(cx - 0.2 * r, cy - 0.2 * r);
    ctx.lineTo(cx + 0.2 * r, cy + 0.2 * r);
    ctx.moveTo(cx + 0.2 * r, cy - 0.2 * r);
    ctx.lineTo(cx - 0.2 * r, cy + 0.2 * r);
  }
  ctx.stroke();
  ctx.restore();
}

/** 털실 꼬임 줄 (리본·끈) */
export function yarn(ctx: CanvasRenderingContext2D, path: Path2D, color: string, width: number): void {
  const unit = ctx.canvas.width / 512;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(60,40,25,0.3)';
  ctx.shadowBlur = width * 0.6;
  ctx.shadowOffsetX = width * 0.15;
  ctx.shadowOffsetY = width * 0.25;
  ctx.strokeStyle = shade(color, -0.12);
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width * 0.78;
  ctx.stroke(path);
  // 꼬임 무늬
  ctx.setLineDash([width * 0.35, width * 0.35]);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = width * 0.3;
  ctx.stroke(path);
  ctx.setLineDash([1.5 * unit, 3 * unit]);
  ctx.strokeStyle = 'rgba(70,50,35,0.18)';
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();
}

/** 원목 결 */
export function woodGrain(ctx: CanvasRenderingContext2D, path: Path2D, box: Box, color: string, seed: number, horizontal = true): void {
  felt(ctx, path, color, { box, seed, fibers: 0.25, fuzz: 0, light: 0.6 });
  const r = rng(seed + 7);
  const unit = ctx.canvas.width / 512;
  ctx.save();
  ctx.clip(path);
  const lines = Math.round((horizontal ? box.h : box.w) / (6 * unit));
  for (let i = 0; i < lines; i++) {
    ctx.strokeStyle = r() > 0.5 ? 'rgba(60,40,22,0.18)' : 'rgba(255,240,220,0.12)';
    ctx.lineWidth = (0.6 + r() * 1.6) * unit;
    ctx.beginPath();
    if (horizontal) {
      const y = box.y + (i + r()) * (box.h / lines);
      ctx.moveTo(box.x, y);
      for (let x = box.x; x <= box.x + box.w; x += box.w / 6) ctx.lineTo(x, y + (r() - 0.5) * 4 * unit);
    } else {
      const x = box.x + (i + r()) * (box.w / lines);
      ctx.moveTo(x, box.y);
      for (let y = box.y; y <= box.y + box.h; y += box.h / 6) ctx.lineTo(x + (r() - 0.5) * 4 * unit, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 작은 양모 눈송이 점 (포근한 펠트 볼) */
export function woolDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string = PAL.wool, seed = 3): void {
  felt(ctx, circle(cx, cy, r), color, { box: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, seed, fibers: 1.2, fuzz: 0.6, shadow: 0.6 });
}

/** 수놓은 눈꽃 (글자 아님, 장식 스티치) */
export function snowflakeStitch(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  const unit = ctx.canvas.width / 512;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8 * unit;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ex = cx + Math.cos(a) * r;
    const ey = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    const mx = cx + Math.cos(a) * r * 0.6;
    const my = cy + Math.sin(a) * r * 0.6;
    for (const d of [-0.5, 0.5]) {
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a + d) * r * 0.3, my + Math.sin(a + d) * r * 0.3);
    }
    ctx.stroke();
  }
  ctx.restore();
}
