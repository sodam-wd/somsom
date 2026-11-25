// workshop-ui 소유: 상단 고정 바 — 단계 이동, undo/redo, 에셋 현황.
import { STAGES, type Stage } from '../../types/scene';
import { useAsset } from '../../assets/loader';
import { sceneStore, useEditor } from '../engine';
import { STAGE_LABELS } from '../labels';
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

export function TopBar({ stage, onOpenAssets }: { stage: Stage; onOpenAssets: () => void }) {
  const linen = useAsset('UI01');
  const temp = linen?.isPlaceholder;
  return (
    <header className="topbar">
      <button type="button" className="topbar__brand" onClick={() => sceneStore.setStage('welcome')} aria-label="somsom 처음 화면으로">
        <span className="topbar__mark" aria-hidden="true" />
        <span className="topbar__word">somsom</span>
      </button>
      <StageNav stage={stage} />
      <div className="topbar__tools">
        <UndoRedo />
        <button
          type="button"
          className={`icon-btn topbar__assets${temp ? ' has-temp' : ''}`}
          onClick={onOpenAssets}
          aria-label={temp ? '에셋 현황 (임시 에셋 사용 중)' : '에셋 현황'}
          title="에셋 현황"
        >
          <Icon name="info" />
          {temp && <span className="badge-temp badge-temp--dot">임시</span>}
        </button>
      </div>
    </header>
  );
}
