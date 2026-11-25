// studio-qa 소유 (T3). 내부/외부 배경 독립 편집 (D25): 없음 / 프리셋(제안) / 사용자 사진.
import { useEffect, useRef, useState } from 'react';
import { useAsset } from '../assets/loader';
import { ASSETS_BY_ID } from '../assets/manifest';
import { sceneStore, useEditor } from '../editor';
import type { BackgroundEditorProps } from '../types/contracts';
import { createDefaultBackground, LOGICAL_SIZE, type Background, type Photo } from '../types/scene';
import { BG_SCALE_MAX, BG_SCALE_MIN, clampBackground, toBackgroundPhoto } from './background';
import { useElementSize, usePointerGestures } from './hooks';
import { drawBackground, loadBackgroundSource } from './imageOps';
import { loadPhotoFile, PHOTO_ACCEPT } from './photoFile';
import { Slider } from './Slider';

export const BACKGROUND_PRESETS: { id: string; label: string }[] = [
  { id: 'BG01', label: '린넨 스튜디오' },
  { id: 'BG02', label: '겨울 창가' },
  { id: 'BG03', label: '크리스마스 조명' },
  { id: 'BG04', label: '겨울 밤' },
];

function PresetThumb({ id, label, selected, onSelect }: { id: string; label: string; selected: boolean; onSelect: () => void }) {
  const asset = useAsset(id);
  return (
    <button type="button" className="st-thumb" aria-pressed={selected} onClick={onSelect}>
      <span className="st-thumb__img" style={asset ? { backgroundImage: `url(${asset.url})` } : undefined} aria-hidden="true" />
      <span className="st-thumb__label">{label}</span>
      <span className="st-thumb__tags">
        <span className="st-tag" title="배경 4종은 제안 상태예요">제안</span>
        {asset?.isPlaceholder && <span className="st-tag st-tag--warn" title="실제 배경 이미지가 아직 없어 임시 그림을 보여줘요">임시</span>}
      </span>
    </button>
  );
}

