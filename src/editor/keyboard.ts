// editor-engine 소유 (T1). 편집 단축키 (EditorCanvas/RollCanvas 마운트 동안만, 가장 최근 캔버스 기준).
// 입력 요소(input/textarea/select/contenteditable) 포커스 시 무시.
import type { LayerTarget } from '../types/scene';
import { findLayer } from './store';
import { sceneStore } from './useEditor';
import { isBodyLayer } from './roll';

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

/** 이동 키 → 방향. 방향키, WASD(자판 위치 기준이라 한글 입력 상태의 ㅈㅁㄴㅇ도 같음). 조합키가 눌리면 null. */
const MOVE_BY_CODE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1],
};
const MOVE_BY_KEY: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
  ㅁ: [-1, 0], ㅇ: [1, 0], ㅈ: [0, -1], ㄴ: [0, 1],
};
export function moveKeyDir(e: { key: string; code?: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): [number, number] | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return (e.code && MOVE_BY_CODE[e.code]) || MOVE_BY_KEY[e.key.length === 1 ? e.key.toLowerCase() : e.key] || null;
}
/** 이동 키 식별자 (누르고 있는 키 추적용) */
export function moveKeyId(e: { key: string; code?: string }): string {
  return e.code || e.key;
}
/** 방향키가 원래 동작을 하는 컨트롤(슬라이더·라디오·탭·선택상자)에 포커스가 있으면 방향키는 양보 */
export function arrowBelongsToControl(e: { key: string }): boolean {
  if (!e.key.startsWith('Arrow')) return false;
  const a = typeof document !== 'undefined' ? document.activeElement : null;
  if (!(a instanceof HTMLElement)) return false;
  if (a.tagName === 'SELECT') return true;
  if (a.tagName === 'INPUT' && ['range', 'radio'].includes((a as HTMLInputElement).type)) return true;
  const role = a.getAttribute('role');
  return role === 'radio' || role === 'tab' || role === 'slider' || role === 'option';
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
    if (!isBodyLayer(layer)) sceneStore.duplicateLayer(layer.id);
    return;
  }
  if (key === '[' || key === ']' || e.code === 'BracketLeft' || e.code === 'BracketRight') {
    if (mod && !e.shiftKey) return; // 브라우저 탐색 단축키와 충돌 방지
    e.preventDefault();
    const up = key === ']' || e.code === 'BracketRight';
    sceneStore.moveLayerZ(layer.id, e.shiftKey ? (up ? 'top' : 'bottom') : up ? 'up' : 'down');
    return;
  }
  const dir = moveKeyDir(e);
  if (dir) {
    // 방향키·WASD(ㅈㅁㄴㅇ)로 선택한 객체 이동. 슬라이더 등 방향키를 쓰는 컨트롤에 포커스가 있으면 양보.
    if (arrowBelongsToControl(e)) return;
    e.preventDefault();
    const step = e.shiftKey ? 20 : 4;
    const dx = dir[0] * step;
    const dy = dir[1] * step;
    if (!arrowGesture) {
      arrowGesture = true;
      sceneStore.beginGesture();
    }
    sceneStore.updateLayer(layer.id, { x: layer.x + dx, y: layer.y + dy });
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (arrowGesture && moveKeyDir({ key: e.key, code: e.code, ctrlKey: false, metaKey: false, altKey: false })) {
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
