// workshop-ui 소유: Roll — 원목 작업대에서 눈덩이 굴리기 + 바로 추가.
import { RollCanvas, sceneStore, useEditor } from '../engine';
import { Icon } from '../components/Icon';
import { notify } from '../components/Notices';

const BODY_IDS = ['A001', 'A002', 'A003'];

export function Roll() {
  const bodies = useEditor((s) => s.scene.snowman.filter((l) => BODY_IDS.includes(l.assetId)).length);

  return (
    <div className="roll">
      <div className="roll__bench bench bench-oak">
        <div className="roll__fill">
          <RollCanvas
            className="roll__canvas"
            onAdded={() => {
              notify('success', '눈덩이를 작업대에 올렸어요.');
            }}
          />
        </div>
        {bodies === 0 && (
          <p className="canvas-empty" aria-hidden="true">
            작업대를 꾹 누른 채 굴려 보세요
          </p>
        )}
      </div>
      <aside className="roll__side panel-linen" aria-label="굴리기 안내">
        <h2 className="stitch-title">눈덩이 굴리기</h2>
        <ol className="steps">
          <li>작업대 위를 누른 채 이리저리 끌면 눈덩이가 커져요.</li>
          <li>손을 떼면 눈덩이가 바로 추가되고 위로 쌓여요.</li>
          <li>드래그가 어렵다면 모양을 고르고 ‘바로 추가’를 눌러요.</li>
          <li>크기는 다음 단계에서 언제든 다시 조절할 수 있어요.</li>
        </ol>
        <p className="roll__count" aria-live="polite">
          지금 눈덩이 <strong>{bodies}</strong>개
        </p>
        <button type="button" className="btn btn--primary" onClick={() => sceneStore.setStage('dress')}>
          꾸미러 가기 <Icon name="next" />
        </button>
        {bodies === 0 && <p className="hint">눈덩이 없이 넘어가도 꾸미기의 ‘몸통’ 서랍에서 고를 수 있어요.</p>}
      </aside>
    </div>
  );
}
