// editor-engine 소유 (T1). 편집 캔버스 (D17–D19): Pointer Events 기반 선택/이동/핀치/회전/핸들,
// 보기 확대(zoom/pan)와 객체 변형 분리, 휠·키보드, 드롭. 선택 UI 는 출력에 포함되지 않는다.
import { useEffect, useRef, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { LOGICAL_SIZE, type Layer, type LayerTarget } from '../types/scene';
import type { EditorCanvasProps } from '../types/contracts';
import { subscribeAssets } from '../assets/loader';
import { renderLayers } from '../render/layers';
import { getLayerImage, getLayerSize, isOpaqueAt, subscribeRenderCache } from '../render/images';
import {
  clipInteriorWorld, drawBackground, drawContainerGuide, drawGround, drawSnowmanInWorld,
} from '../render/globe';
import '../render/photo';
import { useElementSize } from '../render/useElementSize';
import { findLayer } from './store';
import { sceneStore } from './useEditor';
import { viewStore } from './view';
import { registerKeyboard } from './keyboard';
import {
  clampScale, clampView, hitTest, layerCorners, layerDrawSize, normalizeAngle, pointInLayer,
  screenToLogical, toParent, type Point, type View,
} from './transforms';
import { TAP_SLOP, angleDeg, distance, pinchDelta, snapAngle } from './gestures';

/** 드래그 앤 드롭 dataTransfer 타입 (값 = assetId) */
export const ASSET_DRAG_TYPE = 'text/somsom-asset';

const MAX_DPR = 2;
/** 핸들 터치 반경 (CSS px) → 지름 44px */
const HANDLE_HIT = 22;
/** 핸들 표시 반지름 (CSS px) */
const HANDLE_DRAW = 9;
/** 회전 핸들 거리 (CSS px) */
const ROTATE_OFFSET = 38;
/** 작은 객체의 크기 핸들 바깥 오프셋 (CSS px) */
const SMALL_HANDLE_OFFSET = 20;

const COLOR_SAGE = '#AAB8A0';
const COLOR_OAK = '#91765E';
const COLOR_WOOL = '#FEFCF7';

type Mode = 'idle' | 'empty' | 'move' | 'scale' | 'rotate' | 'pinchLayer' | 'pinchView' | 'panView';

interface GestureState {
  mode: Mode;
  pointers: Map<number, Point>;
  /** 현재 모드 시작 시 포인터 위치 */
  start: Map<number, Point>;
  layerStart: Layer | null;
  viewStart: View;
  moved: boolean;
  open: boolean;
}

function layersOf(target: LayerTarget): Layer[] {
  return sceneStore.getState().scene[target];
}

function selectedIn(target: LayerTarget): Layer | null {
  const { scene, selectedId } = sceneStore.getState();
  if (!selectedId) return null;
  const f = findLayer(scene, selectedId);
  return f && f.target === target ? f.layer : null;
}

export function EditorCanvas(props: EditorCanvasProps) {
  const { target, showContainer = false, className, onDropAsset } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(wrapRef);
  const cssSize = Math.max(0, Math.min(size.w, size.h));
  const propsRef = useRef({ target, showContainer, onDropAsset, cssSize });
  propsRef.current = { target, showContainer, onDropAsset, cssSize };
  const drawRef = useRef<() => void>(() => {});
  const g = useRef<GestureState>({
    mode: 'idle', pointers: new Map(), start: new Map(), layerStart: null,
    viewStart: viewStore.get(target), moved: false, open: false,
  });

  useEffect(() => {
    viewStore.setCssSize(target, cssSize);
  }, [target, cssSize]);

  // ── 그리기 ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssSize <= 0) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let alive = true;

    const draw = () => {
      raf = 0;
      if (!alive) return;
      const { target: t, showContainer: guide } = propsRef.current;
      const view = viewStore.get(t);
      const k = (cssSize / LOGICAL_SIZE) * view.zoom;
      const { scene } = sceneStore.getState();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.panX, dpr * view.panY);
      ctx.imageSmoothingQuality = 'high';
      if (t === 'world') {
        if (guide) drawContainerGuide(ctx, scene, 'back');
        ctx.save();
        clipInteriorWorld(ctx, scene.containerId);
        drawBackground(ctx, scene.innerBackground, LOGICAL_SIZE, LOGICAL_SIZE);
        drawGround(ctx);
        ctx.restore();
        renderLayers(ctx, scene.world);
        // 눈사람은 world 편집에서 참고용 (선택 불가)
        drawSnowmanInWorld(ctx, scene.snowman, 0.92);
        if (guide) drawContainerGuide(ctx, scene, 'front');
      } else {
        renderLayers(ctx, scene.snowman);
      }
      const sel = selectedIn(t);
      if (sel) drawSelection(ctx, sel, k);
    };
    const requestDraw = () => {
      if (!raf && alive) raf = requestAnimationFrame(draw);
    };
    drawRef.current = requestDraw;
    draw();
    const offs = [
      sceneStore.subscribe(requestDraw),
      viewStore.subscribe(requestDraw),
      subscribeAssets(requestDraw),
      subscribeRenderCache(requestDraw),
    ];
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((off) => off());
    };
  }, [cssSize]);

  useEffect(() => {
    drawRef.current();
  }, [target, showContainer]);

  // ── 단축키 ──────────────────────────────────────────────
  useEffect(() => registerKeyboard(target, () => canvasRef.current), [target]);

  // ── 휠 (passive:false 필요) ─────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timer = 0;
    let open = false;
    const onWheel = (e: WheelEvent) => {
      const { target: t, cssSize: s } = propsRef.current;
      if (s <= 0) return;
      e.preventDefault();
      const delta = e.deltaMode === 1 ? (e.deltaY || e.deltaX) * 16 : e.deltaY || e.deltaX;
      const sel = selectedIn(t);
      if (sel) {
        if (!open) {
          open = true;
          sceneStore.beginGesture();
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          open = false;
          sceneStore.endGesture();
        }, 350);
        if (e.shiftKey) {
          sceneStore.updateLayer(sel.id, { rotation: normalizeAngle(sel.rotation + delta * 0.15) });
        } else {
          const f = Math.exp(-delta * 0.0015);
          const sx = clampScale(sel.scaleX * f);
          sceneStore.updateLayer(sel.id, { scaleX: sx, scaleY: sel.scaleY * (sx / sel.scaleX) });
        }
      } else {
        const r = canvas.getBoundingClientRect();
        const anchor = { x: e.clientX - r.left, y: e.clientY - r.top };
        const v = viewStore.get(t);
        const f = Math.exp(-delta * 0.0015);
        const zoom = Math.min(4, Math.max(1, v.zoom * f));
        const ratio = zoom / v.zoom;
        viewStore.set(t, {
          zoom,
          panX: anchor.x - (anchor.x - v.panX) * ratio,
          panY: anchor.y - (anchor.y - v.panY) * ratio,
        });
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      window.clearTimeout(timer);
      if (open) sceneStore.endGesture();
    };
  }, []);

  // 언마운트 시 열린 제스처 정리
  useEffect(() => () => {
    if (g.current.open) {
      g.current.open = false;
      sceneStore.endGesture();
    }
  }, []);

  // ── 포인터 ──────────────────────────────────────────────
  const cssPoint = (e: { clientX: number; clientY: number }): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toLogical = (p: Point): Point => screenToLogical(p, propsRef.current.cssSize, viewStore.get(propsRef.current.target));
  const pxPerLogical = () => (propsRef.current.cssSize / LOGICAL_SIZE) * viewStore.get(propsRef.current.target).zoom;

  const openGesture = () => {
    if (!g.current.open) {
      g.current.open = true;
      sceneStore.beginGesture();
    }
  };
  const closeGesture = () => {
    if (g.current.open) {
      g.current.open = false;
      sceneStore.endGesture();
    }
  };

  const snapshotStart = () => {
    g.current.start = new Map(g.current.pointers);
  };

  /** 선택 객체의 핸들 히트 */
  const hitHandle = (layer: Layer, p: Point): 'scale' | 'rotate' | null => {
    const k = pxPerLogical();
    const sz = layerDrawSize(layer, getLayerSize(layer));
    const view = viewStore.get(propsRef.current.target);
    const toCss = (q: Point) => ({ x: q.x * k + view.panX, y: q.y * k + view.panY });
    const rot = toCss(toParent(layer, { x: 0, y: -sz.height / 2 - ROTATE_OFFSET / k }));
    if (distance(rot, p) <= HANDLE_HIT) return 'rotate';
    for (const c of scaleHandles(layer, sz, k)) {
      if (distance(toCss(c), p) <= HANDLE_HIT) return 'scale';
    }
    return null;
  };

  const pickLayer = (L: Point): Layer | null => {
    const t = propsRef.current.target;
    const layers = layersOf(t);
    const hit = hitTest(layers, L, getLayerSize, {
      alphaAt: (layer, local, sz) => {
        const img = getLayerImage(layer);
        if (!img) return null;
        return isOpaqueAt(img.image, local.x / sz.width + 0.5, local.y / sz.height + 0.5);
      },
    });
    if (hit) return hit;
    // 투명 부분을 눌렀어도 이미 선택된 객체의 상자 안이면 그 객체를 유지 (작은 부품 조작 편의)
    const sel = selectedIn(t);
    if (sel && pointInLayer(sel, layerDrawSize(sel, getLayerSize(sel)), L, 6 / pxPerLogical())) return sel;
    return null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const st = g.current;
    if (st.pointers.size >= 2) return;
    const canvas = canvasRef.current!;
    canvas.focus({ preventScroll: true });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    const p = cssPoint(e);
    st.pointers.set(e.pointerId, p);
    const t = propsRef.current.target;

    if (st.pointers.size === 1) {
      st.moved = false;
      snapshotStart();
      const sel = selectedIn(t);
      const handle = sel ? hitHandle(sel, p) : null;
      if (sel && handle) {
        st.mode = handle;
        st.layerStart = sel;
        openGesture();
        return;
      }
      const hit = pickLayer(toLogical(p));
      if (hit) {
        sceneStore.select(hit.id);
        st.mode = 'move';
        st.layerStart = hit;
        openGesture();
      } else {
        st.mode = 'empty';
        st.viewStart = viewStore.get(t);
      }
      return;
    }
    // 두 번째 손가락
    snapshotStart();
    const sel = selectedIn(t);
    if (sel) {
      st.mode = 'pinchLayer';
      st.layerStart = sel;
      openGesture();
    } else {
      st.mode = 'pinchView';
      st.viewStart = viewStore.get(t);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const st = g.current;
    if (!st.pointers.has(e.pointerId)) return;
    const p = cssPoint(e);
    st.pointers.set(e.pointerId, p);
    const t = propsRef.current.target;
    const s0 = st.start.get(e.pointerId);
    if (s0 && distance(s0, p) > TAP_SLOP) st.moved = true;
    const k = pxPerLogical();
    const start = st.layerStart;
    const view = viewStore.get(t);

    switch (st.mode) {
      case 'move': {
        if (!start || !s0) return;
        sceneStore.updateLayer(start.id, { x: start.x + (p.x - s0.x) / k, y: start.y + (p.y - s0.y) / k });
        return;
      }
      case 'scale':
      case 'rotate': {
        if (!start || !s0) return;
        const c = { x: start.x * k + view.panX, y: start.y * k + view.panY };
        if (st.mode === 'scale') {
          const d0 = Math.max(4, distance(c, s0));
          const f = distance(c, p) / d0;
          const sx = clampScale(start.scaleX * f);
          sceneStore.updateLayer(start.id, { scaleX: sx, scaleY: start.scaleY * (sx / start.scaleX) });
        } else {
          const rot = normalizeAngle(start.rotation + angleDeg(c, p) - angleDeg(c, s0));
          sceneStore.updateLayer(start.id, { rotation: snapAngle(rot) });
        }
        return;
      }
      case 'pinchLayer':
      case 'pinchView': {
        const ids = [...st.pointers.keys()];
        if (ids.length < 2) return;
        const [ia, ib] = ids;
        const a0 = st.start.get(ia);
        const b0 = st.start.get(ib);
        if (!a0 || !b0) return;
        const d = pinchDelta({ a: a0, b: b0 }, { a: st.pointers.get(ia)!, b: st.pointers.get(ib)! });
        if (st.mode === 'pinchLayer') {
          if (!start) return;
          const sx = clampScale(start.scaleX * d.scale);
          sceneStore.updateLayer(start.id, {
            x: start.x + d.translate.x / k,
            y: start.y + d.translate.y / k,
            scaleX: sx,
            scaleY: start.scaleY * (sx / start.scaleX),
            rotation: normalizeAngle(start.rotation + d.rotation),
          });
        } else {
          const v0 = st.viewStart;
          const zoom = Math.min(4, Math.max(1, v0.zoom * d.scale));
          const ratio = zoom / v0.zoom;
          const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
          const m1 = { x: m0.x + d.translate.x, y: m0.y + d.translate.y };
          viewStore.set(t, clampView({
            zoom,
            panX: m1.x - (m0.x - v0.panX) * ratio,
            panY: m1.y - (m0.y - v0.panY) * ratio,
          }, propsRef.current.cssSize));
        }
        return;
      }
      case 'empty':
      case 'panView': {
        if (st.mode === 'empty') {
          if (!st.moved || st.viewStart.zoom <= 1.001) return;
          st.mode = 'panView';
        }
        if (!s0) return;
        viewStore.set(t, { zoom: st.viewStart.zoom, panX: st.viewStart.panX + p.x - s0.x, panY: st.viewStart.panY + p.y - s0.y });
        return;
      }
      default:
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const st = g.current;
    if (!st.pointers.has(e.pointerId)) return;
    st.pointers.delete(e.pointerId);
    const t = propsRef.current.target;
    if (st.pointers.size === 1) {
      // 두 손가락 → 한 손가락: 남은 손가락으로 이어서 이동/보기 이동
      snapshotStart();
      if (st.mode === 'pinchLayer') {
        st.mode = 'move';
        st.layerStart = selectedIn(t);
      } else if (st.mode === 'pinchView') {
        st.mode = 'panView';
        st.viewStart = viewStore.get(t);
      }
      return;
    }
    if (st.pointers.size === 0) {
      if (st.mode === 'empty' && !st.moved && e.type === 'pointerup') sceneStore.select(null);
      st.mode = 'idle';
      st.layerStart = null;
      closeGesture();
    }
  };

  // ── 드롭 ────────────────────────────────────────────────
  const onDragOver = (e: DragEvent<HTMLCanvasElement>) => {
    if (!propsRef.current.onDropAsset) return;
    if (Array.from(e.dataTransfer.types).includes(ASSET_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: DragEvent<HTMLCanvasElement>) => {
    const cb = propsRef.current.onDropAsset;
    if (!cb) return;
    const id = e.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    const L = toLogical(cssPoint(e));
    cb(id, L.x, L.y);
  };

  const left = Math.max(0, (size.w - cssSize) / 2);
  const top = Math.max(0, (size.h - cssSize) / 2);
  const label = target === 'world'
    ? '스노우볼 풍경 편집 캔버스. 끌어서 이동, 두 손가락으로 크기와 회전, 화살표로 이동, Delete로 삭제'
    : '눈사람 편집 캔버스. 끌어서 이동, 두 손가락으로 크기와 회전, 화살표로 이동, Delete로 삭제';

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, aspectRatio: size.collapsed ? '1 / 1' : undefined }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={label}
        data-target={target}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'absolute', left, top, width: cssSize, height: cssSize, display: 'block',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineOffset: -2,
        }}
      />
    </div>
  );
}

