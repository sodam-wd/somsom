// editor-engine 소유 (T1). 스노우볼 합성: 레이아웃·용기 클립·배경·눈사람 배치·레이어 순서.
// 순서: 받침대(유리 바로 아래에 붙여 일체형) → 후면 유리 → 바닥(A064)/풍경(world) → 눈사람 → 입자 → 전면 반사 유리.
import { getLoadedAsset } from '../assets/loader';
import {
  CONTAINERS, LOGICAL_SIZE, type Background, type ContainerId, type Layer, type Scene,
} from '../types/scene';
import { fitRect, layersBBox, type Rect } from '../editor/transforms';
import { getBackgroundCanvas, getLayerSize, getTintedImage, type Drawable } from './images';
import { renderLayers } from './layers';

/**
 * 스노우볼 구성 정사각 공간(GLOBE_SPACE 단위) 안의 배치.
 * - glass: 유리 전/후면 PNG(정사각)를 그리는 사각형. world 논리 좌표(0..1000)가 이 사각형에 대응.
 * 받침대는 고정 사각형 대신 용기별 유리 바닥 폭에 맞춰 붙인다 (drawBase).
 */
export const GLOBE_SPACE = 1000;
export const GLOBE_LAYOUT = {
  glass: { x: 150, y: 30, size: 700 },
} as const;

/**
 * 받침대 맞춤 (유리 사각형 정규화 단위). 폭은 유리 바닥보다 조금만 넓게,
 * 받침대 아랫변(bottom)은 유리 바닥(v≈0.94) 바로 아래 — 받침대가 유리 밑으로 조금만 보이게 한다.
 * 받침대는 유리보다 먼저 그려 유리 뒤에 놓이므로 윗부분은 유리와 바닥 눈에 가려진다.
 */
export const BASE_FIT: Record<ContainerId, { width: number; bottom: number }> = {
  round: { width: 0.45, bottom: 0.995 },
  arch: { width: 0.61, bottom: 0.995 },
  bottle: { width: 0.43, bottom: 0.995 },
};

/** 바닥(A064) 그리기 사각형 (world 논리 좌표). 내부 클립으로 잘린다. */
export const GROUND_RECT: Rect = { x: 0, y: 620, width: LOGICAL_SIZE, height: LOGICAL_SIZE };
/** 눈사람을 세울 영역 (world 논리 좌표, 바닥 맞춤) */
export const SNOWMAN_BOX: Rect = { x: 250, y: 340, width: 500, height: 520 };
/** 용기별 눈사람 영역: 안쪽이 좁은 용기는 그 안에 들어가도록 */
const SNOWMAN_BOXES: Record<ContainerId, Rect> = {
  round: SNOWMAN_BOX,
  arch: { x: 270, y: 380, width: 460, height: 490 },
  bottle: { x: 320, y: 450, width: 360, height: 420 },
};
export function snowmanBox(id: ContainerId | undefined): Rect {
  return (id && SNOWMAN_BOXES[id]) || SNOWMAN_BOX;
}
/** 눈이 쌓이는 높이 (world 논리 y) */
export const SNOW_FLOOR_Y = 880;

/**
 * 용기별 내부 클립 경로 (glass 사각형 정규화 좌표 0..1 기준).
 * 임시/실제 유리 PNG의 안쪽 공간과 같은 정렬 기준을 사용한다.
 */
