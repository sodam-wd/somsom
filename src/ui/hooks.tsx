// workshop-ui 소유: 반응형/뷰포트/소재 훅.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAsset } from '../assets/loader';

export const DESKTOP_QUERY = '(min-width: 1024px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY);

/**
 * 가상 키보드 대응: visualViewport 로 가려진 아래 영역 높이를 CSS 변수(--kb)로 노출하고
 * 현재 높이(--vvh)를 제공한다. 입력 포커스 시 해당 요소를 보이는 영역 중앙으로 스크롤.
 */
export function useVisualViewportVars(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      const h = vv ? vv.height : window.innerHeight;
      const top = vv ? vv.offsetTop : 0;
      const kb = Math.max(0, window.innerHeight - h - top);
      root.style.setProperty('--kb', `${Math.round(kb)}px`);
      root.style.setProperty('--vvh', `${Math.round(h)}px`);
      root.classList.toggle('kb-open', kb > 120);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.matches('input:not([type=range]):not([type=color]):not([type=file]), textarea, select')) return;
      // 키보드가 올라온 뒤 위치 보정
      window.setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    };
    document.addEventListener('focusin', onFocus);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
}

/** UI 소재 에셋 → CSS url() 변수. 실제 PNG가 생기면 자동으로 교체된다. */
export const MATERIAL_IDS = ['UI01', 'UI02', 'UI03', 'UI04', 'UI05', 'UI06', 'UI07', 'UI11', 'UI13', 'UI14', 'UI15'] as const;
const MATERIAL_VAR: Record<(typeof MATERIAL_IDS)[number], string> = {
  UI01: '--mat-linen',
  UI02: '--mat-oak',
  UI03: '--mat-label',
  UI04: '--mat-felt-button',
  UI05: '--mat-tray',
  UI06: '--mat-paper',
  UI07: '--mat-wool-ball',
  UI11: '--mat-stamp',
  UI13: '--mat-name-tag',
  UI14: '--mat-needle',
  UI15: '--mat-display',
};

function MaterialVar({ id }: { id: (typeof MATERIAL_IDS)[number] }) {
  const a = useAsset(id);
  useEffect(() => {
    if (a) document.documentElement.style.setProperty(MATERIAL_VAR[id], `url("${a.url}")`);
  }, [a, id]);
  return null;
}

/**
 * 소재 에셋을 유휴 시간에 하나씩 로드한다. (실제 PNG가 없으면 임시 Canvas 생성이
 * 동기적으로 실행되므로 첫 화면 메인 스레드를 막지 않도록 분산)
 */
export function MaterialVars() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= MATERIAL_IDS.length) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(() => setN((v) => v + 1), { timeout: 600 });
      return () => w.cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(() => setN((v) => v + 1), n === 0 ? 300 : 60);
    return () => window.clearTimeout(t);
  }, [n]);
  return (
    <>
      {MATERIAL_IDS.slice(0, n).map((id) => (
        <MaterialVar key={id} id={id} />
      ))}
    </>
  );
}

/** 한 번 true 가 되면 유지 (지연 마운트 등) */
export function useLatch(v: boolean): boolean {
  const [s, set] = useState(v);
  useEffect(() => {
    if (v) set(true);
  }, [v]);
  return s || v;
}