function BackgroundPreview({ bg, aspect, onGesture }: { bg: Background; aspect: number; onGesture: ReturnType<typeof usePointerGestures> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [placeholder, setPlaceholder] = useState(false);

  useEffect(() => {
    let alive = true;
    const c = canvasRef.current;
    if (!c || box.width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(box.width * dpr);
    const h = Math.round((box.width / aspect) * dpr);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    setStatus('loading');
    loadBackgroundSource(bg)
      .then((src) => {
        if (!alive) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        if (src) drawBackground(ctx, src, bg, w, h);
        setPlaceholder(!!src?.isPlaceholder);
        setStatus('idle');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [bg, box.width, aspect]);

  return (
    <div className="st-bg-preview" ref={boxRef} style={{ aspectRatio: String(aspect) }} {...onGesture}>
      <canvas ref={canvasRef} role="img" aria-label="배경 미리보기. 끌어서 이동, 두 손가락으로 크기와 각도 조절" />
      {bg.kind === 'none' && <span className="st-bg-preview__empty">배경 없음</span>}
      {status === 'error' && <span className="st-bg-preview__empty st-error">배경을 그릴 수 없어요.</span>}
      {placeholder && <span className="st-tag st-tag--warn st-bg-preview__tag">임시 배경</span>}
    </div>
  );
}

export function BackgroundEditor({ which }: BackgroundEditorProps) {
  const bg = useEditor((s) => (which === 'inner' ? s.scene.innerBackground : s.scene.outerBackground));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPhoto, setLastPhoto] = useState<Photo | null>(bg.kind === 'photo' && bg.photo ? bg.photo : null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef(bg);
  bgRef.current = bg;
  const work = useRef<Background | null>(null);
  const [measureRef, measured] = useElementSize<HTMLDivElement>();
  const previewWidth = useRef(0);
  previewWidth.current = measured.width;

  useEffect(() => {
    if (bg.kind === 'photo' && bg.photo) setLastPhoto(bg.photo);
  }, [bg]);

  const set = (next: Background) => sceneStore.setBackground(which, clampBackground(next));
  const title = which === 'inner' ? '스노우볼 안쪽 배경' : '바깥 촬영 배경';
  const aspect = which === 'inner' ? 1 : 4 / 3;

  const choose = (kind: Background['kind'], presetId?: string) => {
    setError(null);
    if (kind === 'none') set({ ...bg, kind: 'none', presetId: undefined, photo: undefined });
    else if (kind === 'preset') set({ ...bg, kind: 'preset', presetId, photo: undefined });
    else if (lastPhoto) set({ ...bg, kind: 'photo', presetId: undefined, photo: lastPhoto });
    else fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await loadPhotoFile(file);
      if (!r.ok) {
        setError(r.error); // 기존 배경 유지
        return;
      }
      const photo = toBackgroundPhoto(r.value);
      setLastPhoto(photo);
      const cur = bgRef.current;
      set({ ...cur, kind: 'photo', presetId: undefined, photo });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const gestures = usePointerGestures(
    {
      onStart: () => {
        if (bgRef.current.kind === 'none') return;
        work.current = bgRef.current;
        sceneStore.beginGesture();
      },
      onMove: (d, count) => {
        const w = work.current;
        if (!w) return;
        const next = clampBackground({
          ...w,
          x: w.x + (d.dx / Math.max(1, previewWidth.current)) * LOGICAL_SIZE,
          y: w.y + (d.dy / Math.max(1, previewWidth.current / aspect)) * LOGICAL_SIZE,
          scale: w.scale * d.scale,
          rotation: count >= 2 ? w.rotation + d.rotation : w.rotation,
        });
        work.current = next;
        sceneStore.setBackground(which, next);
      },
      onEnd: () => {
        if (!work.current) return;
        work.current = null;
        sceneStore.endGesture();
      },
    },
    bg.kind !== 'none',
  );

  const tf = (key: 'x' | 'y' | 'scale' | 'rotation', label: string, min: number, max: number, step: number, format: (v: number) => string) => (
    <Slider
      label={label}
      value={bg[key]}
      min={min}
      max={max}
      step={step}
      format={format}
      disabled={bg.kind === 'none'}
      onChange={(v) => set({ ...bgRef.current, [key]: v })}
      onGestureStart={() => sceneStore.beginGesture()}
      onGestureEnd={() => sceneStore.endGesture()}
    />
  );
  const offset = (v: number) => `${Math.round(v - LOGICAL_SIZE / 2)}`;

  return (
    <section className="st-bg-editor" aria-label={title}>
      <h3 className="st-title">{title}</h3>
      <div className="st-choices" role="group" aria-label="배경 종류">
        <button type="button" className="st-thumb st-thumb--none" aria-pressed={bg.kind === 'none'} onClick={() => choose('none')}>
          <span className="st-thumb__img" aria-hidden="true" />
          <span className="st-thumb__label">없음</span>
        </button>
        {BACKGROUND_PRESETS.filter((p) => ASSETS_BY_ID[p.id]).map((p) => (
          <PresetThumb
            key={p.id}
            id={p.id}
            label={p.label}
            selected={bg.kind === 'preset' && bg.presetId === p.id}
            onSelect={() => choose('preset', p.id)}
          />
        ))}
        <button type="button" className="st-thumb st-thumb--photo" aria-pressed={bg.kind === 'photo'} onClick={() => choose('photo')} disabled={busy}>
          <span className="st-thumb__img" style={lastPhoto ? { backgroundImage: `url(${lastPhoto.dataUrl})` } : undefined} aria-hidden="true" />
          <span className="st-thumb__label">{busy ? '불러오는 중…' : '내 사진'}</span>
        </button>
      </div>
      <div className="st-row">
        <button type="button" className="st-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {lastPhoto ? '다른 사진 선택' : '사진 선택'}
        </button>
        <input ref={fileRef} type="file" accept={PHOTO_ACCEPT} hidden onChange={(e) => void onFile(e.currentTarget.files?.[0])} />
      </div>
      {error && (
        <p className="st-error" role="alert">
          {error} 기존 배경은 그대로예요.
          <button type="button" className="st-btn st-btn--ghost" onClick={() => fileRef.current?.click()}>
            다시 시도
          </button>
        </p>
      )}
      <p className="st-hint">사진은 이 기기에서만 처리되며 외부로 전송되지 않아요.</p>

      <div ref={measureRef}>
        <BackgroundPreview bg={bg} aspect={aspect} onGesture={gestures} />
      </div>

      <div className="st-sliders">
        {tf('x', '가로 위치', 0, LOGICAL_SIZE, 1, offset)}
        {tf('y', '세로 위치', 0, LOGICAL_SIZE, 1, offset)}
        {tf('scale', '크기', BG_SCALE_MIN, BG_SCALE_MAX, 0.01, (v) => `${Math.round(v * 100)}%`)}
        {tf('rotation', '회전', -180, 180, 1, (v) => `${Math.round(v)}°`)}
        <button
          type="button"
          className="st-btn st-btn--ghost"
          disabled={bg.kind === 'none'}
          onClick={() => {
            const d = createDefaultBackground();
            set({ ...bg, x: d.x, y: d.y, scale: d.scale, rotation: d.rotation });
          }}
        >
          위치·크기 초기화
        </button>
      </div>
    </section>
  );
}
