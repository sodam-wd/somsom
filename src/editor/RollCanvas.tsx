// editor-engine 소유 (T1). Roll 단계 (D11): 원목 작업대에서 눈덩이를 굴려 키우고 바로 추가.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { LOGICAL_SIZE, type Layer } from '../types/scene';
import type { RollCanvasProps } from '../types/contracts';
import { getLoadedAsset, subscribeAssets } from '../assets/loader';
import { renderLayers } from '../render/layers';
import { subscribeRenderCache } from '../render/images';
import { seededRandom } from '../render/pixels';
import { useElementSize } from '../render/useElementSize';
import { sceneStore } from './useEditor';
import { registerKeyboard } from './keyboard';
import {
  BODY_ASSET_IDS, ROLL_MAX_RADIUS, ROLL_MIN_RADIUS, radiusToScale, rollAngleDelta, rollRadius,
  stackPosition, type BodyAssetId,
} from './roll';
import { clamp, type Point } from './transforms';

const WORKBENCH_ID = 'UI02';
const MAX_DPR = 2;
const BALL_START: Point = { x: 260, y: 800 };
const BODY_LABELS: Record<BodyAssetId, string> = { A001: '동글', A002: '타원', A003: '울퉁불퉁' };

interface Ball { x: number; y: number; distance: number; angle: number }

/** 양모 섬유 결 (공 로컬 좌표, 단위 반지름 1) — 결정적 */
const FIBERS = (() => {
  const rnd = seededRandom(2024);
  return Array.from({ length: 70 }, () => {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * 0.9;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, len: 0.08 + rnd() * 0.14, dir: rnd() * Math.PI, bend: (rnd() - 0.5) * 0.12 };
  });
})();

function newBall(): Ball {
  return { ...BALL_START, distance: 0, angle: 0 };
}

export function RollCanvas(props: RollCanvasProps) {
  const { onAdded, className } = props;
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(areaRef);
  const cssSize = Math.max(0, Math.min(size.w, size.h));
  const ball = useRef<Ball>(newBall());
  const [radius, setRadius] = useState(ROLL_MIN_RADIUS);
  const [bodyId, setBodyId] = useState<BodyAssetId>('A001');
  const bodyRef = useRef(bodyId);
  bodyRef.current = bodyId;
  const drag = useRef<{ id: number; last: Point } | null>(null);
  const drawRef = useRef<() => void>(() => {});

  // 그리기
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
      const k = (cssSize / LOGICAL_SIZE) * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawWorkbench(ctx);
      const snowman = sceneStore.getState().scene.snowman;
      renderLayers(ctx, snowman, { alpha: 0.6 });
      const b = ball.current;
      const r = rollRadius(b.distance);
      drawStackGhost(ctx, snowman, r);
      drawBall(ctx, b, r, bodyRef.current);
    };
    const requestDraw = () => {
      if (!raf && alive) raf = requestAnimationFrame(draw);
    };
    drawRef.current = requestDraw;
    draw();
    const offs = [sceneStore.subscribe(requestDraw), subscribeAssets(requestDraw), subscribeRenderCache(requestDraw)];
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((off) => off());
    };
  }, [cssSize]);

  useEffect(() => {
    drawRef.current();
  }, [bodyId]);

  useEffect(() => registerKeyboard(null, () => canvasRef.current), []);

  const roll = (dx: number, dy: number) => {
    const b = ball.current;
    const r0 = rollRadius(b.distance);
    const nx = clamp(b.x + dx, r0, LOGICAL_SIZE - r0);
    const ny = clamp(b.y + dy, r0, LOGICAL_SIZE - r0);
    const mx = nx - b.x;
    const my = ny - b.y;
    const moved = Math.hypot(mx, my);
    if (moved === 0) return;
    const distance = b.distance + moved;
    const r1 = rollRadius(distance);
    ball.current = {
      // 커진 만큼 경계 안으로
      x: clamp(nx, r1, LOGICAL_SIZE - r1),
      y: clamp(ny, r1, LOGICAL_SIZE - r1),
      distance,
      angle: b.angle + rollAngleDelta(mx + my * 0.6, r0),
    };
    setRadius(Math.round(r1));
    drawRef.current();
  };

  const toLogical = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const k = LOGICAL_SIZE / Math.max(1, rect.width);
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    canvasRef.current?.focus({ preventScroll: true });
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    drag.current = { id: e.pointerId, last: toLogical(e) };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = toLogical(e);
    roll(p.x - d.last.x, p.y - d.last.y);
    d.last = p;
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const add = () => {
    const r = rollRadius(ball.current.distance);
    const scale = radiusToScale(r);
    const snowman = sceneStore.getState().scene.snowman;
    const pos = stackPosition(snowman, r);
    const id = sceneStore.addLayer('snowman', bodyRef.current, { x: pos.x, y: pos.y, scaleX: scale, scaleY: scale, rotation: 0 });
    ball.current = newBall();
    setRadius(ROLL_MIN_RADIUS);
    drawRef.current();
    onAdded?.(id);
  };

  const restart = () => {
    ball.current = newBall();
    setRadius(ROLL_MIN_RADIUS);
    drawRef.current();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? 60 : 24;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (map[e.key]) {
      e.preventDefault();
      roll(...map[e.key]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  };

  const pct = Math.round(((radius - ROLL_MIN_RADIUS) / (ROLL_MAX_RADIUS - ROLL_MIN_RADIUS)) * 100);
  const left = Math.max(0, (size.w - cssSize) / 2);
  const top = Math.max(0, (size.h - cssSize) / 2);

  return (
    <div className={['somsom-roll', className].filter(Boolean).join(' ')} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: 0 }}>
      <div ref={areaRef} className="somsom-roll__area" style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, aspectRatio: size.collapsed ? '1 / 1' : undefined }}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label="눈덩이 굴리기 작업대. 끌어서 굴리면 눈덩이가 커집니다. 화살표 키로 굴리고 Enter로 바로 추가"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          style={{ position: 'absolute', left, top, width: cssSize, height: cssSize, display: 'block', touchAction: 'none', userSelect: 'none' }}
        />
      </div>
      <div className="somsom-roll__controls" role="group" aria-label="눈덩이 조절">
        <div className="somsom-roll__bodies" role="radiogroup" aria-label="눈덩이 모양">
          {BODY_ASSET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={bodyId === id}
              className="somsom-roll__body"
              data-active={bodyId === id || undefined}
              onClick={() => setBodyId(id)}
            >
              {BODY_LABELS[id]}
            </button>
          ))}
        </div>
        <output className="somsom-roll__size" aria-live="polite">크기 {pct}%</output>
        <button type="button" className="somsom-roll__restart" onClick={restart}>처음부터</button>
        <button type="button" className="somsom-roll__add" onClick={add}>바로 추가</button>
      </div>
    </div>
  );
}

