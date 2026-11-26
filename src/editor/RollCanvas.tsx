// editor-engine 소유 (T1). Roll 단계 (D11): 흰 펠트 바닥 전체에서 눈덩이를 굴려 키우고 옆 미리보기에 추가.
// - 굴리는 영역: 화면 가득 흰 펠트. 지나간 자리에 눌린 자국이 남는다.
// - 크기 표시·쌓일 자리 미리보기·추가는 옆(모바일은 아래) 패널에서.
import {
  useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent,
} from 'react';
import { LOGICAL_SIZE, type Layer } from '../types/scene';
import type { RollCanvasProps } from '../types/contracts';
import { getLoadedAsset, subscribeAssets } from '../assets/loader';
import { renderLayers } from '../render/layers';
import { subscribeRenderCache } from '../render/images';
import { seededRandom } from '../render/pixels';
import { useElementSize } from '../render/useElementSize';
import { sceneStore, useEditor } from './useEditor';
import { registerKeyboard } from './keyboard';
import {
  BODY_ASSET_IDS, ROLL_MAX_RADIUS, ROLL_MIN_RADIUS, isBodyLayer, radiusToScale, rollAngleDelta, rollRadius,
  stackPosition, type BodyAssetId,
} from './roll';
import { type Point } from './transforms';

const MAX_DPR = 2;
const BODY_LABELS: Record<BodyAssetId, string> = { A001: '동글', A002: '타원', A003: '울퉁불퉁' };

/** 공 상태: 위치는 CSS px, 굴린 거리는 논리 단위 */
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

/** 흰 양모 펠트 바닥 무늬 (한 번만 생성, 반복 타일) */
let feltTile: HTMLCanvasElement | null = null;
function getFeltTile(): HTMLCanvasElement {
  if (feltTile) return feltTile;
  const S = 320;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = '#FBF8F2';
  ctx.fillRect(0, 0, S, S);
  const rnd = seededRandom(77);
  // 부드러운 얼룩 (펠트 밀도 차이)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 20 + rnd() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() < 0.5 ? '232, 224, 211' : '255, 255, 255';
    g.addColorStop(0, `rgba(${tone}, ${0.18 + rnd() * 0.18})`);
    g.addColorStop(1, `rgba(${tone}, 0)`);
    ctx.fillStyle = g;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }
  }
  // 섬유 결
  ctx.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 4 + rnd() * 12;
    const a = rnd() * Math.PI * 2;
    const dark = rnd() < 0.55;
    ctx.strokeStyle = dark ? `rgba(196, 184, 166, ${0.12 + rnd() * 0.16})` : `rgba(255, 255, 255, ${0.5 + rnd() * 0.4})`;
    ctx.lineWidth = 0.5 + rnd() * 0.8;
    const bx = Math.cos(a + 1.2) * len * 0.25;
    const by = Math.sin(a + 1.2) * len * 0.25;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const px = x + ox;
      const py = y + oy;
      if (px < -20 || py < -20 || px > S + 20 || py > S + 20) continue;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + bx, py + Math.sin(a) * len * 0.5 + by, px + Math.cos(a) * len, py + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  feltTile = c;
  return c;
}

