// workshop-ui 소유: 꾸미기 65종 임시 에셋 드로어 (최종 에셋 아님).
// 각 에셋은 정사각 프레임 중앙 정렬, 투명 배경, 글자 없음.
import type { PlaceholderDrawer } from './index';
import {
  PAL, blob, button, circle, ellipse, felt, heart, knitRibs, rgba, rng, roundRect,
  seedOf, shade, star, stitch, woodGrain, woolDot, yarn,
} from './felt';
import { BASE_GEOMETRY, GLASS_HIGHLIGHT, glassInteriorPath } from './geometry';
import type { ContainerId } from '../../types/scene';

type D = PlaceholderDrawer;
const bx = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

// ── body ─────────────────────────────────────────────────────
const bodyRound: D = (ctx, w) => {
  const r = w * 0.46;
  felt(ctx, circle(w / 2, w / 2, r), PAL.wool, { box: bx(w / 2 - r, w / 2 - r, r * 2, r * 2), seed: 11, fibers: 1.4, fuzz: 1.4, shadow: 0.6 });
};
const bodyOval: D = (ctx, w) => {
  const rx = w * 0.39;
  const ry = w * 0.46;
  felt(ctx, ellipse(w / 2, w / 2, rx, ry), PAL.wool, { box: bx(w / 2 - rx, w / 2 - ry, rx * 2, ry * 2), seed: 12, fibers: 1.4, fuzz: 1.4, shadow: 0.6 });
};
const bodyIrregular: D = (ctx, w) => {
  const r = w * 0.43;
  felt(ctx, blob(w / 2, w / 2, r, r * 0.97, 0.07, 13, 11), PAL.wool, { box: bx(w / 2 - r, w / 2 - r, r * 2, r * 2), seed: 13, fibers: 1.4, fuzz: 1.6, shadow: 0.6 });
};

// ── eyes (한 쌍) ──────────────────────────────────────────────
const eyePair = (draw: (cx: number, cy: number, r: number, i: number) => void, w: number) => {
  const r = w * 0.1;
  draw(w * 0.3, w / 2, r, 0);
  draw(w * 0.7, w / 2, r, 1);
};
const eyesBlack: D = (ctx, w) => eyePair((x, y, r, i) => button(ctx, x, y, r, PAL.ink, 2, 20 + i), w);
const eyesBrown: D = (ctx, w) => eyePair((x, y, r, i) => button(ctx, x, y, r, PAL.cocoa, 2, 22 + i), w);
const eyesBead: D = (ctx, w) =>
  eyePair((x, y, r, i) => {
    felt(ctx, ellipse(x, y, r * 0.75, r * 0.85), '#1f1a17', { box: bx(x - r, y - r, r * 2, r * 2), seed: 24 + i, fibers: 0.1, fuzz: 0 });
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.35, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }, w);
const eyesEmbroidered: D = (ctx, w) =>
  eyePair((x, y, r) => {
    const p = new Path2D();
    p.arc(x, y + r * 0.4, r * 0.9, Math.PI * 1.15, Math.PI * 1.85);
    stitch(ctx, p, PAL.ink, 4.5, 5);
    // 속눈썹 스티치
    const q = new Path2D();
    for (const a of [1.25, 1.5, 1.75]) {
      const ax = x + Math.cos(Math.PI * a) * r * 0.9;
      const ay = y + r * 0.4 + Math.sin(Math.PI * a) * r * 0.9;
      q.moveTo(ax, ay);
      q.lineTo(ax + Math.cos(Math.PI * a) * r * 0.35, ay + Math.sin(Math.PI * a) * r * 0.35);
    }
    stitch(ctx, q, PAL.ink, 2.5, 30);
  }, w);

// ── nose ─────────────────────────────────────────────────────
const noseCarrot: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.36, w * 0.4);
  p.quadraticCurveTo(w * 0.3, w * 0.5, w * 0.36, w * 0.6);
  p.quadraticCurveTo(w * 0.6, w * 0.56, w * 0.82, w * 0.52);
  p.quadraticCurveTo(w * 0.6, w * 0.44, w * 0.36, w * 0.4);
  p.closePath();
  felt(ctx, p, PAL.carrot, { box: bx(w * 0.3, w * 0.4, w * 0.52, w * 0.2), seed: 30, fibers: 1.4 });
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = 'rgba(120,60,20,0.35)';
  ctx.lineWidth = w * 0.006;
  for (let i = 0; i < 4; i++) {
    const x = w * (0.42 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, w * 0.43);
    ctx.quadraticCurveTo(x + w * 0.015, w * 0.5, x, w * 0.57);
    ctx.stroke();
  }
  ctx.restore();
};
const noseWool: D = (ctx, w) => woolDot(ctx, w / 2, w / 2, w * 0.17, PAL.carrot, 31);
const noseButton: D = (ctx, w) => button(ctx, w / 2, w / 2, w * 0.17, PAL.oak, 4, 32);

// ── mouth ────────────────────────────────────────────────────
const beadArc = (ctx: CanvasRenderingContext2D, w: number, n: number, spread: number, depth: number, seed: number) => {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = Math.PI * (0.5 + (t - 0.5) * spread);
    const x = w / 2 + Math.cos(a) * w * 0.38 * (spread > 0.5 ? 1 : 0.8);
    const y = w * (0.5 - depth) + Math.sin(a) * w * depth * 2.2;
    woolDot(ctx, x, y, w * 0.045, PAL.ink, seed + i);
  }
};
const mouthSmile: D = (ctx, w) => beadArc(ctx, w, 5, 0.55, 0.12, 40);
const mouthWide: D = (ctx, w) => beadArc(ctx, w, 7, 0.75, 0.13, 41);
const mouthNeutral: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.3, w * 0.5);
  p.quadraticCurveTo(w * 0.5, w * 0.515, w * 0.7, w * 0.5);
  stitch(ctx, p, PAL.ink, 6, 9);
};
const mouthSurprised: D = (ctx, w) => {
  const outer = circle(w / 2, w / 2, w * 0.12);
  felt(ctx, outer, PAL.ink, { box: bx(w * 0.38, w * 0.38, w * 0.24, w * 0.24), seed: 43, fibers: 0.8 });
  felt(ctx, ellipse(w / 2, w * 0.51, w * 0.065, w * 0.07), PAL.berry, { box: bx(w * 0.43, w * 0.44, w * 0.14, w * 0.14), seed: 44, shadow: 0, fuzz: 0.3 });
};

// ── blush ────────────────────────────────────────────────────
const blushPair = (color: string, seed: number): D => (ctx, w) => {
  for (const [i, x] of [w * 0.28, w * 0.72].entries()) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    const p = blob(x, w / 2, w * 0.15, w * 0.1, 0.06, seed + i, 12);
    felt(ctx, p, color, { box: bx(x - w * 0.15, w * 0.4, w * 0.3, w * 0.2), seed: seed + i, shadow: 0.2, fuzz: 1.6, fibers: 1.4 });
    ctx.restore();
  }
};

