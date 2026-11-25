// editor-engine 소유 (T1). EditorCanvas 와 출력이 공유하는 레이어 드로잉.
import type { Layer } from '../types/scene';
import { layerDrawSize } from '../editor/transforms';
import { getLayerImage } from './images';

export interface RenderLayersOptions {
  /** 전체 투명도 배율 */
  alpha?: number;
  /** 그리지 않을 레이어 id */
  skipId?: string;
}

/**
 * 현재 ctx 변환(논리 좌표계) 위에 레이어들을 z 순서로 그린다.
 * 반환: 아직 이미지가 준비되지 않은 레이어가 있으면 false.
 */
export function renderLayers(ctx: CanvasRenderingContext2D, layers: Layer[], opts: RenderLayersOptions = {}): boolean {
  let complete = true;
  const sorted = [...layers].sort((a, b) => a.z - b.z);
  for (const layer of sorted) {
    if (!layer.visible || layer.id === opts.skipId) continue;
    const img = getLayerImage(layer);
    if (!img) {
      complete = false;
      continue;
    }
    drawLayerImage(ctx, layer, img.image, img, opts.alpha ?? 1);
  }
  return complete;
}

export function drawLayerImage(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  image: CanvasImageSource,
  size: { width: number; height: number },
  alpha = 1,
) {
  const { width, height } = layerDrawSize(layer, size);
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flipX) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}
