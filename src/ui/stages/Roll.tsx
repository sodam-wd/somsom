// workshop-ui 소유: Roll — 흰 펠트 바닥 전체에서 눈덩이를 굴리고, 옆 미리보기에서 크기를 보며 올리기.
import { RollCanvas, sceneStore, useEditor } from '../engine';
import { Icon } from '../components/Icon';
import { notify } from '../components/Notices';
import { useIsDesktop } from '../hooks';

const BODY_IDS = ['A001', 'A002', 'A003'];

export function Roll() {
  const bodies = useEditor((s) => s.scene.snowman.filter((l) => BODY_IDS.includes(l.assetId)).length);
  const desktop = useIsDesktop();

  return (
    <div className="roll">
      <RollCanvas
        className="roll__canvas"
        onAdded={() => {
          notify('success', '눈덩이를 올렸어요.');
        }}
      >
        <div className="roll__info">
          {desktop && (
            <ol className="steps">
              <li>펠트 바닥을 누른 채 끌면 굴러가며 커져요. 컴퓨터는 방향키·WASD로도 굴려요.</li>
              <li>원하는 크기가 되면 ‘올리기’를 눌러요. 위 미리보기의 점선 자리에 쌓여요.</li>
              <li>굴린 크기 그대로 눈사람이 돼요. 꾸미기에서는 크기를 바꾸지 않아요.</li>
            </ol>
          )}
          <p className="roll__count" aria-live="polite">
            쌓은 눈덩이 <strong>{bodies}</strong>개
          </p>
          <button type="button" className="btn btn--primary roll__next" onClick={() => sceneStore.setStage('dress')}>
            꾸미러 가기 <Icon name="next" />
          </button>
        </div>
      </RollCanvas>
    </div>
  );
}
