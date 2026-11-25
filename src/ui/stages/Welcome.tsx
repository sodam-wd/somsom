// workshop-ui 소유: Welcome — 로고와 작품, 시작/불러오기.
import { useAsset } from '../../assets/loader';
import { Icon } from '../components/Icon';
import { PlaceholderBadge } from '../components/AssetTile';
import { sceneStore, useEditor } from '../engine';
import { OpenWorkButton, hasWork } from '../workFile';

export function Welcome({ onOpenAssets }: { onOpenAssets: () => void }) {
  const logo = useAsset('B01');
  const scene = useEditor((s) => s.scene);
  const resume = hasWork(scene);

  const start = () => sceneStore.setStage(resume ? 'dress' : 'roll');
  const restart = () => {
    if (!window.confirm('지금 작업을 지우고 처음부터 시작할까요? 저장하지 않은 작업은 사라져요.')) return;
    sceneStore.reset();
    sceneStore.setStage('roll');
  };

  return (
    <div className="welcome">
      <div className="welcome__art">
        {logo ? (
          <img
            className="welcome__logo"
            src={logo.url}
            width={1536}
            height={1024}
            alt="somsom Little Winter — 유리 돔 안의 양모 펠트 눈사람 로고"
          />
        ) : (
          <div className="welcome__logo welcome__logo--loading" role="status">
            로고를 불러오는 중…
          </div>
        )}
        <PlaceholderBadge id="B01" />
      </div>
      <div className="welcome__panel">
        <p className="welcome__eyebrow">양모 펠트 눈사람 공방</p>
        <h1 className="welcome__title">나만의 눈사람 만들기</h1>
        <p className="welcome__lead">
          눈덩이를 굴려 몸을 만들고, 털실 소품으로 꾸미고, 작은 스노우볼에 담아 탄생 증명서와 함께 소장해요.
        </p>
        <div className="welcome__actions">
          <button type="button" className="btn btn--primary btn--large" onClick={start}>
            <Icon name="play" /> {resume ? '이어서 만들기' : '만들기 시작'}
          </button>
          <OpenWorkButton className="btn btn--paper btn--large">
            <Icon name="folder" /> 불러오기
          </OpenWorkButton>
          {resume && (
            <button type="button" className="btn btn--ghost" onClick={restart}>
              처음부터 새로 만들기
            </button>
          )}
        </div>
        <ul className="welcome__notes">
          <li>작업은 이 기기의 브라우저 안에서만 처리돼요. 사진도 밖으로 전송되지 않아요.</li>
          <li>새로고침하거나 창을 닫으면 작업이 사라져요. 소장 단계에서 작업 파일(JSON)로 저장해 두세요.</li>
        </ul>
        <button type="button" className="link-btn" onClick={onOpenAssets}>
          <Icon name="info" size={18} /> 에셋 현황 보기
        </button>
      </div>
    </div>
  );
}
