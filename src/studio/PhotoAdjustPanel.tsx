// studio-qa 소유 (T3). 얼굴 사진 조절: 수동 crop + 채도/밝기/대비/경계/양모 질감.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { PhotoAdjustPanelProps } from '../types/contracts';
import type { Photo, PhotoCrop } from '../types/scene';
import { renderPhoto } from '../render';
import { clampCrop, containRect, moveCrop, resizeCrop, scaleCrop, type CropHandle } from './geometry';
import { useElementSize, usePointerGestures } from './hooks';
import { loadDataUrlImage } from './photoFile';
import { Slider } from './Slider';

const PREVIEW_SIZE = 240;
const HANDLES: CropHandle[] = ['nw', 'ne', 'sw', 'se'];
const HANDLE_LABEL: Record<CropHandle, string> = { nw: '왼쪽 위', ne: '오른쪽 위', sw: '왼쪽 아래', se: '오른쪽 아래' };

export const DEFAULT_ADJUST: Pick<Photo, 'saturation' | 'brightness' | 'contrast' | 'feather' | 'textureStrength'> = {
  saturation: 1,
  brightness: 1,
  contrast: 1,
  feather: 0.35,
  textureStrength: 0.4,
};

function defaultCrop(w: number, h: number): PhotoCrop {
  const s = Math.min(w, h);
  return { x: (w - s) / 2, y: (h - s) / 2, width: s, height: s };
}

/** 미리보기: render 의 renderPhoto(photo,size) 결과를 그린다 (최신 요청만 반영). */
function PhotoPreview({ photo }: { photo: Photo }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      renderPhoto(photo, PREVIEW_SIZE * 2)
        .then((c) => {
          if (!alive || !ref.current) return;
          const ctx = ref.current.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, ref.current.width, ref.current.height);
          ctx.drawImage(c, 0, 0, ref.current.width, ref.current.height);
          setState('ready');
        })
        .catch(() => alive && setState('error'));
    }, 40);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [photo]);
  return (
    <figure className="st-photo-preview">
      <canvas ref={ref} width={PREVIEW_SIZE * 2} height={PREVIEW_SIZE * 2} role="img" aria-label="얼굴 사진 합성 미리보기" />
      <figcaption>
        {state === 'loading' && '미리보기 준비 중…'}
        {state === 'error' && '미리보기를 만들 수 없어요.'}
        {state === 'ready' && '미리보기'}
      </figcaption>
    </figure>
  );
}