export function traceContainerInterior(ctx: CanvasRenderingContext2D | Path2D, id: ContainerId, x: number, y: number, size: number) {
  const P = (u: number, v: number): [number, number] => [x + u * size, y + v * size];
  const m = (u: number, v: number) => ctx.moveTo(...P(u, v));
  const l = (u: number, v: number) => ctx.lineTo(...P(u, v));
  const q = (cu: number, cv: number, u: number, v: number) => ctx.quadraticCurveTo(...P(cu, cv), ...P(u, v));
  if (id === 'round') {
    // 원형 유리 돔 (실제 PNG A056/A057 안쪽), 아래는 평평하게
    const cx = 0.5;
    const cy = 0.528;
    const r = 0.43;
    const flat = 0.915;
    const a = Math.asin((flat - cy) / r);
    ctx.moveTo(...P(cx + Math.cos(a) * r, flat));
    ctx.arc(x + cx * size, y + cy * size, r * size, a, Math.PI - a, true);
    ctx.closePath();
  } else if (id === 'arch') {
    // 클로슈형 유리 돔 (실제 PNG A058/A059 안쪽): 곧은 옆면 + 타원 지붕
    m(0.22, 0.915);
    l(0.22, 0.4);
    ctx.ellipse(x + 0.5 * size, y + 0.4 * size, 0.28 * size, 0.245 * size, 0, Math.PI, Math.PI * 2, false);
    l(0.78, 0.915);
    ctx.closePath();
  } else {
    // 코르크 유리병 (실제 PNG A060/A061 안쪽): 좁은 목 + 둥근 어깨 + 몸통
    m(0.428, 0.215);
    l(0.588, 0.215);
    l(0.588, 0.262);
    q(0.71, 0.29, 0.714, 0.42);
    l(0.714, 0.85);
    q(0.714, 0.905, 0.66, 0.905);
    l(0.35, 0.905);
    q(0.294, 0.905, 0.294, 0.85);
    l(0.294, 0.42);
    q(0.298, 0.29, 0.428, 0.262);
    ctx.closePath();
  }
}

/** world 논리 좌표계 기준 내부 클립 (ctx 가 world 좌표계일 때). */
export function clipInteriorWorld(ctx: CanvasRenderingContext2D, id: ContainerId) {
  ctx.beginPath();
  traceContainerInterior(ctx, id, 0, 0, LOGICAL_SIZE);
  ctx.clip();
}

/** 이미지를 box 에 cover 로 맞춰 그리기 위한 크기 */
function coverSize(img: { width: number; height: number }, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  return { w: img.width * s, h: img.height * s };
}

export function backgroundImage(bg: Background): { image: Drawable; width: number; height: number } | null {
  if (bg.kind === 'preset' && bg.presetId) {
    const a = getLoadedAsset(bg.presetId);
    return a ? { image: a.image, width: a.width, height: a.height } : null;
  }
  if (bg.kind === 'photo' && bg.photo) {
    const c = getBackgroundCanvas(bg.photo);
    return c ? { image: c, width: c.width, height: c.height } : null;
  }
  return null;
}

/**
 * 배경을 (0,0,w,h) 영역에 그린다. 배경 변형(x,y: 논리 0..1000 중심, scale, rotation) 반영.
 * 기본(scale 1, 중심)은 영역을 cover.
 */
export function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, w: number, h: number): boolean {
  if (bg.kind === 'none') return true;
  const img = backgroundImage(bg);
  if (!img) return false;
  const { w: cw, h: ch } = coverSize(img, w, h);
  const s = Math.max(0.05, bg.scale);
  ctx.save();
  ctx.translate((bg.x / LOGICAL_SIZE) * w, (bg.y / LOGICAL_SIZE) * h);
  ctx.rotate((bg.rotation * Math.PI) / 180);
  ctx.drawImage(img.image, (-cw * s) / 2, (-ch * s) / 2, cw * s, ch * s);
  ctx.restore();
  return true;
}

/** 눈사람 레이어 → world 좌표 변환 (bbox 를 SNOWMAN_BOX 에 바닥 맞춤). 비어 있으면 null. */
export function snowmanPlacement(snowman: Layer[], containerId?: ContainerId): { scale: number; dx: number; dy: number } | null {
  const bb = layersBBox(snowman, getLayerSize);
  if (!bb) return null;
  return fitRect(bb, snowmanBox(containerId), 'bottom');
}

