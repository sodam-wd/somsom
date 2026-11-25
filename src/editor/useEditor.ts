// editor-engine 소유 (T1). 장면 스토어 싱글턴 + React 훅.
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { EditorState } from '../types/contracts';
import { createSceneStore } from './store';

export const sceneStore = createSceneStore();

/**
 * useSyncExternalStore 기반 선택자 훅. 상태가 바뀌지 않으면 이전 선택 결과를 재사용한다.
 * 선택자는 가능한 한 원시값이나 장면 내부 참조를 반환할 것 (새 객체 생성 시 매 변경마다 리렌더).
 */
export function useEditor<T>(selector: (s: EditorState) => T): T {
  const memo = useRef<{ state: EditorState; selector: (s: EditorState) => T; value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const state = sceneStore.getState();
    const m = memo.current;
    if (m && m.state === state && m.selector === selector) return m.value;
    const value = selector(state);
    if (m && Object.is(m.value, value)) {
      memo.current = { state, selector, value: m.value };
      return m.value;
    }
    memo.current = { state, selector, value };
    return value;
  }, [selector]);
  return useSyncExternalStore(sceneStore.subscribe, getSnapshot, getSnapshot);
}
