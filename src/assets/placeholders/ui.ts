// workshop-ui 소유: UI 소재 15종, 브랜드 심볼/워드마크(글자 없음), 배경 4종 임시 드로어.
// 최종 에셋 아님. 소재 이미지에 글자를 굽지 않는다.
import type { PlaceholderDrawer } from './index';
import {
  PAL, blob, circle, ellipse, felt, knitRibs, rgba, rng, roundRect, shade,
  snowflakeStitch, stitch, woodGrain, woolDot, yarn,
} from './felt';
import { decorDrawers, drawGift } from './decor';

type D = PlaceholderDrawer;
const bx = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

// ── 전면 텍스처 (타일로 쓰는 소재: 가득 채움) ───────────────────
const linen: D = (ctx, w, h) => {
  ctx.fillStyle = '#EDE5D6';
  ctx.fillRect(0, 0, w, h);
  const r = rng(301);
  const u = w / 512;
  for (let y = 0; y < h; y += 2 * u) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.08 + r() * 0.12})` : `rgba(120,99,79,${0.03 + r() * 0.06})`;
    ctx.fillRect(0, y, w, u);
  }
  for (let x = 0; x < w; x += 2 * u) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.06 + r() * 0.1})` : `rgba(120,99,79,${0.03 + r() * 0.05})`;
    ctx.fillRect(x, 0, u, h);
  }
  // 슬럽(굵은 실) 표현
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(145,118,94,${0.05 + r() * 0.06})`;
    ctx.fillRect(r() * w, r() * h, (20 + r() * 60) * u, u * 1.2);
  }
};
const oakWorkbench: D = (ctx, w, h) => {
  const p = new Path2D();
  p.rect(0, 0, w, h);
  woodGrain(ctx, p, bx(0, 0, w, h), '#B08C6C', 302);
  // 판재 이음선
  ctx.fillStyle = 'rgba(70,50,30,0.25)';
  for (let y = h / 4; y < h; y += h / 4) ctx.fillRect(0, y, w, 2 * (w / 512));
};

// ── 오브젝트형 소재 (투명 배경) ─────────────────────────────────
const stitchedLabel: D = (ctx, w) => {
  const p = roundRect(w * 0.08, w * 0.3, w * 0.84, w * 0.4, w * 0.08);
  felt(ctx, p, PAL.cream, { box: bx(w * 0.08, w * 0.3, w * 0.84, w * 0.4), seed: 303, stitch: { path: roundRect(w * 0.12, w * 0.34, w * 0.76, w * 0.32, w * 0.06), color: rgba(PAL.oak, 0.8) } });
};
const feltButton: D = (ctx, w) => {
  const p = roundRect(w * 0.06, w * 0.34, w * 0.88, w * 0.32, w * 0.16);
  felt(ctx, p, PAL.sage, { box: bx(w * 0.06, w * 0.34, w * 0.88, w * 0.32), seed: 304, stitch: { path: roundRect(w * 0.1, w * 0.38, w * 0.8, w * 0.24, w * 0.12), color: rgba(PAL.wool, 0.85) } });
  felt(ctx, blob(w * 0.2, w * 0.35, w * 0.12, w * 0.045, 0.12, 305, 10), PAL.wool, { box: bx(w * 0.08, w * 0.3, w * 0.24, w * 0.1), seed: 305, fuzz: 1.5, shadow: 0.3 });
};
const materialTray: D = (ctx, w) => {
  const outer = roundRect(w * 0.06, w * 0.3, w * 0.88, w * 0.4, w * 0.04);
  woodGrain(ctx, outer, bx(w * 0.06, w * 0.3, w * 0.88, w * 0.4), PAL.oak, 306);
  for (let i = 0; i < 4; i++) {
    const x = w * (0.1 + i * 0.205);
    const cell = roundRect(x, w * 0.34, w * 0.185, w * 0.32, w * 0.02);
    ctx.save();
    ctx.fillStyle = shade(PAL.oak, -0.1);
    ctx.fill(cell);
    ctx.clip(cell);
    ctx.shadowColor = 'rgba(40,25,15,0.45)';
    ctx.shadowBlur = w * 0.02;
    ctx.shadowOffsetX = w * 0.006;
    ctx.shadowOffsetY = w * 0.01;
    ctx.lineWidth = w * 0.02;
    ctx.strokeStyle = 'rgba(40,25,15,0.5)';
    ctx.stroke(cell);
    ctx.restore();
  }
};
const certificatePaper: D = (ctx, w) => {
  const r = rng(307);
  const p = new Path2D();
  const l = w * 0.08;
  const t = w * 0.06;
  const rt = w * 0.92;
  const b = w * 0.94;
  p.moveTo(l, t);
  for (let x = l; x <= rt; x += w * 0.02) p.lineTo(x, t + (r() - 0.5) * w * 0.012);
  for (let y = t; y <= b; y += w * 0.02) p.lineTo(rt + (r() - 0.5) * w * 0.012, y);
  for (let x = rt; x >= l; x -= w * 0.02) p.lineTo(x, b + (r() - 0.5) * w * 0.012);
  for (let y = b; y >= t; y -= w * 0.02) p.lineTo(l + (r() - 0.5) * w * 0.012, y);
  p.closePath();
  felt(ctx, p, '#FBF7EE', { box: bx(l, t, rt - l, b - t), seed: 307, fibers: 0.5, fuzz: 0.6, shadow: 0.6, light: 0.4 });
  stitch(ctx, roundRect(w * 0.13, w * 0.11, w * 0.74, w * 0.78, w * 0.02), rgba(PAL.oak, 0.6), 1.8, 6);
  snowflakeStitch(ctx, w * 0.2, w * 0.82, w * 0.035, rgba(PAL.oak, 0.7));
};
const woolBall: D = (ctx, w) => {
  const c = circle(w / 2, w / 2, w * 0.3);
  felt(ctx, c, PAL.cream, { box: bx(w * 0.2, w * 0.2, w * 0.6, w * 0.6), seed: 308 });
  ctx.save();
  ctx.clip(c);
  ctx.strokeStyle = rgba(PAL.oak, 0.35);
  ctx.lineWidth = w * 0.008;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.ellipse(w / 2, w / 2, w * 0.3, w * (0.04 + i * 0.03), 0.6 + (i % 3) * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  const tail = new Path2D();
  tail.moveTo(w * 0.7, w * 0.68);
  tail.quadraticCurveTo(w * 0.86, w * 0.8, w * 0.72, w * 0.88);
  yarn(ctx, tail, PAL.cream, w * 0.02);
};
const scissors: D = (ctx, w) => {
  ctx.save();
  ctx.translate(w / 2, w / 2);
  ctx.rotate(-0.3);
  ctx.translate(-w / 2, -w / 2);
  const metal = (path: Path2D) => {
    ctx.save();
    ctx.shadowColor = 'rgba(60,40,25,0.35)';
    ctx.shadowBlur = w * 0.02;
    ctx.shadowOffsetX = w * 0.006;
    ctx.shadowOffsetY = w * 0.01;
    const g = ctx.createLinearGradient(w * 0.3, 0, w * 0.7, 0);
    g.addColorStop(0, shade(PAL.gold, 0.35));
    g.addColorStop(1, shade(PAL.gold, -0.35));
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.restore();
  };
  for (const s of [-1, 1]) {
    const blade = new Path2D();
    blade.moveTo(w / 2, w * 0.52);
    blade.lineTo(w / 2 + s * w * 0.03, w * 0.5);
    blade.lineTo(w / 2 - s * w * 0.01, w * 0.12);
    blade.closePath();
    metal(blade);
    ctx.save();
    ctx.lineWidth = w * 0.03;
    ctx.strokeStyle = shade(PAL.gold, -0.1);
    ctx.beginPath();
    ctx.ellipse(w / 2 + s * w * 0.1, w * 0.68, w * 0.08, w * 0.1, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, w * 0.52);
    ctx.lineTo(w / 2 + s * w * 0.07, w * 0.59);
    ctx.stroke();
    ctx.restore();
  }
  woolDot(ctx, w / 2, w * 0.52, w * 0.02, PAL.oakDeep, 309);
  ctx.restore();
};
const colorPalette: D = (ctx, w) => {
  const p = new Path2D();
  p.ellipse(w / 2, w / 2, w * 0.4, w * 0.3, -0.15, 0, Math.PI * 2);
  const hole = circle(w * 0.64, w * 0.62, w * 0.05);
  const pal = new Path2D();
  pal.addPath(p);
  pal.addPath(hole);
  ctx.save();
  // evenodd 로 엄지 구멍
  ctx.save();
  ctx.shadowColor = 'rgba(60,40,25,0.3)';
  ctx.shadowBlur = w * 0.03;
  ctx.shadowOffsetY = w * 0.015;
  ctx.fillStyle = PAL.cream;
  ctx.fill(pal, 'evenodd');
  ctx.restore();
  ctx.restore();
  felt(ctx, p, PAL.cream, { box: bx(w * 0.1, w * 0.2, w * 0.8, w * 0.6), seed: 310, shadow: 0 });
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(hole);
  ctx.restore();
  const cols = [PAL.berry, PAL.gold, PAL.sage, PAL.snow, PAL.oak];
  cols.forEach((c, i) => {
    const a = Math.PI * (1.05 + i * 0.22);
    woolDot(ctx, w / 2 + Math.cos(a) * w * 0.24, w / 2 + Math.sin(a) * w * 0.17, w * 0.055, c, 311 + i);
  });
};
const measuringTape: D = (ctx, w) => {
  const c = circle(w * 0.42, w * 0.5, w * 0.22);
  felt(ctx, c, PAL.sage, { box: bx(w * 0.2, w * 0.28, w * 0.44, w * 0.44), seed: 320, stitch: { path: circle(w * 0.42, w * 0.5, w * 0.17), color: rgba(PAL.wool, 0.8) } });
  woolDot(ctx, w * 0.42, w * 0.5, w * 0.05, PAL.cream, 321);
  const tape = roundRect(w * 0.6, w * 0.64, w * 0.3, w * 0.07, w * 0.01);
  felt(ctx, tape, '#F2E3B8', { box: bx(w * 0.6, w * 0.64, w * 0.3, w * 0.07), seed: 322, fuzz: 0.2, fibers: 0.3 });
  ctx.save();
  ctx.strokeStyle = rgba(PAL.cocoa, 0.7);
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 15; i++) {
    const x = w * (0.61 + i * 0.019);
    ctx.beginPath();
    ctx.moveTo(x, w * 0.64);
    ctx.lineTo(x, w * (i % 5 === 0 ? 0.675 : 0.66));
    ctx.stroke();
  }
  ctx.restore();
};
const embossStamp: D = (ctx, w) => {
  const handle = new Path2D();
  handle.moveTo(w * 0.42, w * 0.56);
  handle.bezierCurveTo(w * 0.38, w * 0.4, w * 0.36, w * 0.16, w / 2, w * 0.16);
  handle.bezierCurveTo(w * 0.64, w * 0.16, w * 0.62, w * 0.4, w * 0.58, w * 0.56);
  handle.closePath();
  woodGrain(ctx, handle, bx(w * 0.36, w * 0.16, w * 0.28, w * 0.4), PAL.oak, 330, false);
  felt(ctx, roundRect(w * 0.36, w * 0.55, w * 0.28, w * 0.06, w * 0.01), PAL.gold, { box: bx(w * 0.36, w * 0.55, w * 0.28, w * 0.06), seed: 331, fuzz: 0, fibers: 0.1, light: 1.4 });
  const base = roundRect(w * 0.3, w * 0.6, w * 0.4, w * 0.18, w * 0.03);
  woodGrain(ctx, base, bx(w * 0.3, w * 0.6, w * 0.4, w * 0.18), PAL.oakDeep, 332);
  felt(ctx, ellipse(w / 2, w * 0.82, w * 0.17, w * 0.05), PAL.gold, { box: bx(w * 0.33, w * 0.77, w * 0.34, w * 0.1), seed: 333, fuzz: 0, fibers: 0.1, light: 1.3 });
};
const giftBox: D = (ctx, w) => drawGift(ctx, w, 340);
const nameTag: D = (ctx, w) => {
  const p = new Path2D();
  p.moveTo(w * 0.3, w * 0.3);
  p.lineTo(w * 0.82, w * 0.3);
  p.lineTo(w * 0.82, w * 0.7);
  p.lineTo(w * 0.3, w * 0.7);
  p.lineTo(w * 0.16, w * 0.5);
  p.closePath();
  felt(ctx, p, PAL.oat, { box: bx(w * 0.16, w * 0.3, w * 0.66, w * 0.4), seed: 350, stitch: { path: roundRect(w * 0.34, w * 0.34, w * 0.44, w * 0.32, w * 0.02), color: rgba(PAL.cocoa, 0.6) } });
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(circle(w * 0.25, w * 0.5, w * 0.025));
  ctx.restore();
  const loop = new Path2D();
  loop.moveTo(w * 0.25, w * 0.5);
  loop.bezierCurveTo(w * 0.1, w * 0.4, w * 0.08, w * 0.2, w * 0.2, w * 0.14);
  yarn(ctx, loop, PAL.sage, w * 0.018);
};
const needleThread: D = (ctx, w) => {
  // 실패
  felt(ctx, roundRect(w * 0.26, w * 0.26, w * 0.26, w * 0.06, w * 0.02), PAL.oak, { box: bx(w * 0.26, w * 0.26, w * 0.26, w * 0.06), seed: 360, fuzz: 0 });
  felt(ctx, roundRect(w * 0.26, w * 0.68, w * 0.26, w * 0.06, w * 0.02), PAL.oak, { box: bx(w * 0.26, w * 0.68, w * 0.26, w * 0.06), seed: 361, fuzz: 0 });
  const spool = roundRect(w * 0.29, w * 0.32, w * 0.2, w * 0.36, w * 0.02);
  felt(ctx, spool, PAL.berry, { box: bx(w * 0.29, w * 0.32, w * 0.2, w * 0.36), seed: 362 });
  knitRibs(ctx, spool, bx(w * 0.29, w * 0.32, w * 0.2, w * 0.36), PAL.berry, false, 6);
  // 바늘
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#B9B6B0';
  ctx.lineWidth = w * 0.012;
  ctx.shadowColor = 'rgba(60,40,25,0.3)';
  ctx.shadowBlur = w * 0.01;
  ctx.shadowOffsetY = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.62, w * 0.8);
  ctx.lineTo(w * 0.78, w * 0.2);
  ctx.stroke();
  ctx.restore();
  const t = new Path2D();
  t.moveTo(w * 0.49, w * 0.5);
  t.bezierCurveTo(w * 0.6, w * 0.55, w * 0.84, w * 0.4, w * 0.765, w * 0.25);
  yarn(ctx, t, PAL.berry, w * 0.008);
};
const displayMat: D = (ctx, w) => {
  const p = ellipse(w / 2, w / 2, w * 0.44, w * 0.2);
  felt(ctx, p, PAL.oat, { box: bx(w * 0.06, w * 0.3, w * 0.88, w * 0.4), seed: 370, stitch: { path: ellipse(w / 2, w / 2, w * 0.39, w * 0.16), color: rgba(PAL.cocoa, 0.55) } });
};

// ── 브랜드 (글자 없는 형태) ─────────────────────────────────────
const logoSymbol: D = (ctx, w, h, e) => {
  // 스노우볼 구성 비율(render GLOBE_LAYOUT 과 동일: 유리 150,30,700 / 받침대 240,530,520 per 1000)
  const k = Math.min(w, h) / 1000;
  const drawIn = (fn: D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x * k, y * k);
    ctx.scale((size * k) / w, (size * k) / w);
    fn(ctx, w, w, e);
    ctx.restore();
  };
  const d = decorDrawers;
  drawIn(d.A056, 150, 30, 700);
  drawIn(d.A064, 190, 470, 620);
  drawIn(d.A048, 230, 330, 260);
  drawIn(d.A051, 560, 380, 220);
  drawIn(d.A001, 400, 450, 220);
  drawIn(d.A001, 425, 300, 170);
  drawIn(d.A023, 410, 350, 200);
  drawIn(d.A018, 420, 200, 180);
  drawIn(d.A057, 150, 30, 700);
  drawIn(d.A062, 240, 530, 520);
};
/** 워드마크 임시: 글자를 그리지 않고 빈 세이지 펠트 라벨만 표시 */
const logoWordmark: D = (ctx, w, h) => {
  const p = roundRect(w * 0.18, h * 0.36, w * 0.64, h * 0.28, h * 0.14);
  felt(ctx, p, PAL.sage, { box: bx(w * 0.18, h * 0.36, w * 0.64, h * 0.28), seed: 380, stitch: { path: roundRect(w * 0.205, h * 0.4, w * 0.59, h * 0.2, h * 0.1), color: rgba(PAL.wool, 0.85) } });
  snowflakeStitch(ctx, w * 0.11, h * 0.5, h * 0.06, rgba(PAL.oat, 0.9));
  snowflakeStitch(ctx, w * 0.89, h * 0.5, h * 0.06, rgba(PAL.oat, 0.9));
};

// ── 배경 (제안 4종, 불투명) ─────────────────────────────────────
const bgLinenStudio: D = (ctx, w, h, e) => {
  linen(ctx, w, h, e);
  const g = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, w * 0.8);
  g.addColorStop(0, 'rgba(255,250,240,0.55)');
  g.addColorStop(1, 'rgba(90,70,50,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const floor = ctx.createLinearGradient(0, h * 0.7, 0, h);
  floor.addColorStop(0, 'rgba(145,118,94,0)');
  floor.addColorStop(1, 'rgba(145,118,94,0.25)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
};
const bgWinterWindow: D = (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#9FBFCC');
  sky.addColorStop(1, '#E3EEF1');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const r = rng(390);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h * 0.75, (1 + r() * 3) * (w / 768), 0, Math.PI * 2);
    ctx.fill();
  }
  // 먼 눈 언덕
  ctx.fillStyle = '#F4F7F7';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.6);
  ctx.quadraticCurveTo(w * 0.8, h * 0.66, w, h * 0.56);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  // 창틀
  const fr = new Path2D();
  fr.rect(0, 0, w, h);
  fr.rect(w * 0.08, h * 0.08, w * 0.4, h * 0.62);
  fr.rect(w * 0.52, h * 0.08, w * 0.4, h * 0.62);
  ctx.save();
  ctx.clip(fr, 'evenodd');
  woodGrain(ctx, fr, bx(0, 0, w, h), '#C7A988', 391);
  ctx.restore();
  // 창턱
  const sill = new Path2D();
  sill.rect(0, h * 0.72, w, h * 0.28);
  woodGrain(ctx, sill, bx(0, h * 0.72, w, h * 0.28), PAL.oak, 392);
  ctx.fillStyle = 'rgba(40,25,15,0.18)';
  ctx.fillRect(0, h * 0.72, w, h * 0.015);
};
const bgChristmasLights: D = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#4A3A2E');
  g.addColorStop(1, '#2E241D');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(393);
  const cols = ['255,214,140', '255,190,120', '189,113,107', '170,184,160', '255,240,210'];
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = r() * h * 0.85;
    const rad = (8 + r() * 34) * (w / 768);
    const c = cols[Math.floor(r() * cols.length)];
    const bg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    bg.addColorStop(0, `rgba(${c},${0.35 + r() * 0.35})`);
    bg.addColorStop(0.7, `rgba(${c},${0.12})`);
    bg.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = bg;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const floor = new Path2D();
  floor.rect(0, h * 0.8, w, h * 0.2);
  woodGrain(ctx, floor, bx(0, h * 0.8, w, h * 0.2), PAL.oakDeep, 394);
};
const bgWinterNight: D = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2C3A4A');
  g.addColorStop(0.7, '#5D7487');
  g.addColorStop(1, '#8FA9B8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(395);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,250,235,${0.3 + r() * 0.6})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h * 0.55, (0.6 + r() * 1.6) * (w / 768), 0, Math.PI * 2);
    ctx.fill();
  }
  // 달 (펠트)
  woolDot(ctx, w * 0.78, h * 0.2, h * 0.07, '#F3E9CF', 396);
  for (const [y, c] of [[0.72, '#DCE6EA'], [0.8, '#EEF3F3'], [0.9, PAL.wool]] as const) {
    const p = blob(w / 2, h * (y + 0.2), w * 0.75, h * 0.22, 0.04, 397 + y * 10, 16);
    felt(ctx, p, c, { box: bx(-w * 0.25, h * (y - 0.02), w * 1.5, h * 0.44), seed: 398 + y * 10, shadow: 0.2, fuzz: 1.2 });
  }
};

export const uiDrawers: Record<string, PlaceholderDrawer> = {
  UI01: linen,
  UI02: oakWorkbench,
  UI03: stitchedLabel,
  UI04: feltButton,
  UI05: materialTray,
  UI06: certificatePaper,
  UI07: woolBall,
  UI08: scissors,
  UI09: colorPalette,
  UI10: measuringTape,
  UI11: embossStamp,
  UI12: giftBox,
  UI13: nameTag,
  UI14: needleThread,
  UI15: displayMat,
  B02: logoSymbol,
  B03: logoWordmark,
  BG01: bgLinenStudio,
  BG02: bgWinterWindow,
  BG03: bgChristmasLights,
  BG04: bgWinterNight,
};
