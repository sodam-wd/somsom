// studio-qa 소유 (T3). 포인터 제스처(1손가락 이동, 2손가락 핀치/회전, 휠)와 요소 크기 훅.
import { useCallback, useEffect, useRef, useState, type RefCallback, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import { computeGestureDelta, type GestureDelta, type Pt } from './geometry';

export interface GestureHandlers {
  /** 첫 포인터가 닿을 때. target 은 시작한 요소(핸들 판별용). */
  onStart?: (target: EventTarget | null, pointerCount: number) => void;
  onMove?: (d: GestureDelta, pointerCount: number) => void;
  onEnd?: () => void;
}

/**
 * 요소에 펼쳐 쓰는 포인터 핸들러를 돌려준다. 좌표는 요소 기준 CSS px.
 * 요소에는 touch-action: none 을 지정해야 모바일 스크롤과 충돌하지 않는다.
 */
export function usePointerGestures(h: GestureHandlers, enabled = true) {
  const pts = useRef(new Map<number, Pt>());
  const hRef = useRef(h);
  hRef.current = h;
  const wheelTimer = useRef<number | null>(null);

  const local = (e: { clientX: number; clientY: number; currentTarget: Element }): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const finish = useCallback(() => {
    if (pts.current.size === 0) hRef.current.onEnd?.();
  }, []);

  useEffect(
    () => () => {
      if (wheelTimer.current != null) {
        window.clearTimeout(wheelTimer.current);
        hRef.current.onEnd?.();
      }
    },
    [],
  );

  const onPointerDown = (e: RPointerEvent<Element>) => {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 제스처 영역 안의 버튼·입력 요소는 일반 클릭으로 둔다 (포인터 캡처로 클릭을 빼앗지 않음)
    const t = e.target as Element | null;
    const interactive = t?.closest?.('button, a, input, select, textarea, label');
    if (interactive && interactive !== e.currentTarget && e.currentTarget.contains(interactive)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const first = pts.current.size === 0;
    pts.current.set(e.pointerId, local(e));
    if (first) hRef.current.onStart?.(e.target, 1);
    e.preventDefault();
  };

  const onPointerMove = (e: RPointerEvent<Element>) => {
    if (!pts.current.has(e.pointerId)) return;
    const prev = [...pts.current.values()].slice(0, 2);
    pts.current.set(e.pointerId, local(e));
    const next = [...pts.current.values()].slice(0, 2);
    const d = computeGestureDelta(prev, next);
    if (d.dx !== 0 || d.dy !== 0 || d.scale !== 1 || d.rotation !== 0) hRef.current.onMove?.(d, next.length);
  };

  const onPointerUp = (e: RPointerEvent<Element>) => {
    if (!pts.current.delete(e.pointerId)) return;
    finish();
  };

  const onWheel = (e: RWheelEvent<Element>) => {
    if (!enabled || e.deltaY === 0) return;
    if (wheelTimer.current == null) hRef.current.onStart?.(e.target, 0);
    else window.clearTimeout(wheelTimer.current);
    const scale = Math.exp(-e.deltaY * 0.0015);
    hRef.current.onMove?.({ dx: 0, dy: 0, scale, rotation: 0, center: local(e) }, 0);
    wheelTimer.current = window.setTimeout(() => {
      wheelTimer.current = null;
      hRef.current.onEnd?.();
    }, 250);
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onLostPointerCapture: onPointerUp,
    onWheel,
  };
}

/** ResizeObserver 기반 요소 크기 (CSS px) */
export function useElementSize<T extends Element>(): [RefCallback<T>, { width: number; height: number }] {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const obs = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    obs.current?.disconnect();
    obs.current = null;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.width - r.width) < 0.5 && Math.abs(s.height - r.height) < 0.5 ? s : { width: r.width, height: r.height }));
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      obs.current = new ResizeObserver(update);
      obs.current.observe(el);
    }
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);
  return [ref, size];
}

/** 최신 값만 처리하는 비동기 작업 (이전 결과 폐기) */
export function useLatestAsync<T>(fn: () => Promise<T>, deps: unknown[], delayMs = 0): { value: T | null; error: unknown; pending: boolean } {
  const [state, setState] = useState<{ value: T | null; error: unknown; pending: boolean }>({ value: null, error: null, pending: true });
  useEffect(() => {
    let alive = true;
    setState((s) => (s.pending ? s : { ...s, pending: true }));
    const run = () =>
      fn().then(
        (value) => alive && setState({ value, error: null, pending: false }),
        (error) => alive && setState((s) => ({ value: s.value, error, pending: false })),
      );
    const t = delayMs > 0 ? window.setTimeout(run, delayMs) : (run(), null);
    return () => {
      alive = false;
      if (t != null) window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