export function RollCanvas(props: RollCanvasProps) {
  const { onAdded, className, children } = props;
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(fieldRef);
  const pSize = useElementSize(previewBoxRef);
  const previewCss = Math.max(0, Math.min(pSize.w, pSize.h));
  /** 논리 1단위당 CSS px (필드 짧은 변 = 1000) */
  const unit = Math.max(0.1, Math.min(size.w, size.h) / LOGICAL_SIZE);
  const unitRef = useRef(unit);
  unitRef.current = unit;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const ball = useRef<Ball | null>(null);
  const trail = useRef<HTMLCanvasElement | null>(null);
  /** 지금 굴리는 중인 자국 (한 번에 이어 그려야 겹친 마디가 진해지지 않는다) */
  const stroke = useRef<TrailPoint[] | null>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const [radius, setRadius] = useState(ROLL_MIN_RADIUS);
  const [bodyId, setBodyId] = useState<BodyAssetId>('A001');
  const bodyRef = useRef(bodyId);
  bodyRef.current = bodyId;
  const drag = useRef<{ id: number; last: Point } | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const drawPreviewRef = useRef<() => void>(() => {});
  const bodies = useEditor((s) => s.scene.snowman.filter(isBodyLayer).length);

  const centerBall = (): Ball => ({ x: sizeRef.current.w / 2, y: sizeRef.current.h / 2, distance: 0, angle: 0 });

  // ── 필드 그리기 ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const { w, h } = size;
    if (!canvas || w <= 0 || h <= 0) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // 자국 캔버스: 크기가 바뀌면 이전 자국을 늘려 옮긴다
    const old = trail.current;
    const t = document.createElement('canvas');
    t.width = canvas.width;
    t.height = canvas.height;
    if (old && old.width > 0) t.getContext('2d')?.drawImage(old, 0, 0, t.width, t.height);
    trail.current = t;
    if (!ball.current) ball.current = centerBall();
    else {
      const r = rollRadius(ball.current.distance) * unitRef.current;
      ball.current.x = Math.min(Math.max(ball.current.x, r), Math.max(r, w - r));
      ball.current.y = Math.min(Math.max(ball.current.y, r), Math.max(r, h - r));
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    const draw = () => {
      raf = 0;
      if (!alive) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const pattern = ctx.createPattern(getFeltTile(), 'repeat');
      ctx.fillStyle = pattern ?? '#FBF8F2';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(t, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stroke.current) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawTrail(ctx, stroke.current, getScratch(canvas.width, canvas.height), dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const b = ball.current;
      if (b) drawBall(ctx, b, rollRadius(b.distance) * unitRef.current, bodyRef.current);
    };
    const requestDraw = () => {
      if (!raf && alive) raf = requestAnimationFrame(draw);
    };
    drawRef.current = requestDraw;
    draw();
    const offs = [subscribeAssets(requestDraw), subscribeRenderCache(requestDraw)];
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((off) => off());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  // ── 옆 미리보기: 쌓인 눈덩이 + 다음에 올라갈 자리 ──────────
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || previewCss <= 0) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    canvas.width = Math.round(previewCss * dpr);
    canvas.height = Math.round(previewCss * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    const draw = () => {
      raf = 0;
      if (!alive) return;
      const k = (previewCss / LOGICAL_SIZE) * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const snowman = sceneStore.getState().scene.snowman;
      renderLayers(ctx, snowman);
      const b = ball.current;
      drawStackGhost(ctx, snowman, rollRadius(b?.distance ?? 0), bodyRef.current);
    };
    const requestDraw = () => {
      if (!raf && alive) raf = requestAnimationFrame(draw);
    };
    drawPreviewRef.current = requestDraw;
    draw();
    const offs = [sceneStore.subscribe(requestDraw), subscribeAssets(requestDraw), subscribeRenderCache(requestDraw)];
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((off) => off());
    };
  }, [previewCss]);

  useEffect(() => {
    drawRef.current();
    drawPreviewRef.current();
  }, [bodyId]);

  useEffect(() => registerKeyboard(null, () => canvasRef.current), []);

  const getScratch = (w: number, h: number) => {
    let c = scratch.current;
    if (!c) c = scratch.current = document.createElement('canvas');
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  };

  /** 이어 그리던 자국을 바닥(자국 캔버스)에 굳힌다 */
  const commitStroke = () => {
    const st = stroke.current;
    stroke.current = null;
    const t = trail.current;
    const ctx = t?.getContext('2d');
    if (!st || !t || !ctx || st.length < 2) return;
    const dpr = t.width / Math.max(1, sizeRef.current.w);
    drawTrail(ctx, st, getScratch(t.width, t.height), dpr);
  };

  /** 지나간 자리 자국 (눌린 펠트) */
  const stamp = (from: Point, to: Point, r: number) => {
    if (!stroke.current) stroke.current = [{ ...from, r }];
    stroke.current.push({ ...to, r });
    // 아주 긴 경로는 나눠 굳혀 매 프레임 그리는 양을 제한
    if (stroke.current.length > 240) {
      const last = stroke.current[stroke.current.length - 1];
      commitStroke();
      stroke.current = [last];
    }
  };

  const roll = (dx: number, dy: number) => {
    const b = ball.current;
    const { w, h } = sizeRef.current;
    if (!b || w <= 0) return;
    const u = unitRef.current;
    const r0 = rollRadius(b.distance) * u;
    const clampX = (x: number, r: number) => Math.min(Math.max(x, r), Math.max(r, w - r));
    const clampY = (y: number, r: number) => Math.min(Math.max(y, r), Math.max(r, h - r));
    const nx = clampX(b.x + dx, r0);
    const ny = clampY(b.y + dy, r0);
    const mx = nx - b.x;
    const my = ny - b.y;
    const moved = Math.hypot(mx, my);
    if (moved === 0) return;
    const distance = b.distance + moved / u;
    const r1 = rollRadius(distance) * u;
    const next: Ball = {
      x: clampX(nx, r1),
      y: clampY(ny, r1),
      distance,
      angle: b.angle + rollAngleDelta(mx + my * 0.6, r0),
    };
    // 바닥에 닿는 자리(공 아래쪽)에 자국
    stamp({ x: b.x, y: b.y + r0 * 0.55 }, { x: next.x, y: next.y + r1 * 0.55 }, r1);
    ball.current = next;
    setRadius(Math.round(rollRadius(distance)));
    drawRef.current();
    drawPreviewRef.current();
  };

  const toLocal = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    canvasRef.current?.focus({ preventScroll: true });
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    drag.current = { id: e.pointerId, last: toLocal(e) };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = toLocal(e);
    roll(p.x - d.last.x, p.y - d.last.y);
    d.last = p;
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      commitStroke();
      drawRef.current();
    }
  };

  const resetBall = () => {
    const b = ball.current;
    // 다음 눈덩이는 지금 자리에서 작게 다시 시작 (자국은 그대로)
    ball.current = b ? { x: b.x, y: b.y, distance: 0, angle: 0 } : centerBall();
    setRadius(ROLL_MIN_RADIUS);
    drawRef.current();
    drawPreviewRef.current();
  };

  const add = () => {
    const r = rollRadius(ball.current?.distance ?? 0);
    const scale = radiusToScale(r);
    const snowman = sceneStore.getState().scene.snowman;
    const pos = stackPosition(snowman, r);
    const id = sceneStore.addLayer('snowman', bodyRef.current, { x: pos.x, y: pos.y, scaleX: scale, scaleY: scale, rotation: 0 });
    resetBall();
    onAdded?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = (e.shiftKey ? 60 : 24) * unitRef.current;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (map[e.key]) {
      e.preventDefault();
      roll(...map[e.key]);
      commitStroke();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  };

  const pct = Math.round(((radius - ROLL_MIN_RADIUS) / (ROLL_MAX_RADIUS - ROLL_MIN_RADIUS)) * 100);

  return (
    <div className={['somsom-roll', className].filter(Boolean).join(' ')}>
      <div ref={fieldRef} className="somsom-roll__field">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label="눈덩이 굴리기 펠트 바닥. 아무 곳이나 누른 채 끌면 눈덩이가 굴러가며 커집니다. 화살표 키로 굴리고 Enter로 추가"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none', userSelect: 'none' }}
        />
      </div>
      <aside className="somsom-roll__side" aria-label="눈덩이 크기와 추가">
        <div className="somsom-roll__preview">
          <div ref={previewBoxRef} className="somsom-roll__preview-box">
            <canvas
              ref={previewRef}
              role="img"
              aria-label={`쌓은 눈덩이 ${bodies}개와 다음 눈덩이가 올라갈 자리 미리보기`}
              style={{ width: previewCss, height: previewCss, display: 'block' }}
            />
          </div>
          <output className="somsom-roll__size" aria-live="polite">
            지금 눈덩이 <strong>{pct}%</strong>
          </output>
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
          <div className="somsom-roll__actions">
            <button type="button" className="btn btn--ghost somsom-roll__restart" onClick={resetBall}>처음부터</button>
            <button type="button" className="btn btn--primary somsom-roll__add" onClick={add}>올리기</button>
          </div>
        </div>
        {children}
      </aside>
    </div>
  );
}