export function PhotoAdjustPanel({ photo, onChange, onGestureStart, onGestureEnd }: PhotoAdjustPanelProps) {
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [imgError, setImgError] = useState(false);
  const [square, setSquare] = useState(true);
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const helpId = useId();

  useEffect(() => {
    let alive = true;
    setImgError(false);
    loadDataUrlImage(photo.dataUrl)
      .then((i) => alive && setImg({ w: i.naturalWidth, h: i.naturalHeight }))
      .catch(() => alive && setImgError(true));
    return () => {
      alive = false;
    };
  }, [photo.dataUrl]);

  // 이미지 표시 영역 (contain)
  const disp = img && box.width > 0 ? containRect(img.w, img.h, box.width, box.height) : null;
  const k = disp && img ? disp.width / img.w : 1; // 원본 px → 표시 px

  // 제스처 중 작업 crop (props 지연과 무관하게 누적)
  const work = useRef<{ crop: PhotoCrop; mode: 'move' | CropHandle } | null>(null);
  const photoRef = useRef(photo);
  photoRef.current = photo;

  const gestures = usePointerGestures(
    {
      onStart: (target, count) => {
        if (!img) return;
        const handle = (target as HTMLElement | null)?.dataset?.handle as CropHandle | undefined;
        work.current = { crop: photoRef.current.crop, mode: count === 1 && handle ? handle : 'move' };
        onGestureStart?.();
      },
      onMove: (d, count) => {
        if (!img || !work.current) return;
        const w = work.current;
        let c = w.crop;
        if (count >= 2 || count === 0) {
          // 핀치/휠: 크기 조절 (손가락을 벌리면 crop 확대)
          c = scaleCrop(c, d.scale, img.w, img.h);
          if (count >= 2) c = moveCrop(c, d.dx / k, d.dy / k, img.w, img.h);
        } else if (w.mode === 'move') {
          c = moveCrop(c, d.dx / k, d.dy / k, img.w, img.h);
        } else {
          c = resizeCrop(c, w.mode, d.dx / k, d.dy / k, img.w, img.h, square);
        }
        w.crop = c;
        onChange({ crop: c });
      },
      onEnd: () => {
        if (!work.current) return;
        work.current = null;
        onGestureEnd?.();
      },
    },
    !!img,
  );

  const onCropKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!img) return;
    const stepPx = (e.shiftKey ? 40 : 8) / k;
    let c: PhotoCrop | null = null;
    const cur = photo.crop;
    switch (e.key) {
      case 'ArrowLeft': c = moveCrop(cur, -stepPx, 0, img.w, img.h); break;
      case 'ArrowRight': c = moveCrop(cur, stepPx, 0, img.w, img.h); break;
      case 'ArrowUp': c = moveCrop(cur, 0, -stepPx, img.w, img.h); break;
      case 'ArrowDown': c = moveCrop(cur, 0, stepPx, img.w, img.h); break;
      case '+': case '=': c = scaleCrop(cur, 1.08, img.w, img.h); break;
      case '-': case '_': c = scaleCrop(cur, 1 / 1.08, img.w, img.h); break;
      default: return;
    }
    e.preventDefault();
    onChange({ crop: c });
  };

  const crop = img ? clampCrop(photo.crop, img.w, img.h) : photo.crop;
  const cropStyle = disp
    ? { left: disp.x + crop.x * k, top: disp.y + crop.y * k, width: crop.width * k, height: crop.height * k }
    : undefined;

  const slider = (key: keyof typeof DEFAULT_ADJUST, label: string, max: number) => (
    <Slider
      label={label}
      value={photo[key]}
      min={0}
      max={max}
      step={0.01}
      onChange={(v) => onChange({ [key]: v } as Partial<Photo>)}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
    />
  );

  return (
    <section className="st-photo-adjust" aria-label="얼굴 사진 조절">
      <div className="st-photo-adjust__crop-wrap">
        <div className="st-crop" ref={boxRef} {...gestures} aria-describedby={helpId}>
          {imgError && <p className="st-error" role="alert">사진을 불러올 수 없어요. 다시 선택해 주세요.</p>}
          {!img && !imgError && <p className="st-muted">사진 불러오는 중…</p>}
          {disp && (
            <>
              <img
                className="st-crop__img"
                src={photo.dataUrl}
                alt=""
                draggable={false}
                style={{ left: disp.x, top: disp.y, width: disp.width, height: disp.height }}
              />
              <div
                className="st-crop__rect"
                style={cropStyle}
                tabIndex={0}
                role="group"
                aria-label="자르기 영역. 화살표로 이동, + 와 - 로 크기 조절"
                onKeyDown={onCropKey}
              >
                {HANDLES.map((h) => (
                  <span key={h} className={`st-crop__handle st-crop__handle--${h}`} data-handle={h} aria-label={`${HANDLE_LABEL[h]} 모서리`} />
                ))}
              </div>
            </>
          )}
        </div>
        <p id={helpId} className="st-hint">
          사각형을 끌어 위치를, 모서리나 두 손가락으로 크기를 바꿔요.
        </p>
        <div className="st-row">
          <label className="st-check">
            <input type="checkbox" checked={square} onChange={(e) => setSquare(e.currentTarget.checked)} />
            정사각형 유지
          </label>
          <button
            type="button"
            className="st-btn st-btn--ghost"
            disabled={!img}
            onClick={() => img && onChange({ crop: defaultCrop(img.w, img.h) })}
          >
            자르기 초기화
          </button>
        </div>
      </div>

      <PhotoPreview photo={photo} />

      <div className="st-sliders">
        {slider('saturation', '채도', 2)}
        {slider('brightness', '밝기', 2)}
        {slider('contrast', '대비', 2)}
        {slider('feather', '경계 부드럽게', 1)}
        {slider('textureStrength', '양모 질감', 1)}
        <button type="button" className="st-btn st-btn--ghost" onClick={() => onChange({ ...DEFAULT_ADJUST })}>
          색감·질감 초기화
        </button>
      </div>
    </section>
  );
}
