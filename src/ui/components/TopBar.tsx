// workshop-ui 소유: 상단 고정 바 — 단계 이동, undo/redo, 에셋 현황.
import { STAGES, type Stage } from '../../types/scene';
import { sceneStore, useEditor } from '../engine';
import { STAGE_LABELS } from '../labels';
import type { CSSProperties } from 'react';
import { Icon } from './Icon';

export function UndoRedo() {
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  return (
    <div className="undo-redo" role="group" aria-label="되돌리기">
      <button type="button" className="icon-btn" onClick={() => sceneStore.undo()} disabled={!canUndo} aria-label="실행 취소 (Ctrl+Z)" title="실행 취소">
        <Icon name="undo" />
      </button>
      <button type="button" className="icon-btn" onClick={() => sceneStore.redo()} disabled={!canRedo} aria-label="다시 실행 (Ctrl+Shift+Z)" title="다시 실행">
        <Icon name="redo" />
      </button>
    </div>
  );
}

export function StageNav({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage);
  const go = (s: Stage) => sceneStore.setStage(s);
  return (
    <nav className="stage-nav" aria-label="제작 단계">
      <button type="button" className="icon-btn stage-nav__step" onClick={() => go(STAGES[idx - 1])} disabled={idx <= 0} aria-label="이전 단계">
        <Icon name="prev" />
      </button>
      <ol className="stage-nav__list">
        {STAGES.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              className="stage-nav__item"
              aria-current={s === stage ? 'step' : undefined}
              data-done={i < idx || undefined}
              onClick={() => go(s)}
              aria-label={`${i + 1}단계 ${STAGE_LABELS[s].short}`}
            >
              <span className="stage-nav__num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="stage-nav__label" aria-hidden="true">
                {STAGE_LABELS[s].short}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="icon-btn stage-nav__step"
        onClick={() => go(STAGES[idx + 1])}
        disabled={idx >= STAGES.length - 1}
        aria-label="다음 단계"
      >
        <Icon name="next" />
      </button>
    </nav>
  );
}

/** 메인 로고(1536×1024) 안의 영역 [x, y, w, h] */
const LOGO_SRC = `${import.meta.env.BASE_URL}assets/brand/logo-main.png`;
const LOGO_W = 1536;
const LOGO_H = 1024;
const LOGO_GLOBE = [400, 20, 730, 685] as const;
const LOGO_WORD = [215, 712, 1090, 303] as const;
const BRAND_H = 40;

function logoCrop([x, y, w, h]: readonly [number, number, number, number]): CSSProperties {
  const s = BRAND_H / h;
  return {
    width: `${Math.round(w * s)}px`,
    height: `${BRAND_H}px`,
    backgroundImage: `url("${LOGO_SRC}")`,
    backgroundSize: `${LOGO_W * s}px ${LOGO_H * s}px`,
    backgroundPosition: `${-x * s}px ${-y * s}px`,
    backgroundRepeat: 'no-repeat',
  };
}

export function TopBar({ stage }: { stage: Stage }) {
  return (
    <header className="topbar">
      <button type="button" className="topbar__brand" onClick={() => sceneStore.setStage('welcome')} aria-label="somsom 처음 화면으로">
        {/* 확정 로고(세로형) 원본 파일을 그대로 쓰고, 표시만 스노우볼(위)·워드마크(아래)를 잘라 가로로 붙인다 */}
        <span className="topbar__mark" aria-hidden="true" style={logoCrop(LOGO_GLOBE)} />
        <span className="topbar__word" aria-hidden="true" style={logoCrop(LOGO_WORD)} />
      </button>
      <StageNav stage={stage} />
      <div className="topbar__tools">
        <UndoRedo />
      </div>
    </header>
  );
}
