// workshop-ui 소유: 작업 화면 레이아웃.
// PC(≥1024px): 좌측 카테고리 · 중앙 작업대 · 우측 조절 · 하단 목록.
// 모바일: 상단 캔버스 + 하단 재료 서랍(접힘/절반/확장, 손잡이 드래그·탭).
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useIsDesktop } from '../hooks';
import { clampHeight, cycleSnap, isTap, resolveSnap, snapHeights, type DrawerSnap } from '../drawerSnap';

export interface WorkLayoutProps {
  canvas: ReactNode;
  rail?: ReactNode;
  list?: ReactNode;
  controls?: ReactNode;
  /** 모바일 캔버스 하단 떠 있는 도구 (선택 객체 빠른 조절) */
  floating?: ReactNode;
  railLabel?: string;
  listLabel?: string;
  controlsLabel?: string;
  /** 조절 탭 강조 (선택 객체 있음) */
  controlsBadge?: boolean;
  /** 이 값이 바뀌면 모바일 서랍을 조절 탭으로 */
  focusControlsKey?: string | null;
}

const SNAP_LABEL: Record<DrawerSnap, string> = { collapsed: '접힘', half: '절반', expanded: '펼침' };

function useViewportH() {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 800 : window.visualViewport?.height ?? window.innerHeight));
  useEffect(() => {
    const vv = window.visualViewport;
    const up = () => setH(vv?.height ?? window.innerHeight);
    vv?.addEventListener('resize', up);
    window.addEventListener('resize', up);
    return () => {
      vv?.removeEventListener('resize', up);
      window.removeEventListener('resize', up);
    };
  }, []);
  return h;
}

export function MaterialDrawer({
  tabs,
  initial = 'half',
  activeTab,
  onTab,
  onRest,
}: {
  tabs: { id: string; label: string; badge?: boolean; content: ReactNode }[];
  initial?: DrawerSnap;
  activeTab: string;
  onTab: (id: string) => void;
  /** 캔버스 영역 확보용: 서랍이 차지하는 높이(절반 이하로 제한) */
  onRest?: (px: number) => void;
}) {
  const vh = useViewportH();
  const heights = snapHeights(vh);
  const [snap, setSnap] = useState<DrawerSnap>(initial);
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ y0: number; h0: number; t0: number; samples: { y: number; t: number }[] } | null>(null);

  const height = dragH ?? heights[snap];
  const rest = Math.min(heights[snap], heights.half);
  useEffect(() => {
    onRest?.(rest);
  }, [rest, onRest]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, h0: heights[snap], t0: e.timeStamp, samples: [{ y: e.clientY, t: e.timeStamp }] };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
    if (Math.abs(e.clientY - d.y0) > 4) setDragH(clampHeight(d.h0 + (d.y0 - e.clientY), heights));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (isTap(dy, e.timeStamp - d.t0)) {
      setDragH(null);
      setSnap((s) => cycleSnap(s));
      return;
    }
    const first = d.samples[0];
    const dt = Math.max(1, e.timeStamp - first.t);
    const velocity = (first.y - e.clientY) / dt; // 위로 양수
    const h = clampHeight(d.h0 - dy, heights);
    setSnap(resolveSnap(h, velocity, heights));
    setDragH(null);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSnap((s) => (s === 'collapsed' ? 'half' : 'expanded'));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSnap((s) => (s === 'expanded' ? 'half' : 'collapsed'));
    }
  };

  const collapsed = snap === 'collapsed' && dragH === null;
  const style = { '--drawer-h': `${height}px` } as CSSProperties;

  return (
    <section className={`drawer drawer--${snap}${dragH !== null ? ' drawer--dragging' : ''}`} style={style} aria-label="재료 서랍">
      <div
        className="drawer__head"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragH(null);
        }}
      >
        <button
          type="button"
          className="drawer__handle"
          aria-label={`재료 서랍 크기 바꾸기 (현재 ${SNAP_LABEL[snap]})`}
          aria-expanded={snap !== 'collapsed'}
          onKeyDown={onKey}
          onClick={(e) => {
            // 포인터 탭은 onUp 에서 처리. 키보드(Enter/Space)만 여기서.
            if (e.detail === 0) setSnap((s) => cycleSnap(s));
          }}
        >
          <span className="drawer__grip" aria-hidden="true" />
        </button>
        <div className="drawer__tabs" role="tablist" data-no-drag>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className="drawer__tab"
              onClick={() => {
                onTab(t.id);
                if (snap === 'collapsed') setSnap('half');
              }}
            >
              {t.label}
              {t.badge && <span className="dot" aria-label="(선택됨)" />}
            </button>
          ))}
        </div>
      </div>
      <div className="drawer__body" role="tabpanel" inert={collapsed} aria-hidden={collapsed}>
        {tabs.find((t) => t.id === activeTab)?.content}
      </div>
    </section>
  );
}

export function WorkLayout(p: WorkLayoutProps) {
  const desktop = useIsDesktop();
  const [tab, setTab] = useState('materials');
  const lastKey = useRef(p.focusControlsKey);
  useEffect(() => {
    if (p.focusControlsKey && p.focusControlsKey !== lastKey.current) setTab('controls');
    lastKey.current = p.focusControlsKey;
  }, [p.focusControlsKey]);
  const onTab = useCallback((id: string) => setTab(id), []);
  const [rest, setRest] = useState(0);

  if (desktop) {
    return (
      <div className="work work--desktop">
        {p.rail && (
          <nav className="work__rail" aria-label={p.railLabel ?? '카테고리'}>
            {p.rail}
          </nav>
        )}
        <div className="work__bench">{p.canvas}</div>
        <aside className="work__controls" aria-label={p.controlsLabel ?? '조절'}>
          {p.controls}
        </aside>
        {p.list && (
          <section className="work__list" aria-label={p.listLabel ?? '재료 목록'}>
            {p.list}
          </section>
        )}
      </div>
    );
  }
  return (
    <div className="work work--mobile" style={{ '--drawer-rest': `${rest}px` } as CSSProperties}>
      <div className="work__bench">
        {p.canvas}
        {p.floating && <div className="work__floating">{p.floating}</div>}
      </div>
      <MaterialDrawer
        activeTab={tab}
        onTab={onTab}
        onRest={setRest}
        tabs={[
          {
            id: 'materials',
            label: p.listLabel ?? '재료',
            content: (
              <>
                {p.rail && <div className="drawer__rail">{p.rail}</div>}
                {p.list}
              </>
            ),
          },
          { id: 'controls', label: p.controlsLabel ?? '조절', badge: p.controlsBadge, content: p.controls },
        ]}
      />
    </div>
  );
}