// ── hats ─────────────────────────────────────────────────────
const dome = (w: number, top: number, bottom: number, half: number) => {
  const p = new Path2D();
  p.moveTo(w / 2 - half, bottom);
  p.bezierCurveTo(w / 2 - half, top - (bottom - top) * 0.1, w / 2 + half, top - (bottom - top) * 0.1, w / 2 + half, bottom);
  p.closePath();
  return p;
};
const cuff = (ctx: CanvasRenderingContext2D, w: number, y: number, half: number, hgt: number, color: string, seed: number) => {
  const p = roundRect(w / 2 - half, y, half * 2, hgt, hgt * 0.45);
  const b = bx(w / 2 - half, y, half * 2, hgt);
  felt(ctx, p, color, { box: b, seed });
  knitRibs(ctx, p, b, color, true, 12);
};
const beanie = (ctx: CanvasRenderingContext2D, w: number, color: string, seed: number, cuffColor = color) => {
  const d = dome(w, w * 0.2, w * 0.66, w * 0.33);
  felt(ctx, d, color, { box: bx(w * 0.17, w * 0.2, w * 0.66, w * 0.46), seed });
  knitRibs(ctx, d, bx(w * 0.17, w * 0.18, w * 0.66, w * 0.5), color, true, 16);
  cuff(ctx, w, w * 0.6, w * 0.36, w * 0.14, cuffColor, seed + 1);
};
const hatBeanie: D = (ctx, w) => beanie(ctx, w, PAL.oat, 50);
const hatPompom: D = (ctx, w) => {
  beanie(ctx, w, PAL.oat, 51, PAL.cream);
  woolDot(ctx, w / 2, w * 0.2, w * 0.11, PAL.wool, 52);
};
const hatBeret: D = (ctx, w) => {
  const p = ellipse(w / 2, w * 0.52, w * 0.38, w * 0.15, -0.08);
  felt(ctx, p, PAL.berry, { box: bx(w * 0.12, w * 0.37, w * 0.76, w * 0.3), seed: 53, stitch: { path: ellipse(w / 2, w * 0.54, w * 0.3, w * 0.09, -0.08), color: rgba(PAL.wool, 0.6) } });
  felt(ctx, roundRect(w * 0.48, w * 0.32, w * 0.04, w * 0.08, w * 0.02), shade(PAL.berry, -0.15), { box: bx(w * 0.48, w * 0.32, w * 0.04, w * 0.08), seed: 54, fuzz: 0.3 });
};
const hatSanta: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.2, w * 0.66);
  p.bezierCurveTo(w * 0.25, w * 0.35, w * 0.45, w * 0.18, w * 0.72, w * 0.24);
  p.quadraticCurveTo(w * 0.62, w * 0.35, w * 0.8, w * 0.66);
  p.closePath();
  felt(ctx, p, PAL.berry, { box: bx(w * 0.2, w * 0.18, w * 0.6, w * 0.48), seed: 55 });
  const t = blob(w / 2, w * 0.68, w * 0.34, w * 0.07, 0.05, 56, 16);
  felt(ctx, t, PAL.wool, { box: bx(w * 0.16, w * 0.6, w * 0.68, w * 0.16), seed: 56, fuzz: 1.6, fibers: 1.4 });
  woolDot(ctx, w * 0.74, w * 0.25, w * 0.08, PAL.wool, 57);
};
const hatTop: D = (ctx, w) => {
  const crown = roundRect(w * 0.3, w * 0.18, w * 0.4, w * 0.44, w * 0.03);
  felt(ctx, crown, PAL.cocoa, { box: bx(w * 0.3, w * 0.18, w * 0.4, w * 0.44), seed: 58 });
  const band = roundRect(w * 0.3, w * 0.5, w * 0.4, w * 0.08, w * 0.01);
  felt(ctx, band, PAL.sage, { box: bx(w * 0.3, w * 0.5, w * 0.4, w * 0.08), seed: 59, shadow: 0, stitch: { path: (() => { const s = new Path2D(); s.moveTo(w * 0.31, w * 0.54); s.lineTo(w * 0.69, w * 0.54); return s; })(), color: rgba(PAL.wool, 0.7), width: 1.6, dash: 5 } });
  felt(ctx, ellipse(w / 2, w * 0.63, w * 0.34, w * 0.065), shade(PAL.cocoa, -0.1), { box: bx(w * 0.16, w * 0.56, w * 0.68, w * 0.13), seed: 60 });
};
const hatEarflap: D = (ctx, w) => {
  for (const s of [-1, 1]) {
    const fl = roundRect(w / 2 + s * w * 0.27 - w * 0.07, w * 0.5, w * 0.14, w * 0.22, w * 0.07);
    felt(ctx, fl, PAL.sage, { box: bx(w / 2 + s * w * 0.27 - w * 0.07, w * 0.5, w * 0.14, w * 0.22), seed: 61 + s });
    const tie = new Path2D();
    tie.moveTo(w / 2 + s * w * 0.27, w * 0.71);
    tie.quadraticCurveTo(w / 2 + s * w * 0.3, w * 0.8, w / 2 + s * w * 0.26, w * 0.88);
    yarn(ctx, tie, PAL.cream, w * 0.022);
  }
  beanie(ctx, w, PAL.sage, 63, PAL.cream);
};

// ── scarf ────────────────────────────────────────────────────
const scarf = (color: string, seed: number, pattern?: 'stripe' | 'check' | 'stitch'): D => (ctx, w) => {
  const band = new Path2D();
  band.moveTo(w * 0.12, w * 0.36);
  band.quadraticCurveTo(w * 0.5, w * 0.5, w * 0.88, w * 0.36);
  band.lineTo(w * 0.88, w * 0.5);
  band.quadraticCurveTo(w * 0.5, w * 0.64, w * 0.12, w * 0.5);
  band.closePath();
  const tail = new Path2D();
  tail.moveTo(w * 0.58, w * 0.5);
  tail.quadraticCurveTo(w * 0.66, w * 0.68, w * 0.6, w * 0.86);
  tail.lineTo(w * 0.74, w * 0.88);
  tail.quadraticCurveTo(w * 0.78, w * 0.66, w * 0.72, w * 0.48);
  tail.closePath();
  const parts: [Path2D, ReturnType<typeof bx>][] = [
    [tail, bx(w * 0.58, w * 0.48, w * 0.2, w * 0.4)],
    [band, bx(w * 0.12, w * 0.36, w * 0.76, w * 0.28)],
  ];
  parts.forEach(([p, b], i) => {
    felt(ctx, p, color, { box: b, seed: seed + i });
    if (pattern !== 'stitch' && pattern !== 'check') knitRibs(ctx, p, b, color, i === 0, 13);
    ctx.save();
    ctx.clip(p);
    if (pattern === 'stripe') {
      ctx.fillStyle = rgba(PAL.wool, 0.55);
      for (let y = b.y; y < b.y + b.h; y += w * 0.08) ctx.fillRect(b.x, y, b.w, w * 0.025);
    } else if (pattern === 'check') {
      ctx.fillStyle = rgba(PAL.berry, 0.35);
      for (let y = b.y; y < b.y + b.h; y += w * 0.06) ctx.fillRect(b.x, y, b.w, w * 0.022);
      for (let x = b.x; x < b.x + b.w; x += w * 0.06) ctx.fillRect(x, b.y, w * 0.022, b.h);
    }
    ctx.restore();
  });
  // 술 장식
  const fr = new Path2D();
  for (let i = 0; i < 5; i++) {
    const x = w * (0.61 + i * 0.03);
    fr.moveTo(x, w * 0.865 + i * 0.004 * w);
    fr.lineTo(x - w * 0.005, w * 0.93);
  }
  ctx.save();
  ctx.strokeStyle = shade(color, -0.1);
  ctx.lineWidth = w * 0.012;
  ctx.lineCap = 'round';
  ctx.stroke(fr);
  ctx.restore();
  if (pattern === 'stitch') {
    const s = new Path2D();
    s.moveTo(w * 0.15, w * 0.43);
    s.quadraticCurveTo(w * 0.5, w * 0.57, w * 0.85, w * 0.43);
    stitch(ctx, s, rgba(PAL.wool, 0.8));
  }
};