/** 선택 표시 (화면 전용, 출력 제외). ctx 는 논리 좌표계, k = CSS px / 논리 단위. */
function drawSelection(ctx: CanvasRenderingContext2D, layer: Layer, k: number) {
  const sz = layerDrawSize(layer, getLayerSize(layer));
  const corners = layerCorners(layer, sz);
  const px = 1 / k;
  ctx.save();
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([6 * px, 5 * px]);
  ctx.strokeStyle = COLOR_OAK;
  ctx.beginPath();
  corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  // 회전 핸들
  const topMid = toParent(layer, { x: 0, y: -sz.height / 2 });
  const rot = toParent(layer, { x: 0, y: -sz.height / 2 - ROTATE_OFFSET * px });
  ctx.beginPath();
  ctx.moveTo(topMid.x, topMid.y);
  ctx.lineTo(rot.x, rot.y);
  ctx.stroke();
  const dot = (p: Point, fill: string) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, HANDLE_DRAW * px, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = COLOR_OAK;
    ctx.stroke();
  };
  dot(rot, COLOR_SAGE);
  // 회전 표시 (작은 호)
  ctx.beginPath();
  ctx.arc(rot.x, rot.y, HANDLE_DRAW * 0.45 * px, -Math.PI * 0.2, Math.PI * 1.2);
  ctx.strokeStyle = COLOR_WOOL;
  ctx.lineWidth = 1.6 * px;
  ctx.stroke();
  scaleHandles(layer, sz, k).forEach((c) => dot(c, COLOR_WOOL));
  ctx.restore();
}

/**
 * 크기 핸들 위치 (논리 좌표). 화면에서 작은 객체는 객체 이동 영역을 가리지 않도록
 * 오른쪽 아래 바깥쪽에 핸들 하나만 둔다.
 */
function scaleHandles(layer: Layer, sz: { width: number; height: number }, k: number): Point[] {
  const small = Math.min(sz.width, sz.height) * k < HANDLE_HIT * 4;
  if (!small) return layerCorners(layer, sz);
  const off = SMALL_HANDLE_OFFSET / k;
  return [toParent(layer, { x: sz.width / 2 + off, y: sz.height / 2 + off })];
}
