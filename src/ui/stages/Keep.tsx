// workshop-ui 소유: Keep — Studio/Photo/Live/Clear 촬영, 외부 배경, PNG 3종·작업 JSON 출력.
import { useState } from 'react';
import type { StudioMode } from '../../types/contracts';
import {
  BackgroundEditor, StudioStage, canvasToBlob, renderCertificate, renderSnowGlobe, renderSnowman, sceneStore,
  shareOrDownload, useEditor,
} from '../engine';
import { Icon } from '../components/Icon';
import { notify } from '../components/Notices';
import { OpenWorkButton, saveWorkFile } from '../workFile';

const MODES: { id: StudioMode; label: string; desc: string }[] = [
  { id: 'studio', label: '스튜디오', desc: '프리셋 배경 위 촬영' },
  { id: 'photo', label: '사진', desc: '내 사진 배경에 합성' },
  { id: 'live', label: '라이브', desc: '카메라 화면에 2D 합성 (공간 추적 없음)' },
  { id: 'clear', label: '투명', desc: '배경 없이' },
];

type Job = 'snowman' | 'globe' | 'cert';
type Format = 'square' | 'portrait';

export function Keep() {
  const [mode, setMode] = useState<StudioMode>('studio');
  const [size, setSize] = useState<1080 | 2048>(1080);
  const [format, setFormat] = useState<Format>('square');
  const [withBg, setWithBg] = useState(true);
  const [busy, setBusy] = useState<Job | null>(null);
  const snowmanCount = useEditor((s) => s.scene.snowman.length);
  const name = useEditor((s) => s.scene.profile.name);

  const dims = () => (format === 'portrait' ? { width: 1080, height: 1920 } : { width: size, height: size });
  const base = name.trim() ? `somsom-${name.trim().replace(/[\\/:*?"<>|\s]+/g, '_')}` : 'somsom';

  const run = async (job: Job) => {
    if (busy) return;
    setBusy(job);
    try {
      const scene = sceneStore.getState().scene;
      let canvas: HTMLCanvasElement;
      let file: string;
      if (job === 'snowman') {
        canvas = await renderSnowman(scene, { size });
        file = `${base}-snowman-${size}.png`;
      } else if (job === 'globe') {
        const d = dims();
        canvas = await renderSnowGlobe(scene, { ...d, includeOuterBackground: withBg });
        file = `${base}-snowglobe-${d.width}x${d.height}.png`;
      } else {
        const d = dims();
        canvas = await renderCertificate(scene, d);
        file = `${base}-certificate-${d.width}x${d.height}.png`;
      }
      const blob = await canvasToBlob(canvas);
      const how = await shareOrDownload(blob, file);
      notify('success', how === 'shared' ? '공유 창을 열었어요.' : `${file} 파일을 저장했어요.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/abort/i.test(msg)) notify('info', '공유를 취소했어요.');
      else notify('error', `이미지를 만들지 못했어요. 다시 시도해 주세요. (${msg})`, { label: '다시 시도', run: () => void run(job) });
    } finally {
      setBusy(null);
    }
  };

  const onCapture = async (blob: Blob) => {
    try {
      const how = await shareOrDownload(blob, `${base}-${mode}-shot.png`);
      notify('success', how === 'shared' ? '공유 창을 열었어요.' : '촬영한 사진을 저장했어요.');
    } catch (e) {
      notify('error', `촬영 사진을 저장하지 못했어요. (${e instanceof Error ? e.message : String(e)})`);
    }
  };

  return (
    <div className="keep">
      <section className="keep__stage" aria-label="촬영">
        <div className="segmented segmented--modes" role="tablist" aria-label="촬영 모드">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} title={m.desc}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="hint keep__mode-desc">{MODES.find((m) => m.id === mode)?.desc}</p>
        <div className="keep__studio">
          <StudioStage mode={mode} className="studio-stage" onCapture={(b) => void onCapture(b)} onRequestMode={setMode} />
        </div>
      </section>

      <aside className="keep__side panel-linen" aria-label="배경과 저장">
        {(mode === 'studio' || mode === 'photo') && (
          <details className="fold" open>
            <summary>배경 고르기</summary>
            <p className="hint">유리 안쪽 배경과 따로 편집돼요.</p>
            <BackgroundEditor which="outer" />
          </details>
        )}

        <details className="fold" open>
          <summary>
            <Icon name="download" size={18} /> 이미지로 저장
          </summary>
          <div className="export-opts">
            <fieldset className="radio-row">
              <legend>크기</legend>
              <label>
                <input type="radio" name="fmt" checked={format === 'square' && size === 1080} onChange={() => (setFormat('square'), setSize(1080))} /> 정사각 1080
              </label>
              <label>
                <input type="radio" name="fmt" checked={format === 'square' && size === 2048} onChange={() => (setFormat('square'), setSize(2048))} /> 정사각 2048
              </label>
              <label>
                <input type="radio" name="fmt" checked={format === 'portrait'} onChange={() => setFormat('portrait')} /> 세로 1080×1920
              </label>
            </fieldset>
            <label className="check">
              <input type="checkbox" checked={withBg} onChange={(e) => setWithBg(e.currentTarget.checked)} /> 스노우볼에 바깥 배경 포함
            </label>
          </div>
          <div className="export-btns">
            <button type="button" className="btn btn--paper" onClick={() => void run('snowman')} disabled={!!busy || snowmanCount === 0} aria-busy={busy === 'snowman'}>
              {busy === 'snowman' ? '만드는 중…' : '투명 눈사람 PNG'}
            </button>
            <button type="button" className="btn btn--paper" onClick={() => void run('globe')} disabled={!!busy} aria-busy={busy === 'globe'}>
              {busy === 'globe' ? '만드는 중…' : '스노우볼 PNG'}
            </button>
            <button type="button" className="btn btn--paper" onClick={() => void run('cert')} disabled={!!busy} aria-busy={busy === 'cert'}>
              {busy === 'cert' ? '만드는 중…' : '탄생 증명서 PNG'}
            </button>
            <button type="button" className="btn btn--ghost" disabled aria-disabled="true" title="P1 기능으로 아직 준비 중이에요">
              스노우볼 GIF · 준비 중(P1)
            </button>
          </div>
          {snowmanCount === 0 && <p className="hint">눈사람이 없으면 투명 눈사람 PNG를 만들 수 없어요.</p>}
          <p className="hint">투명 눈사람 PNG는 항상 정사각({size}px)이에요. 세로 1080×1920은 스노우볼·증명서에 적용돼요. 모바일에서는 공유 창이 열릴 수 있어요.</p>
        </details>

        <details className="fold" open>
          <summary>
            <Icon name="save" size={18} /> 작업 파일
          </summary>
          <p className="hint">
            자동 저장은 아직 없어요(P1). 새로고침하거나 창을 닫으면 작업이 사라지니 작업 파일(JSON)로 저장해 두세요. 넣은 사진도 파일 안에 함께 저장돼요.
          </p>
          <div className="export-btns">
            <button type="button" className="btn btn--primary" onClick={saveWorkFile}>
              <Icon name="save" /> 작업 저장(JSON)
            </button>
            <OpenWorkButton className="btn btn--paper">
              <Icon name="folder" /> 작업 불러오기
            </OpenWorkButton>
          </div>
        </details>
      </aside>
    </div>
  );
}
