// editor-engine 소유 (T1). 스노우볼 라이브 미리보기: 흔들기 눈 입자 + 유리 클립.
import { useEffect, useRef } from 'react';
import type { SnowGlobeViewProps } from '../types/contracts';
import { subscribeAssets } from '../assets/loader';
import { sceneStore } from '../editor/useEditor';
import { subscribeRenderCache } from './images';
import { paintSnowGlobe } from './output';
import { useElementSize } from './useElementSize';
import { createFlakes, drawFlakes, shakeFlakes, stepFlakes, type Flake } from './particles';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const MAX_DPR = 2;

export function SnowGlobeView(props: SnowGlobeViewProps) {
  const { className, shakeKey, includeOuterBackground = false, interactive = true } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(wrapRef);
  const reduced = useRef(prefersReducedMotion());
  const flakesRef = useRef<Flake[]>(createFlakes(reduced.current ? 40 : 140, 7));
  const rafRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const animRef = useRef<() => void>(() => {});

  // 그리기 + 애니메이션
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w <= 0 || size.h <= 0) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let alive = true;
    let last = 0;
    let time = 0;

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintSnowGlobe(ctx, sceneStore.getState().scene, size.w, size.h, includeOuterBackground, (c) => {
        drawFlakes(c, flakesRef.current);
      });
    };
    const frame = (t: number) => {
      if (!alive) return;
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      time += dt;
      const moving = stepFlakes(flakesRef.current, dt, time);
      draw();
      rafRef.current = moving ? requestAnimationFrame(frame) : 0;
      if (!moving) last = 0;
    };
    const startAnim = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(frame);
    };
    const requestDraw = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame((t) => {
        rafRef.current = 0;
        if (!alive) return;
        if (flakesRef.current.some((f) => !f.settled)) frame(t);
        else draw();
      });
    };
    drawRef.current = requestDraw;
    animRef.current = startAnim;
    draw();
    if (flakesRef.current.some((f) => !f.settled)) startAnim();
    const offs = [
      sceneStore.subscribe(requestDraw),
      subscribeAssets(requestDraw),
      subscribeRenderCache(requestDraw),
    ];
    return () => {
      alive = false;
      offs.forEach((off) => off());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [size.w, size.h, includeOuterBackground]);

  const shake = () => {
    shakeFlakes(flakesRef.current, reduced.current ? 0.35 : 1);
    animRef.current();
  };

  // shakeKey 가 바뀌면 흔들기 (최초 마운트 제외)
  const prevKey = useRef(shakeKey);
  useEffect(() => {
    if (prevKey.current === shakeKey) return;
    prevKey.current = shakeKey;
    shake();
  }, [shakeKey]);

  // 모바일 흔들기 (권한 요청이 필요한 환경은 무시)
  useEffect(() => {
    if (!interactive || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DME.requestPermission === 'function') return;
    let lastShake = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity ?? e.acceleration;
      if (!a) return;
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      const now = Date.now();
      if (mag > 22 && now - lastShake > 1200) {
        lastShake = now;
        shake();
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [interactive]);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, aspectRatio: size.collapsed ? '1 / 1' : undefined }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={interactive ? '스노우볼 미리보기 — 눌러서 흔들기' : '스노우볼 미리보기'}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? shake : undefined}
        onKeyDown={interactive ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            shake();
          }
        } : undefined}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block',
          cursor: interactive ? 'pointer' : 'default',
        }}
      />
    </div>
  );
}
