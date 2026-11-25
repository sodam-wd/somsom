// 임시 에셋 (실제 PNG 미생성 시에만 사용). 최종 에셋이 아니다.
// 담당: workshop-ui — 카테고리/에셋별 펠트 스타일 Canvas 드로잉을 여기에 추가한다.
// 규칙: 투명 배경, 이미지 안에 글자를 굽지 않음, 왼쪽 위 자연광, 확정 팔레트 사용.
import type { AssetEntry } from '../../types/scene';
import { drawers } from './drawers';

export type PlaceholderDrawer = (ctx: CanvasRenderingContext2D, w: number, h: number, entry: AssetEntry) => void;

export function drawPlaceholder(entry: AssetEntry, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const fn = drawers[entry.id] ?? drawers[entry.category] ?? fallback;
  ctx.save();
  fn(ctx, w, h, entry);
  ctx.restore();
}

/** 기본: 크림 양모 덩어리 (좌상단 하이라이트) */
const fallback: PlaceholderDrawer = (ctx, w, h) => {
  const r = Math.min(w, h) * 0.36;
  const cx = w / 2;
  const cy = h / 2;
  const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FEFCF7');
  g.addColorStop(0.7, '#E5DACB');
  g.addColorStop(1, '#C9B9A4');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
};