function drawWorkbench(ctx: CanvasRenderingContext2D) {
  const a = getLoadedAsset(WORKBENCH_ID);
  if (a) {
    const s = Math.max(LOGICAL_SIZE / a.width, LOGICAL_SIZE / a.height);
    ctx.drawImage(a.image, (LOGICAL_SIZE - a.width * s) / 2, (LOGICAL_SIZE - a.height * s) / 2, a.width * s, a.height * s);
  } else {
    ctx.fillStyle = '#C9AE8E';
    ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
  }
}

function drawStackGhost(ctx: CanvasRenderingContext2D, snowman: Layer[], r: number) {
  const p = stackPosition(snowman, r);
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(254, 252, 247, 0.85)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, r: number, bodyId: BodyAssetId) {
  // 그림자 (왼쪽 위 자연광 → 오른쪽 아래)
  ctx.save();
  ctx.fillStyle = 'rgba(78, 60, 44, 0.22)';
  ctx.beginPath();
  ctx.ellipse(b.x + r * 0.18, b.y + r * 0.92, r * 0.9, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate((b.angle * Math.PI) / 180);
  const asset = getLoadedAsset(bodyId);
  if (asset) {
    const s = (r * 2) / Math.max(asset.width, asset.height);
    ctx.drawImage(asset.image, (-asset.width * s) / 2, (-asset.height * s) / 2, asset.width * s, asset.height * s);
  } else {
    ctx.fillStyle = '#FEFCF7';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 굴러가는 양모 섬유 결 (공 안쪽으로 제한)
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, r * 0.018);
  for (const f of FIBERS) {
    const x = f.x * r;
    const y = f.y * r;
    const l = f.len * r;
    const cx = Math.cos(f.dir) * l;
    const cy = Math.sin(f.dir) * l;
    ctx.strokeStyle = 'rgba(201, 185, 164, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x - cx / 2, y - cy / 2);
    ctx.quadraticCurveTo(x + f.bend * r, y - f.bend * r, x + cx / 2, y + cy / 2);
    ctx.stroke();
  }
  ctx.restore();
}
