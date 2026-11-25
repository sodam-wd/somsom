// editor-engine 소유 (T1). 요소 CSS 크기 추적 (ResizeObserver, 미지원 시 resize).
import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize { w: number; h: number; /** 부모가 높이를 주지 않아 높이 0 */ collapsed: boolean }

export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ w: 0, h: 0, collapsed: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const rh = Math.round(r.height);
      setSize((s) => {
        // 한 번 접힘이 감지되면 유지 (aspect-ratio 적용 후 다시 풀리며 깜박이는 것 방지)
        const collapsed = s.collapsed || (rh < 1 && w > 0);
        const h = collapsed ? w : rh;
        return s.w === w && s.h === h && s.collapsed === collapsed ? s : { w, h, collapsed };
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
