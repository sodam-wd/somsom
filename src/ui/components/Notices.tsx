// workshop-ui 소유: 안내/오류 알림 (aria-live). 오류는 직접 닫을 때까지 유지.
import { useSyncExternalStore } from 'react';
import { Icon } from './Icon';

export type NoticeKind = 'info' | 'success' | 'error';
export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
  action?: { label: string; run: () => void };
}

let list: Notice[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function notify(kind: NoticeKind, text: string, action?: Notice['action']): number {
  const id = ++seq;
  // 성공하면 이전 오류 안내는 정리
  const base = (kind === 'success' ? list.filter((n) => n.kind !== 'error') : list).filter((n) => n.text !== text);
  list = [...base.slice(-3), { id, kind, text, action }];
  emit();
  if (kind !== 'error') window.setTimeout(() => dismiss(id), action ? 7000 : 3800);
  return id;
}

/** 오류 알림 모두 닫기 (단계 이동/같은 작업 성공 시) */
export function clearErrors(): void {
  if (!list.some((n) => n.kind === 'error')) return;
  list = list.filter((n) => n.kind !== 'error');
  emit();
}

export function dismiss(id: number): void {
  list = list.filter((n) => n.id !== id);
  emit();
}

// 화면 읽기 프로그램 전용 짧은 안내 (시각 알림 없이)
let spoken = '';
export function announce(text: string): void {
  spoken = spoken === text ? `${text} ` : text;
  emit();
}

export function Notices() {
  const items = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => list,
  );
  const said = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => spoken,
  );
  return (
    <>
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {said}
    </div>
    <div className="notices" aria-live="polite" aria-atomic="false">
      {items.map((n) => (
        <div key={n.id} className={`notice notice--${n.kind}`} role={n.kind === 'error' ? 'alert' : 'status'}>
          <span className="notice__text">{n.text}</span>
          {n.action && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                n.action?.run();
                dismiss(n.id);
              }}
            >
              {n.action.label}
            </button>
          )}
          <button type="button" className="icon-btn icon-btn--small" onClick={() => dismiss(n.id)} aria-label="알림 닫기">
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
    </div>
    </>
  );
}
