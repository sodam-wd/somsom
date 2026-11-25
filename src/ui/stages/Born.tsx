// workshop-ui 소유: Born — 수제종이·도장 탄생 증명서 (이름·탄생일·성격·좋아하는 것·소개).
import { useEffect, useId, useRef, useState } from 'react';
import type { Scene } from '../../types/scene';
import { renderSnowman, sceneStore, useEditor } from '../engine';
import { Icon } from '../components/Icon';
import { TagInput } from '../components/TagInput';

const TRAIT_SUGGEST = ['포근한', '수줍은', '장난꾸러기', '다정한', '용감한', '느긋한', '호기심 많은'];
const LIKE_SUGGEST = ['코코아', '첫눈', '털실', '별빛', '장작불', '귤', '눈썰매'];

/** 눈사람 투명 미리보기 (render.renderSnowman, 변경 후 잠시 뒤 갱신) */
export function useSnowmanPreview(size = 512): { url: string | null; error: string | null } {
  const snowman = useEditor((s) => s.scene.snowman);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (snowman.length === 0) {
      setUrl(null);
      return;
    }
    let alive = true;
    const t = window.setTimeout(() => {
      const scene = sceneStore.getState().scene as Scene;
      renderSnowman(scene, { size })
        .then((c) => {
          if (alive) {
            setUrl(c.toDataURL('image/png'));
            setError(null);
          }
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [snowman, size]);
  return { url, error };
}

function formatDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : '____년 __월 __일';
}

export function CertificatePreview() {
  const profile = useEditor((s) => s.scene.profile);
  const { url, error } = useSnowmanPreview(480);
  return (
    <figure className="cert" aria-label="탄생 증명서 미리보기">
      <div className="cert__paper">
        <p className="cert__eyebrow">somsom · Little Winter</p>
        <h2 className="cert__title">탄생 증명서</h2>
        <div className="cert__portrait">
          {url ? (
            <img src={url} alt={`${profile.name || '이름 없는 눈사람'}의 모습`} />
          ) : (
            <span className="cert__portrait-empty">{error ? '미리보기를 그리지 못했어요' : '눈사람을 만들면 여기에 나타나요'}</span>
          )}
        </div>
        <dl className="cert__fields">
          <div>
            <dt>이름</dt>
            <dd className="cert__name">{profile.name || '이름을 지어 주세요'}</dd>
          </div>
          <div>
            <dt>탄생일</dt>
            <dd>{formatDate(profile.birthDate)}</dd>
          </div>
          <div>
            <dt>성격</dt>
            <dd>{profile.traits.length ? profile.traits.join(' · ') : '—'}</dd>
          </div>
          <div>
            <dt>좋아하는 것</dt>
            <dd>{profile.likes.length ? profile.likes.join(' · ') : '—'}</dd>
          </div>
        </dl>
        {profile.bio && <p className="cert__bio">“{profile.bio}”</p>}
        <p className="cert__footer">이 눈사람이 somsom 공방에서 한 땀 한 땀 태어났음을 증명합니다.</p>
        <span className="cert__stamp" aria-hidden="true" />
      </div>
    </figure>
  );
}

export function Born() {
  const profile = useEditor((s) => s.scene.profile);
  const nameId = useId();
  const dateId = useId();
  const bioId = useId();
  // 입력 한 번(포커스~블러)을 하나의 undo 단계로
  const editing = useRef(false);
  const begin = () => {
    if (!editing.current) {
      editing.current = true;
      sceneStore.beginGesture();
    }
  };
  const end = () => {
    if (editing.current) {
      editing.current = false;
      sceneStore.endGesture();
    }
  };
  useEffect(() => end, []);
  const today = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    sceneStore.setProfile({ birthDate: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` });
  };

  return (
    <div className="born">
      <div className="born__preview">
        <CertificatePreview />
      </div>
      <form className="born__form panel-linen" onSubmit={(e) => e.preventDefault()} aria-label="증명서 내용">
        <h2 className="stitch-title">눈사람 프로필</h2>
        <div className="field">
          <label htmlFor={nameId}>이름</label>
          <input
            id={nameId}
            type="text"
            value={profile.name}
            maxLength={16}
            autoComplete="off"
            enterKeyHint="next"
            placeholder="예: 솜이"
            onFocus={begin}
            onBlur={end}
            onChange={(e) => sceneStore.setProfile({ name: e.currentTarget.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={dateId}>탄생일</label>
          <div className="field__row">
            <input
              id={dateId}
              type="date"
              value={profile.birthDate}
              onChange={(e) => sceneStore.setProfile({ birthDate: e.currentTarget.value })}
            />
            <button type="button" className="btn btn--small" onClick={today}>
              오늘
            </button>
          </div>
        </div>
        <TagInput label="성격" value={profile.traits} onChange={(traits) => sceneStore.setProfile({ traits })} suggestions={TRAIT_SUGGEST} placeholder="직접 적고 Enter" />
        <TagInput label="좋아하는 것" value={profile.likes} onChange={(likes) => sceneStore.setProfile({ likes })} suggestions={LIKE_SUGGEST} placeholder="직접 적고 Enter" />
        <div className="field">
          <label htmlFor={bioId}>소개</label>
          <textarea
            id={bioId}
            rows={3}
            maxLength={120}
            value={profile.bio}
            placeholder="눈사람을 한두 문장으로 소개해 주세요"
            onFocus={begin}
            onBlur={end}
            onChange={(e) => sceneStore.setProfile({ bio: e.currentTarget.value })}
          />
          <span className="field__count" aria-live="off">
            {profile.bio.length}/120
          </span>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => sceneStore.setStage('keep')}>
          탄생 완료, 소장하러 가기 <Icon name="next" />
        </button>
      </form>
    </div>
  );
}