interface TrailPoint { x: number; y: number; r: number }

/**
 * 눌린 펠트 자국. 한 번 굴린 경로는 불투명하게 따로 그린 뒤 옅게 얹어서,
 * 같은 경로 안에서 겹친 마디가 진해지지 않게 한다 (다른 때 굴린 자국끼리는 자연스럽게 겹쳐 진해짐).
 * ctx 는 기기 픽셀 좌표(변환 없음), 점은 CSS px.
 */
function drawTrail(ctx: CanvasRenderingContext2D, pts: TrailPoint[], scratch: HTMLCanvasElement, dpr: number) {
  if (pts.length < 2) return;
  const s = scratch.getContext('2d');
  if (!s) return;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, scratch.width, scratch.height);
  s.setTransform(dpr, 0, 0, dpr, 0, 0);
  s.lineCap = 'round';
  s.lineJoin = 'round';
  const pass = (color: string, k: number) => {
    s.strokeStyle = color;
    for (let i = 1; i < pts.length; i++) {
      s.lineWidth = pts[i].r * k;
      s.beginPath();
      s.moveTo(pts[i - 1].x, pts[i - 1].y);
      s.lineTo(pts[i].x, pts[i].y);
      s.stroke();
    }
  };
  pass('rgb(200, 188, 170)', 1.35);
  pass('rgb(178, 163, 142)', 0.6);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.22;
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

/** 미리보기: 다음 눈덩이가 쌓일 자리 (점선 + 반투명 눈덩이) */
function drawStackGhost(ctx: CanvasRenderingContext2D, snowman: Layer[], r: number, bodyId: BodyAssetId) {
  const p = stackPosition(snowman, r);
  ctx.save();
  const asset = getLoadedAsset(bodyId);
  if (asset) {
    const s = (r * 2) / Math.max(asset.width, asset.height);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(asset.image, p.x - (asset.width * s) / 2, p.y - (asset.height * s) / 2, asset.width * s, asset.height * s);
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(127, 146, 119, 0.9)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, r: number, bodyId: BodyAssetId) {
  // 그림자 (왼쪽 위 자연광 → 오른쪽 아래)
  ctx.save();
  ctx.fillStyle = 'rgba(120, 100, 80, 0.2)';
  ctx.beginPath();
  ctx.ellipse(b.x + r * 0.16, b.y + r * 0.9, r * 0.88, r * 0.2, 0, 0, Math.PI * 2);
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
  ctx.lineWidth = Math.max(1, r * 0.018);
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
