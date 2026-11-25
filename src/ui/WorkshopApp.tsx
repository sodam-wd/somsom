// workshop-ui 소유 (T2): 6단계 공방 앱 셸. Welcome → Roll → Dress → Build → Born → Keep.
// 언제든 이전 단계로 이동 가능하며 편집 상태는 sceneStore 에 보존된다.
// 단축키(Ctrl+Z 등)는 EditorCanvas/RollCanvas 가 처리하므로 앱 전체 단축키는 두지 않는다(중복 실행 방지).
import { useEffect, useRef, useState } from 'react';
import { engineReady, useEditor } from './engine';
import { MaterialVars, useVisualViewportVars } from './hooks';
import { STAGE_LABELS } from './labels';
import { hasWork } from './workFile';
import { AssetStatusPanel } from './components/AssetStatusPanel';
import { Notices, clearErrors } from './components/Notices';
import { TopBar } from './components/TopBar';
import { Welcome } from './stages/Welcome';
import { Roll } from './stages/Roll';
import { Dress } from './stages/Dress';
import { Build } from './stages/Build';
import { Born } from './stages/Born';
import { Keep } from './stages/Keep';

/** 새로고침/닫기 시 작업 손실 안내 (자동 저장은 P1) */
function useUnloadGuard() {
  const scene = useEditor((s) => s.scene);
  const dirty = hasWork(scene);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
}

export function WorkshopApp() {
  const stage = useEditor((s) => s.scene.stage);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useVisualViewportVars();
  useUnloadGuard();

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    clearErrors();
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [stage]);

  const openAssets = () => setAssetsOpen(true);

  return (
    <div className={`app app--${stage}`}>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <MaterialVars />
      {stage !== 'welcome' && <TopBar stage={stage} onOpenAssets={openAssets} />}
      <main id="main" className={`stage stage--${stage}`}>
        <h1 ref={heading} tabIndex={-1} className={stage === 'welcome' ? 'sr-only' : 'stage__title'}>
          <span className="stage__title-text">{STAGE_LABELS[stage].title}</span>
          {stage !== 'welcome' && <span className="stage__hint">{STAGE_LABELS[stage].hint}</span>}
        </h1>
        {!engineReady && (
          <p className="pending-module" role="alert">
            편집 엔진이 아직 연결되지 않았어요 (개발 중). 화면 구성만 확인할 수 있어요.
          </p>
        )}
        {stage === 'welcome' && <Welcome onOpenAssets={openAssets} />}
        {stage === 'roll' && <Roll />}
        {stage === 'dress' && <Dress />}
        {stage === 'build' && <Build />}
        {stage === 'born' && <Born />}
        {stage === 'keep' && <Keep />}
      </main>
      <Notices />
      <AssetStatusPanel open={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </div>
  );
}
