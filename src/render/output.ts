// editor-engine 소유 (T1). PNG 출력 렌더 (선택 핸들/UI 미포함) 및 파일 유틸.
import { loadAsset } from '../assets/loader';
import type {
  CertificateRenderOptions, GlobeRenderOptions, SnowmanRenderOptions,
} from '../types/contracts';
import type { Scene } from '../types/scene';
import { fitRect, layersBBox } from '../editor/transforms';
import { createCanvas, ensureBackgroundCanvas, getLayerSize, prepareLayers } from './images';
import { drawBackground, drawGlobe, globeAssetIds, globeFit } from './globe';
import { createFlakes, drawFlakes, floatingFlakesAt } from './particles';
import { renderLayers } from './layers';
import './photo';

const MAX_OUTPUT_SIDE = 4096;

function sideOf(n: number, fallback: number): number {
  return Math.max(16, Math.min(MAX_OUTPUT_SIDE, Math.round(Number.isFinite(n) ? n : fallback)));
}

async function prepareScene(scene: Scene, extraIds: string[] = []): Promise<void> {
  await prepareLayers([...scene.snowman, ...scene.world]);
  await Promise.all([...globeAssetIds(scene), ...extraIds].map((id) => loadAsset(id).catch(() => null)));
  for (const bg of [scene.innerBackground, scene.outerBackground]) {
    if (bg.kind === 'photo' && bg.photo) await ensureBackgroundCanvas(bg.photo);
  }
}

/** 눈사람만 그린다 (투명 배경, bbox 중앙 배치). ctx 영역 (x,y,w,h). */
function drawSnowmanFit(ctx: CanvasRenderingContext2D, scene: Scene, x: number, y: number, w: number, h: number, pad = 0.06) {
  const bb = layersBBox(scene.snowman, getLayerSize);
  if (!bb) return;
  const p = Math.min(w, h) * pad;
  const f = fitRect(bb, { x: x + p, y: y + p, width: w - 2 * p, height: h - 2 * p });
  ctx.save();
  ctx.translate(f.dx, f.dy);
  ctx.scale(f.scale, f.scale);
  renderLayers(ctx, scene.snowman);
  ctx.restore();
}

/** D20 투명 눈사람 PNG: snowman 레이어만, 투명 배경, bbox 중앙 배치. */
export async function renderSnowman(scene: Scene, opts: SnowmanRenderOptions): Promise<HTMLCanvasElement> {
  const size = sideOf(opts.size, 1080);
  await prepareLayers(scene.snowman);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    drawSnowmanFit(ctx, scene, 0, 0, size, size);
  }
  return canvas;
}

/** 스노우볼을 (w×h) ctx 에 그린다 — SnowGlobeView 와 출력 공용. */
export function paintSnowGlobe(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  w: number,
  h: number,
  includeOuterBackground: boolean,
  particles: (ctx: CanvasRenderingContext2D) => void,
): boolean {
  let ok = true;
  if (includeOuterBackground) ok = drawBackground(ctx, scene.outerBackground, w, h) && ok;
  const f = globeFit(w, h);
  ctx.save();
  ctx.translate(f.dx, f.dy);
  ctx.scale(f.scale, f.scale);
  ok = drawGlobe(ctx, scene, { particles }) && ok;
  ctx.restore();
  return ok;
}

const SETTLED = createFlakes(140, 7);

/** D21 스노우볼 PNG. includeOuterBackground=false 면 바깥은 투명. */
export async function renderSnowGlobe(scene: Scene, opts: GlobeRenderOptions): Promise<HTMLCanvasElement> {
  const w = sideOf(opts.width, 1080);
  const h = sideOf(opts.height, 1080);
  await prepareScene(scene);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    const t = opts.particleTime;
    paintSnowGlobe(ctx, scene, w, h, opts.includeOuterBackground, (c) => {
      drawFlakes(c, SETTLED);
      drawFlakes(c, floatingFlakesAt(t ?? 0.37, t === undefined ? 18 : 40));
    });
  }
  return canvas;
}

// ── 탄생 증명서 (D22) ───────────────────────────────────────
const PAPER_ID = 'UI06';
const STAMP_ID = 'UI11';

function cssFont(varName: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

const SERIF_FALLBACK = '"MaruBuri", "Maruburi", "Fraunces", "Noto Serif KR", "Nanum Myeongjo", Georgia, serif';
const SANS_FALLBACK = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

/** 글자 단위 줄바꿈 (한글 대응). 최대 줄 수 초과 시 말줄임. */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = '';
    const tokens = para.match(/\S+\s*|\s+/g) ?? [''];
    for (const token of tokens) {
      if (measure(line + token) <= maxWidth) {
        line += token;
        continue;
      }
      if (line) {
        lines.push(line.trimEnd());
        line = '';
      }
      // 토큰 자체가 길면 글자 단위
      for (const ch of token) {
        if (measure(line + ch) > maxWidth && line) {
          lines.push(line);
          line = '';
        }
        line += ch;
      }
    }
    lines.push(line.trimEnd());
  }
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    cut[maxLines - 1] = `${last}…`;
    return cut;
  }
  return lines;
}

export function formatBirthDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

