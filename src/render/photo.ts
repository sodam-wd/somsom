// editor-engine 소유 (T1). 얼굴 사진: crop → 채도/밝기/대비 → 부드러운 마스크 → 양모 텍스처 합성.
// 로컬 처리만 수행 (외부 통신 없음). AI 변환을 보장하지 않는 2D 합성이다.
import { loadAsset } from '../assets/loader';
import type { Photo } from '../types/scene';
import { createCanvas, loadImageUrl, registerBackgroundRenderer, registerPhotoRenderer } from './images';
import { adjustPixels, ellipseMaskAlpha, seededRandom } from './pixels';

/** 양모 텍스처 에셋 (A065 texture/wool-face) */
export const WOOL_TEXTURE_ID = 'A065';
const MAX_PHOTO_SIDE = 2048;

function drawCrop(img: HTMLImageElement, photo: Photo, w: number, h: number, ctx: CanvasRenderingContext2D) {
  const c = photo.crop;
  const cw = Math.max(1, c.width);
  const ch = Math.max(1, c.height);
  // crop 영역을 출력에 cover 맞춤
  const s = Math.max(w / cw, h / ch);
  const dw = cw * s;
  const dh = ch * s;
  ctx.drawImage(img, c.x, c.y, cw, ch, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/**
 * 색칠한 마스크 → side 크기 알파 배열. 경계 부드럽게(feather)는 작게 줄였다 키우는 방식으로 흐린다
 * (canvas filter 미지원 브라우저 대응).
 */
async function paintedMaskAlpha(photo: Photo, side: number): Promise<Uint8ClampedArray | null> {
  if (!photo.mask) return null;
  const m = await loadImageUrl(photo.mask).catch(() => null);
  if (!m) return null;
  const feather = Math.max(0, Math.min(1, photo.feather));
  // feather 0 → 거의 그대로, 1 → 변의 약 1/20 해상도까지 줄여 크게 흐림
  const small = Math.max(12, Math.round(side / (1 + feather * 19)));
  let src: CanvasImageSource = m;
  let cur = Math.max(m.width, m.height);
  // 단계적으로 줄이기 (계단 현상 방지)
  while (cur / 2 >= small) {
    cur = Math.round(cur / 2);
    const c = createCanvas(cur, cur);
    const cx = c.getContext('2d');
    if (!cx) break;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, 0, 0, cur, cur);
    src = c;
  }
  const out = createCanvas(side, side);
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) return null;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  // 한 번 중간 크기를 거쳐 키우면 더 매끄럽다
  const mid = createCanvas(Math.min(side, cur * 4), Math.min(side, cur * 4));
  const mctx = mid.getContext('2d');
  if (mctx) {
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(src, 0, 0, mid.width, mid.height);
    src = mid;
  }
  octx.drawImage(src, 0, 0, side, side);
  const d = octx.getImageData(0, 0, side, side).data;
  const a = new Uint8ClampedArray(side * side);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  return a;
}

export async function renderPhoto(photo: Photo, size: number): Promise<HTMLCanvasElement> {
  const side = Math.max(16, Math.min(MAX_PHOTO_SIDE, Math.round(size)));
  const img = await loadImageUrl(photo.dataUrl);
  const painted = await paintedMaskAlpha(photo, side);
  const out = createCanvas(side, side);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;
  drawCrop(img, photo, side, side, ctx);

  const data = ctx.getImageData(0, 0, side, side);
  const px = data.data;
  adjustPixels(px, photo.saturation, photo.brightness, photo.contrast);
  // 부드러운 원형 마스크 + 미세 섬유 노이즈(양모 표면 느낌)
  const rnd = seededRandom(side * 7919);
  const feather = Math.max(0.02, photo.feather);
  const noise = 10 * photo.textureStrength;
  for (let y = 0; y < side; y++) {
    const v = ((y + 0.5) / side) * 2 - 1;
    for (let x = 0; x < side; x++) {
      const u = ((x + 0.5) / side) * 2 - 1;
      const i = (y * side + x) * 4;
      const m = painted ? painted[y * side + x] / 255 : ellipseMaskAlpha(u, v, feather);
      px[i + 3] = px[i + 3] * m;
      if (noise > 0 && m > 0) {
        const n = (rnd() - 0.5) * noise;
        px[i] += n;
        px[i + 1] += n;
        px[i + 2] += n;
      }
    }
  }
  ctx.putImageData(data, 0, 0);

  if (photo.textureStrength > 0) {
    const tex = await loadAsset(WOOL_TEXTURE_ID).catch(() => null);
    if (tex) {
      // 텍스처를 사진 알파로 먼저 제한한 뒤 overlay 로 합성 (투명 영역 오염 방지)
      const t = createCanvas(side, side);
      const tctx = t.getContext('2d');
      if (tctx) {
        tctx.drawImage(tex.image, 0, 0, side, side);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(out, 0, 0);
        ctx.save();
        ctx.globalAlpha = Math.min(1, photo.textureStrength) * 0.55;
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(t, 0, 0);
        ctx.restore();
      }
    }
  }
  return out;
}

/** 배경 사진: crop + 보정만 (마스크 없음). 긴 변 최대 2048. */
export async function renderBackgroundPhoto(photo: Photo): Promise<HTMLCanvasElement> {
  const img = await loadImageUrl(photo.dataUrl);
  const cw = Math.max(1, photo.crop.width);
  const ch = Math.max(1, photo.crop.height);
  const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(cw, ch));
  const out = createCanvas(cw * k, ch * k);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;
  ctx.drawImage(img, photo.crop.x, photo.crop.y, cw, ch, 0, 0, out.width, out.height);
  if (photo.saturation !== 1 || photo.brightness !== 1 || photo.contrast !== 1) {
    const data = ctx.getImageData(0, 0, out.width, out.height);
    adjustPixels(data.data, photo.saturation, photo.brightness, photo.contrast);
    ctx.putImageData(data, 0, 0);
  }
  return out;
}

registerPhotoRenderer(renderPhoto);
registerBackgroundRenderer(renderBackgroundPhoto);