export function drawSnowmanInWorld(ctx: CanvasRenderingContext2D, snowman: Layer[], alpha = 1, containerId?: ContainerId): boolean {
  const p = snowmanPlacement(snowman, containerId);
  if (!p) return true;
  ctx.save();
  ctx.translate(p.dx, p.dy);
  ctx.scale(p.scale, p.scale);
  const ok = renderLayers(ctx, snowman, { alpha });
  ctx.restore();
  return ok;
}

function drawAssetSquare(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, alpha = 1): boolean {
  const a = getLoadedAsset(id);
  if (!a) return false;
  // 정사각 상자 안에 종횡비 유지 contain
  const s = size / Math.max(a.width, a.height);
  const w = a.width * s;
  const h = a.height * s;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(a.image, x + (size - w) / 2, y + (size - h) / 2, w, h);
  ctx.restore();
  return true;
}

const boundsCache = new WeakMap<Drawable, Rect>();
/** 이미지의 불투명 영역 (알파 > 40). 픽셀을 못 읽으면 전체. */
function opaqueBounds(img: Drawable, w: number, h: number): Rect {
  const hit = boundsCache.get(img);
  if (hit) return hit;
  let r: Rect = { x: 0, y: 0, width: w, height: h };
  try {
    const k = Math.min(1, 256 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const x = c.getContext('2d', { willReadFrequently: true });
    if (x) {
      x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let yy = 0; yy < c.height; yy++) {
        for (let xx = 0; xx < c.width; xx++) {
          if (d[(yy * c.width + xx) * 4 + 3] > 40) {
            if (xx < x0) x0 = xx;
            if (xx > x1) x1 = xx;
            if (yy < y0) y0 = yy;
            if (yy > y1) y1 = yy;
          }
        }
      }
      if (x1 >= x0) r = { x: x0 / k, y: y0 / k, width: (x1 - x0 + 1) / k, height: (y1 - y0 + 1) / k };
    }
  } catch {
    // 픽셀 접근 불가: 전체 사용
  }
  boundsCache.set(img, r);
  return r;
}

/** 받침대가 그려질 사각형 (유리 사각형 x,y,size 기준 좌표). 에셋이 없으면 null. */
export function baseRect(scene: Scene, x: number, y: number, size: number): Rect | null {
  const a = getLoadedAsset(scene.baseId);
  if (!a) return null;
  const b = opaqueBounds(a.image, a.width, a.height);
  const fit = BASE_FIT[scene.containerId] ?? BASE_FIT.round;
  const w = fit.width * size;
  const h = (b.height / b.width) * w;
  return { x: x + 0.5 * size - w / 2, y: y + fit.bottom * size - h, width: w, height: h };
}

/** 스노우볼이 바닥에 닿는 자리 (GLOBE_SPACE 대비 0..1): 받침대 가로 중심·폭·바닥 높이. 촬영 그림자용. */
export function globeFootprint(scene: Scene): { cx: number; width: number; bottom: number } | null {
  const { glass } = GLOBE_LAYOUT;
  const r = baseRect(scene, glass.x, glass.y, glass.size);
  if (!r) return null;
  return { cx: (r.x + r.width / 2) / GLOBE_SPACE, width: r.width / GLOBE_SPACE, bottom: (r.y + r.height) / GLOBE_SPACE };
}

/** 받침대: 유리 바닥 폭에 맞춰 붙이고, 색을 고르면 나뭇결 명암을 살려 물들인다. */
export function drawBase(ctx: CanvasRenderingContext2D, scene: Scene, x: number, y: number, size: number, alpha = 1): boolean {
  const a = getLoadedAsset(scene.baseId);
  const r = baseRect(scene, x, y, size);
  if (!a || !r) return false;
  const b = opaqueBounds(a.image, a.width, a.height);
  const img: Drawable = scene.baseColor ? getTintedImage(a, scene.baseColor) : a.image;
  const k = img.width / a.width;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(img, b.x * k, b.y * k, b.width * k, b.height * k, r.x, r.y, r.width, r.height);
  ctx.restore();
  return true;
}

