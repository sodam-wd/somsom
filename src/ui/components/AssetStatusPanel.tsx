// workshop-ui 소유: 에셋 현황 — 실제/임시 개수와 누락 파일 경로 목록.
import { useEffect, useRef, useState } from 'react';
import { getAssetStatus, useAsset } from '../../assets/loader';
import { ASSETS_BY_ID } from '../../assets/manifest';
import { assetLabel } from '../labels';
import { Icon } from './Icon';

type Status = Awaited<ReturnType<typeof getAssetStatus>>;

const GROUP_LABEL: Record<string, string> = {
  decor: '꾸미기 에셋 (확정 65종)',
  ui: 'UI 소재 (15종)',
  brand: '로고',
  background: '촬영 배경 (제안 4종)',
};

function groupOf(id: string): string {
  const e = ASSETS_BY_ID[id];
  if (!e) return 'decor';
  return e.category === 'background' ? 'background' : e.group;
}

function Thumb({ id }: { id: string }) {
  const a = useAsset(id);
  return a ? <img src={a.url} alt="" className="status__thumb" loading="lazy" /> : <span className="status__thumb" />;
}

export function AssetStatusPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || status) return;
    let alive = true;
    getAssetStatus()
      .then((s) => alive && setStatus(s))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [open, status]);

  const groups = status
    ? Object.entries(
        status.placeholder.reduce<Record<string, string[]>>((acc, id) => {
          (acc[groupOf(id)] ??= []).push(id);
          return acc;
        }, {}),
      )
    : [];

  return (
    <dialog ref={ref} className="sheet-dialog" aria-labelledby="asset-status-title" onClose={onClose} onCancel={onClose}>
      <div className="sheet-dialog__head">
        <h2 id="asset-status-title">에셋 현황</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
          <Icon name="close" />
        </button>
      </div>
      <div className="sheet-dialog__body">
        {error && <p role="alert">에셋 현황을 불러오지 못했어요: {error}</p>}
        {!status && !error && (
          <p role="status" className="loading">
            에셋을 확인하는 중…
          </p>
        )}
        {status && (
          <>
            <dl className="status__summary">
              <div>
                <dt>전체 예정 경로</dt>
                <dd>{status.total}</dd>
              </div>
              <div>
                <dt>실제 PNG</dt>
                <dd>{status.real.length}</dd>
              </div>
              <div>
                <dt>임시 에셋 사용</dt>
                <dd>{status.placeholder.length}</dd>
              </div>
            </dl>
            <p className="hint">
              임시 에셋은 화면 확인용으로 그린 것이며 최종 에셋이 아니에요. 아래 경로(public/ 기준)에 실제 PNG를 넣으면 코드 수정 없이 자동으로
              바뀌어요. 실제 PNG가 모두 준비되기 전에는 미완료 상태예요.
            </p>
            <label className="check">
              <input type="checkbox" checked={thumbs} onChange={(e) => setThumbs(e.currentTarget.checked)} /> 임시 에셋 미리보기 보기
            </label>
            {groups.map(([g, ids]) => (
              <section key={g} className="status__group">
                <h3>
                  {GROUP_LABEL[g] ?? g} · 누락 {ids.length}
                </h3>
                <ul className={`status__list${thumbs ? ' status__list--thumbs' : ''}`}>
                  {ids.map((id) => (
                    <li key={id}>
                      {thumbs && <Thumb id={id} />}
                      <code>{ASSETS_BY_ID[id]?.path}</code>
                      <span className="status__name">
                        {id} · {assetLabel(id)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {status.real.length > 0 && (
              <section className="status__group">
                <h3>실제 PNG 사용 중 · {status.real.length}</h3>
                <ul className="status__list">
                  {status.real.map((id) => (
                    <li key={id}>
                      <code>{ASSETS_BY_ID[id]?.path}</code>
                      <span className="status__name">
                        {id} · {assetLabel(id)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
