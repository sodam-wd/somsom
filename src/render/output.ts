// editor-engine 소유 (T1). PNG 출력 렌더 (선택 핸들/UI 미포함) 및 파일 유틸.
import { loadAsset } from '../assets/loader';
import type {
  CertificateRenderOptions, GlobeRenderOptions, SnowmanRenderOptions,
} from '../types/contracts';
import { LAYER_BASE_SIZE, LOGICAL_SIZE, PHOTO_ASSET_ID, type Layer, type Photo, type Scene } from '../types/scene';
import { fitRect, layersBBox } from '../editor/transforms';
import {
  EDITOR_PHOTO_SIZE, createCanvas, ensureBackgroundCanvas, getLayerSize, prepareLayers, setPhotoOverrides,
} from './images';
import { GLOBE_LAYOUT, drawBackground, drawGlobe, globeAssetIds, globeFit, snowmanPlacement } from './globe';
import { createFlakes, drawFlakes, floatingFlakesAt } from './particles';
import { renderLayers } from './layers';
import { renderPhoto } from './photo';

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

/** 출력 사진 렌더 상한 (px) */
export const MAX_PHOTO_OUTPUT = 2048;

/** 사진 레이어의 출력 픽셀 크기 (긴 변). pxPerLogical = 출력 px / 레이어 논리 단위. */
export function photoOutputSize(layer: Layer, pxPerLogical: number): number {
  const s = LAYER_BASE_SIZE * Math.max(Math.abs(layer.scaleX), Math.abs(layer.scaleY)) * pxPerLogical;
  return Math.min(MAX_PHOTO_OUTPUT, Math.max(16, Math.ceil(s)));
}

/**
 * 출력 해상도에 비례한 사진 렌더. 편집용(512)보다 커야 할 때만 새로 렌더한다.
 * 같은 사진이 여러 번 쓰이면 가장 큰 크기 하나로 렌더.
 */
async function buildPhotoOverrides(groups: [Layer[], number][]): Promise<Map<Photo, HTMLCanvasElement>> {
  const need = new Map<Photo, number>();
  for (const [layers, k] of groups) {
    for (const l of layers) {
      if (l.assetId !== PHOTO_ASSET_ID || !l.photo || !l.visible) continue;
      const size = photoOutputSize(l, k);
      if (size > EDITOR_PHOTO_SIZE) need.set(l.photo, Math.max(need.get(l.photo) ?? 0, size));
    }
  }
  const out = new Map<Photo, HTMLCanvasElement>();
  await Promise.all([...need].map(async ([photo, size]) => {
    try {
      out.set(photo, await renderPhoto(photo, size));
    } catch {
      /* 실패 시 편집용 렌더 사용 */
    }
  }));
  return out;
}

/** 출력 그리기 동안만 고해상도 사진 적용 */
function withPhotos<T>(map: Map<Photo, HTMLCanvasElement>, draw: () => T): T {
  setPhotoOverrides(map);
  try {
    return draw();
  } finally {
    setPhotoOverrides(null);
  }
}

