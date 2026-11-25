// editor-engine 소유 (T1). 편집 단축키 (EditorCanvas/RollCanvas 마운트 동안만, 가장 최근 캔버스 기준).
// 입력 요소(input/textarea/select/contenteditable) 포커스 시 무시.
import type { LayerTarget } from '../types/scene';
import { findLayer } from './store';
import { sceneStore } from './useEditor';

interface Entry { target: LayerTarget | null; el: () => HTMLElement | null }
const stack: Entry[] = [];
let installed = false;
let arrowGesture = false;

export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type;
    // 버튼류 input 은 단축키 허용
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'color', 'file'].includes(type);
  }
  return false;
}

/**
 * 대상 캔버스 선택: 포커스된 캔버스 → 선택 객체가 속한 target 의 캔버스 → 가장 최근 등록.
 */
function activeEntry(): Entry | undefined {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  const focused = stack.find((e) => {
    const el = e.el();
    return !!el && !!active && (el === active || el.contains(active));
  });
  if (focused) return focused;
  const { scene, selectedId } = sceneStore.getState();
  const found = selectedId ? findLayer(scene, selectedId) : null;
  if (found) {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].target === found.target) return stack[i];
  }
  return stack[stack.length - 1];
}

function onKeyDown(e: KeyboardEvent) {
  const top = activeEntry();
  if (!top || e.defaultPrevented || isTypingTarget(e.target)) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (mod && lower === 'z') {
    e.preventDefault();
    if (e.shiftKey) sceneStore.redo();
    else sceneStore.undo();
    return;
  }
  if (mod && lower === 'y') {
    e.preventDefault();
    sceneStore.redo();
    return;
  }
  if (!top.target) return; // RollCanvas: undo/redo 만

  const { scene, selectedId } = sceneStore.getState();
  const found = selectedId ? findLayer(scene, selectedId) : null;
  if (!found || found.target !== top.target) return;
  const { layer } = found;

  if (key === 'Escape') {
    sceneStore.select(null);
    return;
  }
  if (key === 'Delete' || key === 'Backspace') {
    e.preventDefault();
    sceneStore.removeLayer(layer.id);
    return;
  }
  if (mod && lower === 'd') {
    e.preventDefault();
    sceneStore.duplicateLayer(layer.id);
    return;
  }
  if (key === '[' || key === ']' || e.code === 'BracketLeft' || e.code === 'BracketRight') {
    if (mod && !e.shiftKey) return; // 브라우저 탐색 단축키와 충돌 방지
    e.preventDefault();
    const up = key === ']' || e.code === 'BracketRight';
    sceneStore.moveLayerZ(layer.id, e.shiftKey ? (up ? 'top' : 'bottom') : up ? 'up' : 'down');
    return;
  }
  if (key.startsWith('Arrow')) {
    // 화살표는 캔버스 또는 body 포커스일 때만 (페이지 스크롤/다른 컨트롤 보호)
    const el = top.el();
    const active = document.activeElement;
    if (active && active !== document.body && active !== el) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
    const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
    if (!arrowGesture) {
      arrowGesture = true;
      sceneStore.beginGesture();
    }
    sceneStore.updateLayer(layer.id, { x: layer.x + dx, y: layer.y + dy });
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (arrowGesture && e.key.startsWith('Arrow')) {
    arrowGesture = false;
    sceneStore.endGesture();
  }
}

function onBlur() {
  if (arrowGesture) {
    arrowGesture = false;
    sceneStore.endGesture();
  }
}

/** 단축키 등록. 반환 함수로 해제. */
export function registerKeyboard(target: LayerTarget | null, el: () => HTMLElement | null): () => void {
  const entry: Entry = { target, el };
  stack.push(entry);
  if (!installed && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    installed = true;
  }
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length && installed) {
      onBlur();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      installed = false;
    }
  };
}