export function drawGround(ctx: CanvasRenderingContext2D, alpha = 1): boolean {
  const r = GROUND_RECT;
  return drawAssetSquare(ctx, 'A064', r.x, r.y, r.width, alpha);
}

export interface GlobeDrawHooks {
  /** world 좌표계 + 내부 클립 상태에서 입자 그리기 */
  particles?: (ctx: CanvasRenderingContext2D) => void;
}

/**
 * GLOBE_SPACE 좌표계(ctx 가 이미 변환된 상태)에 스노우볼 전체를 그린다 (외부 배경 제외).
 * 반환: 모든 이미지가 준비되었는지.
 */
export function drawGlobe(ctx: CanvasRenderingContext2D, scene: Scene, hooks: GlobeDrawHooks = {}): boolean {
  const { glass } = GLOBE_LAYOUT;
  const ids = CONTAINERS[scene.containerId] ?? CONTAINERS.round;
  let ok = true;
  // 0) 받침대 (유리가 그 위에 앉도록 먼저)
  ok = drawBase(ctx, scene, glass.x, glass.y, glass.size) && ok;
  // 1) 후면 유리
  ok = drawAssetSquare(ctx, ids.back, glass.x, glass.y, glass.size) && ok;
  // 2~4) 내부: world 좌표계로 전환 후 클립
  ctx.save();
  ctx.translate(glass.x, glass.y);
  ctx.scale(glass.size / LOGICAL_SIZE, glass.size / LOGICAL_SIZE);
  clipInteriorWorld(ctx, scene.containerId);
  // 내부 배경은 쓰지 않는다 (사용자 요청): 투명한 유리 너머로 바깥 배경이 비친다. 예전 작업 파일의 값은 무시.
  ok = drawGround(ctx) && ok;
  ok = renderLayers(ctx, scene.world) && ok;
  ok = drawSnowmanInWorld(ctx, scene.snowman, 1, scene.containerId) && ok;
  hooks.particles?.(ctx);
  ctx.restore();
  // 5) 전면 반사 유리
  ok = drawAssetSquare(ctx, ids.front, glass.x, glass.y, glass.size) && ok;
  return ok;
}

/** world 편집 캔버스용 가이드 (ctx 가 world 좌표계). 유리 후면/전면·받침대를 반투명으로. */
export function drawContainerGuide(ctx: CanvasRenderingContext2D, scene: Scene, layer: 'back' | 'front') {
  const ids = CONTAINERS[scene.containerId] ?? CONTAINERS.round;
  if (layer === 'back') {
    // 받침대는 최종 스노우볼과 같은 위치·불투명도로 (유리가 받침대 위에 앉은 모습)
    drawBase(ctx, scene, 0, 0, LOGICAL_SIZE);
    drawAssetSquare(ctx, ids.back, 0, 0, LOGICAL_SIZE, 0.45);
    return;
  }
  drawAssetSquare(ctx, ids.front, 0, 0, LOGICAL_SIZE, 0.4);
  ctx.save();
  ctx.beginPath();
  traceContainerInterior(ctx, scene.containerId, 0, 0, LOGICAL_SIZE);
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(145, 118, 94, 0.55)';
  ctx.stroke();
  ctx.restore();
}

/** 출력 캔버스 (w×h) 에 스노우볼 구성 공간을 contain 배치하는 변환 */
export function globeFit(w: number, h: number): { scale: number; dx: number; dy: number } {
  return fitRect({ x: 0, y: 0, width: GLOBE_SPACE, height: GLOBE_SPACE }, { x: 0, y: 0, width: w, height: h });
}

/** 스노우볼 렌더에 필요한 에셋 id 목록 */
export function globeAssetIds(scene: Scene): string[] {
  const ids = CONTAINERS[scene.containerId] ?? CONTAINERS.round;
  const out = [ids.back, ids.front, scene.baseId, 'A064'];
  for (const bg of [scene.outerBackground]) {
    if (bg.kind === 'preset' && bg.presetId) out.push(bg.presetId);
  }
  return out;
}