/** 눈사람 bbox 를 (w,h) 영역에 맞출 때의 배율 */
function snowmanFitScale(scene: Scene, w: number, h: number, pad = 0.06): number {
  const bb = layersBBox(scene.snowman, getLayerSize);
  if (!bb) return 1;
  const p = Math.min(w, h) * pad;
  return fitRect(bb, { x: 0, y: 0, width: w - 2 * p, height: h - 2 * p }).scale;
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
  const photos = await buildPhotoOverrides([[scene.snowman, snowmanFitScale(scene, size, size)]]);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    withPhotos(photos, () => drawSnowmanFit(ctx, scene, 0, 0, size, size));
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
  // 출력 px / world 논리 단위
  const worldK = globeFit(w, h).scale * (GLOBE_LAYOUT.glass.size / LOGICAL_SIZE);
  const placement = snowmanPlacement(scene.snowman, scene.containerId);
  const photos = await buildPhotoOverrides([
    [scene.world, worldK],
    [scene.snowman, worldK * (placement?.scale ?? 1)],
  ]);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    const t = opts.particleTime;
    withPhotos(photos, () => paintSnowGlobe(ctx, scene, w, h, opts.includeOuterBackground, (c) => {
      drawFlakes(c, SETTLED);
      drawFlakes(c, floatingFlakesAt(t ?? 0.37, t === undefined ? 18 : 40));
    }));
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

  // ── 레이아웃: 항목과 소개글 높이를 먼저 측정한 뒤 남는 공간을 썸네일에 배정 ──
  const p = scene.profile;
  const name = p.name.trim() || '이름 없는 눈사람';
  const left = u * 12;
  const maxW = w - u * 24;
  const labelW = u * 22;
  const rowLineH = u * 4.2;
  const measure = (s: string) => ctx.measureText(s).width;
  const rows: [string, string][] = [
    ['탄생일', p.birthDate ? formatBirthDate(p.birthDate) : '—'],
    ['성격', p.traits.length ? p.traits.join(', ') : '—'],
    ['좋아하는 것', p.likes.length ? p.likes.join(', ') : '—'],
  ];
  ctx.font = `400 ${u * 3.2}px ${sans}`;
  const rowLines = rows.map(([, v]) => wrapText(measure, v, maxW - labelW, 2));
  const rowsH = rowLines.reduce((acc, l) => acc + u * 6 + (l.length - 1) * rowLineH, 0);

  const thumbTop = u * 24;
  const bottom = h - u * 8; // 바느질 테두리 안쪽
  const nameBlock = u * 11;
  const thumbMax = Math.min(h * 0.36, w * 0.5);
  const thumbMin = Math.min(thumbMax, u * 20);
  const bio = p.bio.trim();
  // 오른쪽 아래 도장 자리를 비워 둔 폭
  const bioW = maxW - u * 20;
  let bioLines: string[] = [];
  let bioSize = u * 3.1;
  let bioLineH = bioSize * 1.42;
  const bioHead = u * 12; // '소개' 라벨 + 간격
  if (bio) {
    const avail = bottom - thumbTop - thumbMin - nameBlock - rowsH - bioHead;
    // 큰 글자부터 시도: 잘리지 않고 들어가는 가장 큰 크기 선택
    const sizes = [3.1, 2.8, 2.55, 2.3, 2.1].map((k) => u * k);
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      const lh = size * 1.42;
      const maxLines = Math.max(1, Math.min(8, Math.floor(avail / lh)));
      ctx.font = `400 ${size}px ${serif}`;
      const full = wrapText(measure, bio, bioW, 1000);
      const last = i === sizes.length - 1;
      if (full.length <= maxLines || last) {
        bioSize = size;
        bioLineH = lh;
        bioLines = full.length <= maxLines ? full : wrapText(measure, bio, bioW, maxLines);
        break;
      }
    }
  }
  const bioH = bio ? bioHead + bioLines.length * bioLineH : 0;
  const thumbH = Math.max(thumbMin, Math.min(thumbMax, bottom - thumbTop - nameBlock - rowsH - bioH));

  // 눈사람 썸네일
  ctx.save();
  ctx.fillStyle = 'rgba(254, 252, 247, 0.55)';
  ctx.beginPath();
  ctx.ellipse(w / 2, thumbTop + thumbH * 0.92, thumbH * 0.42, thumbH * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const photos = await buildPhotoOverrides([[scene.snowman, snowmanFitScale(scene, thumbH, thumbH, 0.02)]]);
  withPhotos(photos, () => drawSnowmanFit(ctx, scene, (w - thumbH) / 2, thumbTop, thumbH, thumbH, 0.02));

  // 이름
  let y = thumbTop + thumbH + u * 8;
  ctx.textAlign = 'center';
  ctx.fillStyle = cocoa;
  ctx.font = `700 ${u * 5.4}px ${serif}`;
  ctx.fillText(name, w / 2, y);
  y += u * 3;

  // 항목
  ctx.textAlign = 'left';
  rows.forEach(([label], idx) => {
    y += u * 6;
    ctx.fillStyle = oak;
    ctx.font = `600 ${u * 3}px ${sans}`;
    ctx.fillText(label, left, y);
    ctx.fillStyle = cocoa;
    ctx.font = `400 ${u * 3.2}px ${sans}`;
    const lines = rowLines[idx];
    lines.forEach((line, i) => ctx.fillText(line, left + labelW, y + i * rowLineH));
    y += (lines.length - 1) * rowLineH;
  });

  // 소개 (여러 줄)
  if (bio) {
    y += u * 7;
    ctx.fillStyle = oak;
    ctx.font = `600 ${u * 3}px ${sans}`;
    ctx.fillText('소개', left, y);
    ctx.fillStyle = cocoa;
    ctx.font = `400 ${bioSize}px ${serif}`;
    bioLines.forEach((line, i) => ctx.fillText(line, left, y + u * 5 + i * bioLineH));
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
