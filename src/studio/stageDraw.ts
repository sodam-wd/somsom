// studio-qa 소유 (T3). Keep 단계 합성 그리기 — 미리보기와 캡처가 같은 함수를 사용해 결과가 일치한다.
import type { CameraPlacement } from '../types/scene';
import { coverSourceRect, placementRect } from './geometry';
import { drawBackground, type BgSource } from './imageOps';
import type { Background } from '../types/scene';

export interface FrameInput {
  background?: { src: BgSource; transform: Pick<Background, 'x' | 'y' | 'scale' | 'rotation'> } | null;
  /** 배경 소스가 없을 때 채울 단색 (null 이면 투명) */
  fill?: string | null;
  video?: { el: HTMLVideoElement; mirror: boolean } | null;
  art?: HTMLCanvasElement | null;
  placement: CameraPlacement;
}

/** 작품 아래 접지 그림자 (바닥에 놓인 느낌, 왼쪽 위 자연광 → 오른쪽 아래로 약간 치우침) */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, strength: number): void {
  if (strength <= 0) return;
  const cx = x + width * 0.53;
  const cy = y + height * 0.965;
  const rx = width * 0.4;
  const ry = Math.max(2, width * 0.065);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(52,38,26,${0.6 * strength})`);
  g.addColorStop(0.55, `rgba(52,38,26,${0.28 * strength})`);
  g.addColorStop(1, 'rgba(52,38,26,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawVideoCover(ctx: CanvasRenderingContext2D, el: HTMLVideoElement, mirror: boolean, w: number, h: number): boolean {
  const vw = el.videoWidth;
  const vh = el.videoHeight;
  if (!vw || !vh) return false;
  const r = coverSourceRect(vw, vh, w, h);
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(el, r.x, r.y, r.width, r.height, 0, 0, w, h);
  ctx.restore();
  return true;
}

export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, f: FrameInput): void {
  ctx.clearRect(0, 0, w, h);
  if (f.video) drawVideoCover(ctx, f.video.el, f.video.mirror, w, h);
  else if (f.background) drawBackground(ctx, f.background.src, f.background.transform, w, h);
  else if (f.fill) {
    ctx.fillStyle = f.fill;
    ctx.fillRect(0, 0, w, h);
  }
  if (f.art) {
    const r = placementRect(f.placement, w, h, f.art.width, f.art.height);
    drawShadow(ctx, r.x, r.y, r.width, r.height, f.placement.shadow);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(f.art, r.x, r.y, r.width, r.height);
  }
}

/** 저장 파일명 (개인정보 없음) */
export function captureFileName(mode: string, d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `somsom-${mode}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}