// ── arms (한쪽 팔, 반전으로 반대쪽) ────────────────────────────
const armTwig: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.82, w * 0.72);
  p.quadraticCurveTo(w * 0.55, w * 0.55, w * 0.2, w * 0.3);
  p.moveTo(w * 0.42, w * 0.46);
  p.quadraticCurveTo(w * 0.36, w * 0.36, w * 0.38, w * 0.24);
  p.moveTo(w * 0.3, w * 0.37);
  p.lineTo(w * 0.16, w * 0.4);
  p.moveTo(w * 0.6, w * 0.58);
  p.lineTo(w * 0.62, w * 0.46);
  yarn(ctx, p, PAL.oakDeep, w * 0.03);
};
const armWool: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.8, w * 0.7);
  p.quadraticCurveTo(w * 0.55, w * 0.5, w * 0.24, w * 0.32);
  yarn(ctx, p, PAL.oat, w * 0.09);
  woolDot(ctx, w * 0.22, w * 0.31, w * 0.07, PAL.oat, 70);
};
const armMitten: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.82, w * 0.72);
  p.quadraticCurveTo(w * 0.58, w * 0.55, w * 0.34, w * 0.4);
  yarn(ctx, p, PAL.oakDeep, w * 0.03);
  const m = blob(w * 0.27, w * 0.33, w * 0.11, w * 0.13, 0.04, 71, 12);
  felt(ctx, m, PAL.sage, { box: bx(w * 0.16, w * 0.2, w * 0.22, w * 0.26), seed: 71 });
  felt(ctx, ellipse(w * 0.36, w * 0.28, w * 0.04, w * 0.06, 0.5), PAL.sage, { box: bx(w * 0.32, w * 0.22, w * 0.08, w * 0.12), seed: 72 });
  cuffAt(ctx, w * 0.33, w * 0.43, w * 0.09, w * 0.05, -0.6);
};
const cuffAt = (ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, rot: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const p = roundRect(-hw, -hh, hw * 2, hh * 2, hh);
  felt(ctx, p, PAL.cream, { box: bx(-hw, -hh, hw * 2, hh * 2), seed: 73 });
  ctx.restore();
};

// ── clothes ──────────────────────────────────────────────────
const torso = (w: number, neckV: boolean) => {
  const p = new Path2D();
  p.moveTo(w * 0.3, w * 0.22);
  if (neckV) {
    p.lineTo(w * 0.42, w * 0.22);
    p.lineTo(w * 0.5, w * 0.42);
    p.lineTo(w * 0.58, w * 0.22);
  } else p.quadraticCurveTo(w * 0.5, w * 0.32, w * 0.7, w * 0.22);
  p.lineTo(w * 0.7, w * 0.22);
  p.quadraticCurveTo(w * 0.86, w * 0.4, w * 0.8, w * 0.8);
  p.quadraticCurveTo(w * 0.5, w * 0.86, w * 0.2, w * 0.8);
  p.quadraticCurveTo(w * 0.14, w * 0.4, w * 0.3, w * 0.22);
  p.closePath();
  return p;
};
const clothVest: D = (ctx, w) => {
  const p = torso(w, true);
  const b = bx(w * 0.14, w * 0.22, w * 0.72, w * 0.64);
  felt(ctx, p, PAL.sage, { box: b, seed: 80 });
  knitRibs(ctx, p, b, PAL.sage, true, 14);
};
const clothCape: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.38, w * 0.24);
  p.lineTo(w * 0.62, w * 0.24);
  p.quadraticCurveTo(w * 0.8, w * 0.5, w * 0.86, w * 0.82);
  p.quadraticCurveTo(w * 0.5, w * 0.9, w * 0.14, w * 0.82);
  p.quadraticCurveTo(w * 0.2, w * 0.5, w * 0.38, w * 0.24);
  p.closePath();
  const sp = new Path2D();
  sp.moveTo(w * 0.18, w * 0.78);
  sp.quadraticCurveTo(w * 0.5, w * 0.85, w * 0.82, w * 0.78);
  felt(ctx, p, PAL.berry, { box: bx(w * 0.14, w * 0.24, w * 0.72, w * 0.66), seed: 81, stitch: { path: sp, color: rgba(PAL.wool, 0.75) } });
  const collar = ellipse(w / 2, w * 0.26, w * 0.16, w * 0.06);
  felt(ctx, collar, PAL.cream, { box: bx(w * 0.34, w * 0.2, w * 0.32, w * 0.12), seed: 82 });
  woolDot(ctx, w / 2, w * 0.3, w * 0.03, PAL.gold, 83);
};
const clothCoat: D = (ctx, w) => {
  const p = torso(w, true);
  felt(ctx, p, PAL.cocoa, { box: bx(w * 0.14, w * 0.22, w * 0.72, w * 0.64), seed: 84 });
  const sp = new Path2D();
  sp.moveTo(w * 0.5, w * 0.42);
  sp.lineTo(w * 0.5, w * 0.82);
  stitch(ctx, sp, rgba(PAL.oat, 0.7));
  for (let i = 0; i < 3; i++) button(ctx, w * 0.56, w * (0.5 + i * 0.1), w * 0.03, PAL.oat, 4, 85 + i);
};