/** D22 탄생 증명서 PNG. 소재 이미지에 글자를 굽지 않고, 텍스트는 코드로 렌더. */
export async function renderCertificate(scene: Scene, opts: CertificateRenderOptions): Promise<HTMLCanvasElement> {
  const w = sideOf(opts.width, 1080);
  const h = sideOf(opts.height, 1350);
  await prepareLayers(scene.snowman);
  const [paper, stamp] = await Promise.all([
    loadAsset(PAPER_ID).catch(() => null),
    loadAsset(STAMP_ID).catch(() => null),
  ]);
  try {
    await document.fonts?.ready;
  } catch {
    /* 폰트 API 미지원 */
  }
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingQuality = 'high';
  const serif = cssFont('--font-title', SERIF_FALLBACK);
  const sans = cssFont('--font-body', SANS_FALLBACK);
  const u = Math.min(w, h) / 100; // 단위

  // 종이
  ctx.fillStyle = '#F5F0E6';
  ctx.fillRect(0, 0, w, h);
  if (paper) {
    const s = Math.max(w / paper.width, h / paper.height);
    ctx.drawImage(paper.image, (w - paper.width * s) / 2, (h - paper.height * s) / 2, paper.width * s, paper.height * s);
  }
  // 바느질 테두리 (CSS 대신 캔버스 선)
  ctx.save();
  ctx.strokeStyle = 'rgba(145, 118, 94, 0.55)';
  ctx.lineWidth = Math.max(1, u * 0.35);
  ctx.setLineDash([u * 1.6, u * 1.1]);
  ctx.strokeRect(u * 5, u * 5, w - u * 10, h - u * 10);
  ctx.restore();

  const cocoa = '#78634F';
  const oak = '#91765E';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = oak;
  ctx.font = `500 ${u * 3}px ${sans}`;
  ctx.fillText('somsom · Little Winter', w / 2, u * 12);
  ctx.fillStyle = cocoa;
  ctx.font = `700 ${u * 6.4}px ${serif}`;
  ctx.fillText('탄생 증명서', w / 2, u * 20);

  // 눈사람 썸네일
  const thumbTop = u * 24;
  const thumbH = Math.min(h * 0.36, w * 0.5);
  ctx.save();
  ctx.fillStyle = 'rgba(254, 252, 247, 0.55)';
  ctx.beginPath();
  ctx.ellipse(w / 2, thumbTop + thumbH * 0.92, thumbH * 0.42, thumbH * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawSnowmanFit(ctx, scene, (w - thumbH) / 2, thumbTop, thumbH, thumbH, 0.02);

  // 항목
  const p = scene.profile;
  const name = p.name.trim() || '이름 없는 눈사람';
  let y = thumbTop + thumbH + u * 8;
  ctx.fillStyle = cocoa;
  ctx.font = `700 ${u * 5.4}px ${serif}`;
  ctx.fillText(name, w / 2, y);
  y += u * 3;

  const left = u * 12;
  const maxW = w - u * 24;
  const rows: [string, string][] = [
    ['탄생일', p.birthDate ? formatBirthDate(p.birthDate) : '—'],
    ['성격', p.traits.length ? p.traits.join(', ') : '—'],
    ['좋아하는 것', p.likes.length ? p.likes.join(', ') : '—'],
  ];
  ctx.textAlign = 'left';
  const labelW = u * 22;
  for (const [label, value] of rows) {
    y += u * 6;
    ctx.fillStyle = oak;
    ctx.font = `600 ${u * 3}px ${sans}`;
    ctx.fillText(label, left, y);
    ctx.fillStyle = cocoa;
    ctx.font = `400 ${u * 3.2}px ${sans}`;
    const lines = wrapText((s) => ctx.measureText(s).width, value, maxW - labelW, 2);
    lines.forEach((line, i) => ctx.fillText(line, left + labelW, y + i * u * 4.2));
    y += (lines.length - 1) * u * 4.2;
  }
  // 소개
  if (p.bio.trim()) {
    y += u * 7;
    ctx.fillStyle = oak;
    ctx.font = `600 ${u * 3}px ${sans}`;
    ctx.fillText('소개', left, y);
    ctx.fillStyle = cocoa;
    ctx.font = `400 ${u * 3.1}px ${serif}`;
    const remaining = Math.max(1, Math.floor((h - u * 18 - y) / (u * 4.4)));
    const lines = wrapText((s) => ctx.measureText(s).width, p.bio.trim(), maxW, Math.min(6, remaining));
    lines.forEach((line, i) => ctx.fillText(line, left, y + u * 5 + i * u * 4.4));
  }

  // 도장
  const ss = u * 18;
  if (stamp) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    const k = ss / Math.max(stamp.width, stamp.height);
    ctx.drawImage(stamp.image, w - u * 9 - stamp.width * k, h - u * 9 - stamp.height * k, stamp.width * k, stamp.height * k);
    ctx.restore();
  }
  return canvas;
}

// ── 파일 유틸 ───────────────────────────────────────────────
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 변환 실패'))), 'image/png');
      return;
    }
    try {
      const url = canvas.toDataURL('image/png');
      const bin = atob(url.split(',')[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      resolve(new Blob([arr], { type: 'image/png' }));
    } catch (e) {
      reject(e instanceof Error ? e : new Error('PNG 변환 실패'));
    }
  });
}

/** Blob 다운로드. 객체 URL 은 사용 후 해제한다. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari 는 즉시 해제하면 다운로드가 취소될 수 있어 지연 해제
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * navigator.share 파일 공유 지원 시 공유, 아니면 다운로드.
 * 사용자가 공유 시트를 취소하면(AbortError) 다운로드하지 않고 'shared' 를 반환한다.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof File !== 'undefined' && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      const data: ShareData = { files: [file], title: 'somsom' };
      if (nav.canShare(data)) {
        await nav.share(data);
        return 'shared';
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