// ── decor ────────────────────────────────────────────────────
const decorRibbon: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w / 2, w / 2);
  p.bezierCurveTo(w * 0.3, w * 0.3, w * 0.14, w * 0.42, w * 0.22, w * 0.54);
  p.bezierCurveTo(w * 0.28, w * 0.62, w * 0.42, w * 0.56, w / 2, w / 2);
  p.bezierCurveTo(w * 0.7, w * 0.3, w * 0.86, w * 0.42, w * 0.78, w * 0.54);
  p.bezierCurveTo(w * 0.72, w * 0.62, w * 0.58, w * 0.56, w / 2, w / 2);
  p.moveTo(w * 0.49, w * 0.52);
  p.quadraticCurveTo(w * 0.42, w * 0.66, w * 0.36, w * 0.78);
  p.moveTo(w * 0.51, w * 0.52);
  p.quadraticCurveTo(w * 0.58, w * 0.66, w * 0.66, w * 0.76);
  yarn(ctx, p, PAL.wool, w * 0.045);
  woolDot(ctx, w / 2, w / 2, w * 0.045, PAL.wool, 90);
};
const decorHeart: D = (ctx, w) => {
  const p = heart(w / 2, w / 2, w * 0.3);
  const s = new Path2D();
  // 안쪽 바느질: 축소 하트
  s.addPath(heart(w / 2, w * 0.505, w * 0.24));
  felt(ctx, p, PAL.berry, { box: bx(w * 0.15, w * 0.2, w * 0.7, w * 0.6), seed: 91, stitch: { path: s, color: rgba(PAL.wool, 0.75) } });
};
const decorGlasses: D = (ctx, w) => {
  ctx.save();
  ctx.lineWidth = w * 0.022;
  ctx.shadowColor = 'rgba(60,40,25,0.35)';
  ctx.shadowBlur = w * 0.015;
  ctx.shadowOffsetX = w * 0.006;
  ctx.shadowOffsetY = w * 0.01;
  const grad = ctx.createLinearGradient(0, w * 0.35, 0, w * 0.65);
  grad.addColorStop(0, shade(PAL.gold, 0.3));
  grad.addColorStop(1, shade(PAL.gold, -0.3));
  ctx.strokeStyle = grad;
  for (const x of [w * 0.32, w * 0.68]) {
    ctx.beginPath();
    ctx.arc(x, w / 2, w * 0.14, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(w * 0.46, w * 0.49);
  ctx.quadraticCurveTo(w / 2, w * 0.45, w * 0.54, w * 0.49);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(189,213,223,0.18)';
  for (const x of [w * 0.32, w * 0.68]) {
    ctx.beginPath();
    ctx.arc(x, w / 2, w * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = w * 0.012;
    ctx.beginPath();
    ctx.arc(x, w / 2, w * 0.1, Math.PI * 1.1, Math.PI * 1.4);
    ctx.stroke();
  }
};

// ── props ────────────────────────────────────────────────────
const gift = (ctx: CanvasRenderingContext2D, w: number, seed: number) => {
  const body = roundRect(w * 0.24, w * 0.4, w * 0.52, w * 0.42, w * 0.03);
  felt(ctx, body, PAL.oat, { box: bx(w * 0.24, w * 0.4, w * 0.52, w * 0.42), seed });
  const lid = roundRect(w * 0.21, w * 0.33, w * 0.58, w * 0.11, w * 0.025);
  felt(ctx, lid, PAL.cream, { box: bx(w * 0.21, w * 0.33, w * 0.58, w * 0.11), seed: seed + 1 });
  const r = new Path2D();
  r.moveTo(w / 2, w * 0.33);
  r.lineTo(w / 2, w * 0.82);
  r.moveTo(w * 0.24, w * 0.6);
  r.lineTo(w * 0.76, w * 0.6);
  yarn(ctx, r, PAL.sage, w * 0.035);
  const bow = new Path2D();
  bow.moveTo(w / 2, w * 0.33);
  bow.bezierCurveTo(w * 0.36, w * 0.16, w * 0.3, w * 0.3, w / 2, w * 0.33);
  bow.bezierCurveTo(w * 0.64, w * 0.16, w * 0.7, w * 0.3, w / 2, w * 0.33);
  yarn(ctx, bow, PAL.sage, w * 0.032);
};
const propGift: D = (ctx, w) => gift(ctx, w, 100);
const propBroom: D = (ctx, w) => {
  ctx.save();
  ctx.translate(w / 2, w / 2);
  ctx.rotate(0.35);
  ctx.translate(-w / 2, -w / 2);
  woodGrain(ctx, roundRect(w * 0.48, w * 0.08, w * 0.04, w * 0.58, w * 0.02), bx(w * 0.48, w * 0.08, w * 0.04, w * 0.58), PAL.oak, 101, false);
  const b = new Path2D();
  b.moveTo(w * 0.44, w * 0.64);
  b.lineTo(w * 0.56, w * 0.64);
  b.quadraticCurveTo(w * 0.66, w * 0.8, w * 0.68, w * 0.92);
  b.lineTo(w * 0.32, w * 0.92);
  b.quadraticCurveTo(w * 0.34, w * 0.8, w * 0.44, w * 0.64);
  b.closePath();
  felt(ctx, b, PAL.gold, { box: bx(w * 0.32, w * 0.64, w * 0.36, w * 0.28), seed: 102 });
  ctx.save();
  ctx.clip(b);
  ctx.strokeStyle = 'rgba(110,80,30,0.4)';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.moveTo(w * (0.45 + i * 0.007), w * 0.64);
    ctx.lineTo(w * (0.32 + i * 0.024), w * 0.93);
    ctx.stroke();
  }
  ctx.restore();
  const tie = new Path2D();
  tie.moveTo(w * 0.43, w * 0.69);
  tie.lineTo(w * 0.57, w * 0.69);
  yarn(ctx, tie, PAL.berry, w * 0.025);
  ctx.restore();
};
const propLantern: D = (ctx, w) => {
  const glow = ctx.createRadialGradient(w / 2, w * 0.55, 0, w / 2, w * 0.55, w * 0.32);
  glow.addColorStop(0, 'rgba(255,214,140,0.55)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, w);
  const body = roundRect(w * 0.36, w * 0.36, w * 0.28, w * 0.38, w * 0.04);
  felt(ctx, body, '#F6D59A', { box: bx(w * 0.36, w * 0.36, w * 0.28, w * 0.38), seed: 103, fibers: 0.4, fuzz: 0.2, light: 1.4 });
  ctx.save();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = w * 0.018;
  ctx.stroke(body);
  ctx.beginPath();
  ctx.moveTo(w / 2, w * 0.36);
  ctx.lineTo(w / 2, w * 0.74);
  ctx.stroke();
  ctx.restore();
  felt(ctx, roundRect(w * 0.32, w * 0.3, w * 0.36, w * 0.07, w * 0.02), PAL.ink, { box: bx(w * 0.32, w * 0.3, w * 0.36, w * 0.07), seed: 104, fuzz: 0.2 });
  felt(ctx, roundRect(w * 0.33, w * 0.73, w * 0.34, w * 0.06, w * 0.02), PAL.ink, { box: bx(w * 0.33, w * 0.73, w * 0.34, w * 0.06), seed: 105, fuzz: 0.2 });
  const h = new Path2D();
  h.arc(w / 2, w * 0.3, w * 0.07, Math.PI, 0);
  yarn(ctx, h, PAL.ink, w * 0.018);
  felt(ctx, ellipse(w / 2, w * 0.56, w * 0.035, w * 0.06), '#FFB347', { box: bx(w * 0.46, w * 0.5, w * 0.08, w * 0.12), seed: 106, shadow: 0, fuzz: 0 });
};
const propCane: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.56, w * 0.88);
  p.lineTo(w * 0.56, w * 0.32);
  p.arc(w * 0.45, w * 0.32, w * 0.11, 0, Math.PI, true);
  p.lineTo(w * 0.34, w * 0.4);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(60,40,25,0.3)';
  ctx.shadowBlur = w * 0.02;
  ctx.shadowOffsetX = w * 0.008;
  ctx.shadowOffsetY = w * 0.012;
  ctx.strokeStyle = PAL.wool;
  ctx.lineWidth = w * 0.07;
  ctx.stroke(p);
  ctx.restore();
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.setLineDash([w * 0.04, w * 0.04]);
  ctx.strokeStyle = PAL.berry;
  ctx.lineWidth = w * 0.07;
  ctx.stroke(p);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = w * 0.015;
  ctx.translate(-w * 0.012, -w * 0.006);
  ctx.stroke(p);
  ctx.restore();
};
const propStar: D = (ctx, w) => {
  const p = star(w / 2, w / 2, w * 0.36, w * 0.16);
  felt(ctx, p, PAL.gold, { box: bx(w * 0.14, w * 0.14, w * 0.72, w * 0.7), seed: 107, stitch: { path: star(w / 2, w * 0.51, w * 0.27, w * 0.12), color: rgba(PAL.wool, 0.7) } });
};

// ── friends ──────────────────────────────────────────────────
const eyeDots = (ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, r: number) => {
  for (const x of [x1, x2]) {
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
};
const friendRabbit: D = (ctx, w) => {
  for (const s of [-1, 1]) {
    const ear = ellipse(w / 2 + s * w * 0.08, w * 0.2, w * 0.055, w * 0.15, s * 0.15);
    felt(ctx, ear, PAL.wool, { box: bx(w / 2 + s * w * 0.08 - w * 0.06, w * 0.05, w * 0.12, w * 0.3), seed: 110 + s });
    felt(ctx, ellipse(w / 2 + s * w * 0.08, w * 0.21, w * 0.025, w * 0.1, s * 0.15), PAL.blushPink, { box: bx(w / 2 + s * w * 0.08 - w * 0.03, w * 0.11, w * 0.06, w * 0.2), seed: 112 + s, shadow: 0, fuzz: 0.4 });
  }
  felt(ctx, ellipse(w / 2, w * 0.68, w * 0.22, w * 0.2), PAL.wool, { box: bx(w * 0.28, w * 0.48, w * 0.44, w * 0.4), seed: 114, fibers: 1.3 });
  felt(ctx, circle(w / 2, w * 0.42, w * 0.15), PAL.wool, { box: bx(w * 0.35, w * 0.27, w * 0.3, w * 0.3), seed: 115, fibers: 1.3 });
  eyeDots(ctx, w * 0.45, w * 0.55, w * 0.41, w * 0.018);
  felt(ctx, ellipse(w / 2, w * 0.46, w * 0.018, w * 0.013), PAL.blushPink, { box: bx(w * 0.48, w * 0.44, w * 0.04, w * 0.03), seed: 116, shadow: 0, fuzz: 0 });
  woolDot(ctx, w * 0.71, w * 0.76, w * 0.045, PAL.wool, 117);
};
const friendFox: D = (ctx, w) => {
  const tail = new Path2D();
  tail.moveTo(w * 0.62, w * 0.78);
  tail.bezierCurveTo(w * 0.95, w * 0.82, w * 0.92, w * 0.45, w * 0.76, w * 0.42);
  tail.bezierCurveTo(w * 0.8, w * 0.58, w * 0.72, w * 0.7, w * 0.6, w * 0.68);
  tail.closePath();
  felt(ctx, tail, PAL.carrot, { box: bx(w * 0.6, w * 0.42, w * 0.32, w * 0.4), seed: 120 });
  woolDot(ctx, w * 0.77, w * 0.44, w * 0.04, PAL.wool, 121);
  felt(ctx, ellipse(w / 2, w * 0.68, w * 0.18, w * 0.18), PAL.carrot, { box: bx(w * 0.32, w * 0.5, w * 0.36, w * 0.36), seed: 122 });
  felt(ctx, ellipse(w / 2, w * 0.7, w * 0.09, w * 0.12), PAL.wool, { box: bx(w * 0.41, w * 0.58, w * 0.18, w * 0.24), seed: 123, shadow: 0 });
  for (const s of [-1, 1]) {
    const e = new Path2D();
    e.moveTo(w / 2 + s * w * 0.05, w * 0.32);
    e.lineTo(w / 2 + s * w * 0.15, w * 0.18);
    e.lineTo(w / 2 + s * w * 0.16, w * 0.36);
    e.closePath();
    felt(ctx, e, PAL.carrot, { box: bx(w / 2 - w * 0.17, w * 0.18, w * 0.34, w * 0.2), seed: 124 + s });
  }
  const head = new Path2D();
  head.moveTo(w * 0.33, w * 0.36);
  head.quadraticCurveTo(w / 2, w * 0.24, w * 0.67, w * 0.36);
  head.quadraticCurveTo(w * 0.6, w * 0.5, w / 2, w * 0.54);
  head.quadraticCurveTo(w * 0.4, w * 0.5, w * 0.33, w * 0.36);
  head.closePath();
  felt(ctx, head, PAL.carrot, { box: bx(w * 0.33, w * 0.28, w * 0.34, w * 0.26), seed: 126 });
  felt(ctx, ellipse(w / 2, w * 0.47, w * 0.07, w * 0.06), PAL.wool, { box: bx(w * 0.43, w * 0.41, w * 0.14, w * 0.12), seed: 127, shadow: 0 });
  eyeDots(ctx, w * 0.44, w * 0.56, w * 0.39, w * 0.017);
  woolDot(ctx, w / 2, w * 0.51, w * 0.016, PAL.ink, 128);
};
const friendBear: D = (ctx, w) => {
  for (const s of [-1, 1]) {
    felt(ctx, circle(w / 2 + s * w * 0.12, w * 0.24, w * 0.06), PAL.oak, { box: bx(w / 2 + s * w * 0.12 - w * 0.06, w * 0.18, w * 0.12, w * 0.12), seed: 130 + s });
  }
  felt(ctx, ellipse(w / 2, w * 0.68, w * 0.22, w * 0.2), PAL.oak, { box: bx(w * 0.28, w * 0.48, w * 0.44, w * 0.4), seed: 132 });
  felt(ctx, circle(w / 2, w * 0.38, w * 0.16), PAL.oak, { box: bx(w * 0.34, w * 0.22, w * 0.32, w * 0.32), seed: 133 });
  felt(ctx, ellipse(w / 2, w * 0.44, w * 0.07, w * 0.055), PAL.oat, { box: bx(w * 0.43, w * 0.39, w * 0.14, w * 0.11), seed: 134, shadow: 0 });
  woolDot(ctx, w / 2, w * 0.42, w * 0.02, PAL.ink, 135);
  eyeDots(ctx, w * 0.44, w * 0.56, w * 0.36, w * 0.017);
  felt(ctx, ellipse(w / 2, w * 0.7, w * 0.11, w * 0.1), PAL.oat, { box: bx(w * 0.39, w * 0.6, w * 0.22, w * 0.2), seed: 136, shadow: 0 });
};
const friendBird: D = (ctx, w) => {
  const tail = new Path2D();
  tail.moveTo(w * 0.66, w * 0.56);
  tail.lineTo(w * 0.86, w * 0.48);
  tail.lineTo(w * 0.84, w * 0.62);
  tail.closePath();
  felt(ctx, tail, PAL.sageDeep, { box: bx(w * 0.66, w * 0.48, w * 0.2, w * 0.14), seed: 140 });
  felt(ctx, ellipse(w * 0.48, w * 0.55, w * 0.22, w * 0.18), PAL.sage, { box: bx(w * 0.26, w * 0.37, w * 0.44, w * 0.36), seed: 141 });
  felt(ctx, ellipse(w * 0.42, w * 0.62, w * 0.12, w * 0.09), PAL.berry, { box: bx(w * 0.3, w * 0.53, w * 0.24, w * 0.18), seed: 142, shadow: 0 });
  felt(ctx, ellipse(w * 0.55, w * 0.55, w * 0.1, w * 0.07, -0.3), PAL.sageDeep, { box: bx(w * 0.45, w * 0.48, w * 0.2, w * 0.14), seed: 143, shadow: 0.3 });
  const beak = new Path2D();
  beak.moveTo(w * 0.27, w * 0.49);
  beak.lineTo(w * 0.19, w * 0.52);
  beak.lineTo(w * 0.27, w * 0.54);
  beak.closePath();
  felt(ctx, beak, PAL.gold, { box: bx(w * 0.19, w * 0.49, w * 0.08, w * 0.05), seed: 144, fuzz: 0.2 });
  eyeDots(ctx, w * 0.34, w * 0.34, w * 0.47, w * 0.017);
  const legs = new Path2D();
  legs.moveTo(w * 0.44, w * 0.72);
  legs.lineTo(w * 0.43, w * 0.8);
  legs.moveTo(w * 0.52, w * 0.72);
  legs.lineTo(w * 0.53, w * 0.8);
  yarn(ctx, legs, PAL.oakDeep, w * 0.012);
};

// ── landscape ────────────────────────────────────────────────
const pine = (ctx: CanvasRenderingContext2D, w: number, color: string, tiers: number, top: number, bottom: number, half: number, seed: number) => {
  woodGrain(ctx, roundRect(w * 0.47, bottom - w * 0.02, w * 0.06, w * 0.1, w * 0.01), bx(w * 0.47, bottom - w * 0.02, w * 0.06, w * 0.1), PAL.oakDeep, seed, false);
  const step = (bottom - top) / tiers;
  for (let i = 0; i < tiers; i++) {
    const t0 = top + step * i - step * 0.25;
    const t1 = top + step * (i + 1);
    const hw = half * ((i + 1) / tiers) * 0.85 + half * 0.15;
    const p = new Path2D();
    p.moveTo(w / 2, t0);
    p.quadraticCurveTo(w / 2 + hw * 0.4, t0 + (t1 - t0) * 0.5, w / 2 + hw, t1);
    p.quadraticCurveTo(w / 2, t1 + step * 0.15, w / 2 - hw, t1);
    p.quadraticCurveTo(w / 2 - hw * 0.4, t0 + (t1 - t0) * 0.5, w / 2, t0);
    p.closePath();
    const b = bx(w / 2 - hw, t0, hw * 2, t1 - t0 + step * 0.15);
    felt(ctx, p, color, { box: b, seed: seed + i });
    knitRibs(ctx, p, b, color, false, 11);
    // 눈 덮개
    const s = blob(w / 2 - hw * 0.1, t0 + (t1 - t0) * 0.35, hw * 0.45, (t1 - t0) * 0.16, 0.12, seed + 20 + i, 10);
    felt(ctx, s, PAL.wool, { box: bx(w / 2 - hw * 0.55, t0 + (t1 - t0) * 0.2, hw * 0.9, (t1 - t0) * 0.32), seed: seed + 30 + i, shadow: 0.3, fuzz: 1.4 });
  }
};
const pine1: D = (ctx, w) => pine(ctx, w, PAL.sage, 3, w * 0.1, w * 0.82, w * 0.34, 150);
const pine2: D = (ctx, w) => pine(ctx, w, PAL.sageDeep, 4, w * 0.06, w * 0.84, w * 0.28, 160);
const pine3: D = (ctx, w) => pine(ctx, w, shade(PAL.sage, 0.1), 2, w * 0.28, w * 0.8, w * 0.3, 170);
const house = (ctx: CanvasRenderingContext2D, w: number, wall: string, seed: number, tall: boolean) => {
  const top = tall ? w * 0.42 : w * 0.5;
  const walls = roundRect(w * 0.26, top, w * 0.48, w * 0.84 - top, w * 0.02);
  woodGrain(ctx, walls, bx(w * 0.26, top, w * 0.48, w * 0.84 - top), wall, seed);
  // 창문 (따뜻한 빛)
  const win = roundRect(w * 0.33, top + w * 0.07, w * 0.12, w * 0.12, w * 0.01);
  const glow = ctx.createRadialGradient(w * 0.39, top + w * 0.13, 0, w * 0.39, top + w * 0.13, w * 0.12);
  glow.addColorStop(0, 'rgba(255,214,140,0.5)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(w * 0.25, top, w * 0.3, w * 0.3);
  felt(ctx, win, '#F7CF86', { box: bx(w * 0.33, top + w * 0.07, w * 0.12, w * 0.12), seed: seed + 1, fuzz: 0, fibers: 0.3, shadow: 0, light: 1.5 });
  ctx.save();
  ctx.strokeStyle = PAL.oakDeep;
  ctx.lineWidth = w * 0.01;
  ctx.stroke(win);
  ctx.beginPath();
  ctx.moveTo(w * 0.39, top + w * 0.07);
  ctx.lineTo(w * 0.39, top + w * 0.19);
  ctx.moveTo(w * 0.33, top + w * 0.13);
  ctx.lineTo(w * 0.45, top + w * 0.13);
  ctx.stroke();
  ctx.restore();
  const door = roundRect(w * 0.54, w * 0.84 - w * 0.17, w * 0.11, w * 0.17, w * 0.04);
  felt(ctx, door, PAL.oakDeep, { box: bx(w * 0.54, w * 0.67, w * 0.11, w * 0.17), seed: seed + 2, shadow: 0.2 });
  // 지붕 + 눈
  const roof = new Path2D();
  roof.moveTo(w * 0.18, top + w * 0.02);
  roof.lineTo(w / 2, top - w * 0.24);
  roof.lineTo(w * 0.82, top + w * 0.02);
  roof.closePath();
  felt(ctx, roof, PAL.cocoa, { box: bx(w * 0.18, top - w * 0.24, w * 0.64, w * 0.26), seed: seed + 3 });
  const snow = new Path2D();
  snow.moveTo(w * 0.16, top + w * 0.03);
  snow.lineTo(w / 2, top - w * 0.27);
  snow.lineTo(w * 0.84, top + w * 0.03);
  snow.quadraticCurveTo(w * 0.76, top + w * 0.06, w * 0.7, top - w * 0.03);
  snow.quadraticCurveTo(w * 0.6, top - w * 0.06, w * 0.5, top - w * 0.12);
  snow.quadraticCurveTo(w * 0.4, top - w * 0.04, w * 0.28, top - w * 0.01);
  snow.quadraticCurveTo(w * 0.22, top + w * 0.07, w * 0.16, top + w * 0.03);
  snow.closePath();
  felt(ctx, snow, PAL.wool, { box: bx(w * 0.16, top - w * 0.27, w * 0.68, w * 0.32), seed: seed + 4, fuzz: 1.5, fibers: 1.3 });
  // 굴뚝
  if (tall) {
    woodGrain(ctx, roundRect(w * 0.64, top - w * 0.22, w * 0.07, w * 0.12, w * 0.01), bx(w * 0.64, top - w * 0.22, w * 0.07, w * 0.12), PAL.berry, seed + 5, false);
    woolDot(ctx, w * 0.675, top - w * 0.225, w * 0.04, PAL.wool, seed + 6);
  }
};
const house1: D = (ctx, w) => house(ctx, w, PAL.oak, 180, false);
const house2: D = (ctx, w) => house(ctx, w, PAL.sage, 190, true);
const fence: D = (ctx, w) => {
  for (const y of [w * 0.52, w * 0.66]) {
    woodGrain(ctx, roundRect(w * 0.1, y, w * 0.8, w * 0.05, w * 0.015), bx(w * 0.1, y, w * 0.8, w * 0.05), PAL.oak, 200 + y);
  }
  for (let i = 0; i < 4; i++) {
    const x = w * (0.16 + i * 0.22);
    const post = new Path2D();
    post.moveTo(x, w * 0.4);
    post.lineTo(x + w * 0.04, w * 0.35);
    post.lineTo(x + w * 0.08, w * 0.4);
    post.lineTo(x + w * 0.08, w * 0.8);
    post.lineTo(x, w * 0.8);
    post.closePath();
    woodGrain(ctx, post, bx(x, w * 0.35, w * 0.08, w * 0.45), shade(PAL.oak, 0.08), 210 + i, false);
    felt(ctx, blob(x + w * 0.04, w * 0.365, w * 0.055, w * 0.025, 0.1, 220 + i, 9), PAL.wool, { box: bx(x - w * 0.02, w * 0.34, w * 0.12, w * 0.05), seed: 220 + i, fuzz: 1.4, shadow: 0.3 });
  }
};
const streetlamp: D = (ctx, w) => {
  const glow = ctx.createRadialGradient(w / 2, w * 0.24, 0, w / 2, w * 0.24, w * 0.22);
  glow.addColorStop(0, 'rgba(255,214,140,0.6)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, w * 0.6);
  felt(ctx, roundRect(w * 0.48, w * 0.3, w * 0.04, w * 0.56, w * 0.015), PAL.ink, { box: bx(w * 0.48, w * 0.3, w * 0.04, w * 0.56), seed: 230, fuzz: 0.2 });
  felt(ctx, roundRect(w * 0.42, w * 0.84, w * 0.16, w * 0.05, w * 0.02), PAL.ink, { box: bx(w * 0.42, w * 0.84, w * 0.16, w * 0.05), seed: 231, fuzz: 0.2 });
  const lamp = new Path2D();
  lamp.moveTo(w * 0.43, w * 0.32);
  lamp.lineTo(w * 0.41, w * 0.18);
  lamp.lineTo(w * 0.59, w * 0.18);
  lamp.lineTo(w * 0.57, w * 0.32);
  lamp.closePath();
  felt(ctx, lamp, '#F7CF86', { box: bx(w * 0.41, w * 0.18, w * 0.18, w * 0.14), seed: 232, fuzz: 0, light: 1.5, fibers: 0.3 });
  ctx.save();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = w * 0.012;
  ctx.stroke(lamp);
  ctx.restore();
  const cap = new Path2D();
  cap.moveTo(w * 0.38, w * 0.19);
  cap.lineTo(w / 2, w * 0.1);
  cap.lineTo(w * 0.62, w * 0.19);
  cap.closePath();
  felt(ctx, cap, PAL.ink, { box: bx(w * 0.38, w * 0.1, w * 0.24, w * 0.09), seed: 233, fuzz: 0.2 });
  felt(ctx, blob(w / 2, w * 0.125, w * 0.1, w * 0.035, 0.1, 234, 9), PAL.wool, { box: bx(w * 0.4, w * 0.09, w * 0.2, w * 0.07), seed: 234, fuzz: 1.4, shadow: 0.3 });
};
const snowRock: D = (ctx, w) => {
  const rock = blob(w / 2, w * 0.6, w * 0.32, w * 0.2, 0.09, 240, 10);
  felt(ctx, rock, '#A9A39A', { box: bx(w * 0.18, w * 0.4, w * 0.64, w * 0.4), seed: 240, fibers: 0.8 });
  const snow = blob(w * 0.47, w * 0.47, w * 0.26, w * 0.09, 0.12, 241, 11);
  felt(ctx, snow, PAL.wool, { box: bx(w * 0.21, w * 0.38, w * 0.52, w * 0.18), seed: 241, fuzz: 1.5, fibers: 1.3, shadow: 0.4 });
};

// ── glass (전·후면 동일 프레임, render/globe.ts 내부 경로와 정렬) ──────────
const glassBack = (kind: ContainerId): D => (ctx, w, h) => {
  const p = glassInteriorPath(kind, w, h);
  ctx.save();
  ctx.fillStyle = 'rgba(189,213,223,0.08)';
  ctx.fill(p);
  ctx.clip(p);
  // 뒷면 테두리 (안쪽 굴절 띠)
  ctx.lineWidth = w * 0.035;
  ctx.strokeStyle = 'rgba(120,140,150,0.16)';
  ctx.stroke(p);
  // 약한 반사 (오른쪽 뒤)
  const g = ctx.createLinearGradient(w * 0.62, 0, w * 0.86, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.save();
  ctx.lineWidth = w * 0.006;
  ctx.strokeStyle = 'rgba(110,130,140,0.35)';
  ctx.stroke(p);
  ctx.restore();
};
const glassFront = (kind: ContainerId): D => (ctx, w, h) => {
  const p = glassInteriorPath(kind, w, h);
  const hl = GLASS_HIGHLIGHT[kind];
  ctx.save();
  ctx.clip(p);
  ctx.lineWidth = w * 0.05;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke(p);
  ctx.lineCap = 'round';
  const lx = hl.x * w;
  const ty = hl.y * h;
  const g = ctx.createLinearGradient(lx, ty, lx, ty + h * hl.len);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = w * 0.035;
  ctx.beginPath();
  ctx.moveTo(lx + w * 0.06, ty - h * 0.07);
  ctx.quadraticCurveTo(lx - w * 0.005, ty + h * 0.05, lx, ty + h * hl.len);
  ctx.stroke();
  ctx.lineWidth = w * 0.012;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(lx + w * 0.08, ty);
  ctx.quadraticCurveTo(lx + w * 0.04, ty + h * 0.08, lx + w * 0.04, ty + h * 0.16);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(w * 0.74, h * 0.7, w * 0.012, h * 0.045, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.lineWidth = w * 0.008;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke(p);
  ctx.restore();
  if (kind === 'bottle') {
    const cork = roundRect(w * 0.37, h * 0.0, w * 0.26, h * 0.08, w * 0.015);
    woodGrain(ctx, cork, bx(w * 0.37, 0, w * 0.26, h * 0.08), PAL.oak, 250);
  }
};

// ── base (자체 정사각 프레임, 윗면이 위쪽 28% 지점) ──────────────────
const base = (color: string, seed: number): D => (ctx, w, h) => {
  const g = BASE_GEOMETRY;
  const l = g.left * w;
  const r = g.right * w;
  const top = g.lip * h;
  const bot = g.bottom * h;
  const rx = (r - l) / 2;
  const ry = g.ry * h;
  const side = new Path2D();
  side.moveTo(l, top);
  side.lineTo(l + w * 0.03, bot - ry);
  side.ellipse(w / 2, bot - ry, rx - w * 0.03, ry, 0, Math.PI, 0, true);
  side.lineTo(r, top);
  side.ellipse(w / 2, top, rx, ry, 0, 0, Math.PI, false);
  side.closePath();
  woodGrain(ctx, side, bx(l, top - ry, r - l, bot - top + ry), color, seed);
  const lip = ellipse(w / 2, top, rx, ry);
  woodGrain(ctx, lip, bx(l, top - ry, r - l, ry * 2), shade(color, 0.12), seed + 1);
  const band = new Path2D();
  band.moveTo(l + w * 0.02, top + (bot - top) * 0.5);
  band.quadraticCurveTo(w / 2, top + (bot - top) * 0.72, r - w * 0.02, top + (bot - top) * 0.5);
  stitch(ctx, band, rgba(PAL.wool, 0.7));
};

// ── ground / texture ─────────────────────────────────────────
const groundSnow: D = (ctx, w) => {
  const p = blob(w / 2, w * 0.55, w * 0.46, w * 0.16, 0.06, 260, 18);
  felt(ctx, p, PAL.wool, { box: bx(w * 0.04, w * 0.39, w * 0.92, w * 0.32), seed: 260, fibers: 1.5, fuzz: 1.6, shadow: 0.5 });
  for (let i = 0; i < 3; i++) {
    const x = w * (0.28 + i * 0.22);
    felt(ctx, blob(x, w * 0.5, w * 0.12, w * 0.06, 0.1, 261 + i, 10), PAL.wool, { box: bx(x - w * 0.12, w * 0.44, w * 0.24, w * 0.12), seed: 261 + i, shadow: 0.25, fuzz: 1.4 });
  }
};
const textureWool: D = (ctx, w) => {
  const r = rng(seedOf('wool-face'));
  const p = circle(w / 2, w / 2, w * 0.46);
  ctx.save();
  ctx.clip(p);
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w * 0.46);
  g.addColorStop(0, 'rgba(254,252,247,0.55)');
  g.addColorStop(0.8, 'rgba(229,218,203,0.4)');
  g.addColorStop(1, 'rgba(229,218,203,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3500; i++) {
    const x = r() * w;
    const y = r() * w;
    const len = (3 + r() * 10) * (w / 512);
    const a = r() * Math.PI * 2;
    ctx.strokeStyle = r() > 0.4 ? `rgba(255,255,255,${0.15 + r() * 0.3})` : `rgba(120,99,79,${0.06 + r() * 0.1})`;
    ctx.lineWidth = (0.5 + r()) * (w / 512);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.7) * len * 0.5, y + Math.sin(a + 0.7) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
};

export const decorDrawers: Record<string, PlaceholderDrawer> = {
  A001: bodyRound, A002: bodyOval, A003: bodyIrregular,
  A004: eyesBlack, A005: eyesBrown, A006: eyesBead, A007: eyesEmbroidered,
  A008: noseCarrot, A009: noseWool, A010: noseButton,
  A011: mouthSmile, A012: mouthWide, A013: mouthNeutral, A014: mouthSurprised,
  A015: blushPair(PAL.blushPink, 45), A016: blushPair(PAL.blushPeach, 47),
  A017: hatBeanie, A018: hatPompom, A019: hatBeret, A020: hatSanta, A021: hatTop, A022: hatEarflap,
  A023: scarf(PAL.sage, 64), A024: scarf(PAL.berry, 66, 'stripe'), A025: scarf(PAL.snow, 68),
  A026: scarf(PAL.oat, 74, 'check'), A027: scarf(PAL.cocoa, 76, 'stitch'),
  A028: armTwig, A029: armWool, A030: armMitten,
  A031: clothVest, A032: clothCape, A033: clothCoat,
  A034: (ctx, w) => button(ctx, w / 2, w / 2, w * 0.3, PAL.berry, 4, 92),
  A035: (ctx, w) => button(ctx, w / 2, w / 2, w * 0.3, PAL.sage, 2, 93),
  A036: decorRibbon, A037: decorHeart, A038: decorGlasses,
  A039: propGift, A040: propBroom, A041: propLantern, A042: propCane, A043: propStar,
  A044: friendRabbit, A045: friendFox, A046: friendBear, A047: friendBird,
  A048: pine1, A049: pine2, A050: pine3, A051: house1, A052: house2,
  A053: fence, A054: streetlamp, A055: snowRock,
  A056: glassBack('round'), A057: glassFront('round'),
  A058: glassBack('arch'), A059: glassFront('arch'),
  A060: glassBack('bottle'), A061: glassFront('bottle'),
  A062: base(PAL.oak, 270), A063: base(PAL.oakDeep, 280),
  A064: groundSnow, A065: textureWool,
};

export { gift as drawGift };
