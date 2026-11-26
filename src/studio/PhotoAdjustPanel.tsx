// studio-qa 소유 (T3). 얼굴 사진 조절: 수동 crop + 채도/밝기/대비/경계/양모 질감.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
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

const MASK_SIZE = 256;
const MASK_VIEW = 300;

/**
 * 얼굴 영역 색칠하기: 자른 사진 위를 손가락/마우스로 칠하면 칠한 부분만 눈사람 얼굴에 들어간다.
 * 마스크는 자른 영역 기준 정사각 PNG(알파)로 저장되며, 그리기를 마칠 때마다 한 번 반영(실행 취소 1단계).
 */
function MaskPainter({ photo, onChange, onGestureStart, onGestureEnd }: PhotoAdjustPanelProps) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<'paint' | 'erase'>('paint');
  const [brush, setBrush] = useState(0.12);
  const painting = useRef<{ id: number; last: { x: number; y: number } } | null>(null);
  const ownMask = useRef<string | undefined>(undefined);
  const photoRef = useRef(photo);
  photoRef.current = photo;

  const redraw = () => {
    const c = viewRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const W = c.width;
    ctx.clearRect(0, 0, W, W);
    const img = imgRef.current;
    if (img) {
      const cr = photoRef.current.crop;
      const s = Math.max(W / Math.max(1, cr.width), W / Math.max(1, cr.height));
      const dw = cr.width * s;
      const dh = cr.height * s;
      ctx.drawImage(img, cr.x, cr.y, cr.width, cr.height, (W - dw) / 2, (W - dh) / 2, dw, dh);
    }
    const m = maskRef.current;
    if (m) {
      // 칠하지 않은 곳은 어둡게, 칠한 곳은 사진 그대로
      const dim = document.createElement('canvas');
      dim.width = W;
      dim.height = W;
      const d = dim.getContext('2d');
      if (d) {
        d.fillStyle = 'rgba(50, 38, 28, 0.62)';
        d.fillRect(0, 0, W, W);
        d.globalCompositeOperation = 'destination-out';
        d.drawImage(m, 0, 0, W, W);
        ctx.drawImage(dim, 0, 0);
      }
    } else {
      // 아직 칠하지 않음: 기본 원형 영역 안내
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(254, 252, 247, 0.9)';
      ctx.beginPath();
      ctx.ellipse(W / 2, W / 2, W * 0.46, W * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    let alive = true;
    loadDataUrlImage(photo.dataUrl)
      .then((i) => {
        if (!alive) return;
        imgRef.current = i;
        redraw();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.dataUrl]);

  // 외부 변경(실행 취소, 불러오기)으로 마스크가 바뀌면 다시 읽는다
  useEffect(() => {
    if (photo.mask === ownMask.current && (!photo.mask || maskRef.current)) {
      redraw();
      return;
    }
    ownMask.current = photo.mask;
    if (!photo.mask) {
      maskRef.current = null;
      redraw();
      return;
    }
    let alive = true;
    loadDataUrlImage(photo.mask)
      .then((i) => {
        if (!alive) return;
        const c = document.createElement('canvas');
        c.width = MASK_SIZE;
        c.height = MASK_SIZE;
        c.getContext('2d')?.drawImage(i, 0, 0, MASK_SIZE, MASK_SIZE);
        maskRef.current = c;
        redraw();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.mask, photo.crop]);

  const toMask = (e: { clientX: number; clientY: number }) => {
    const r = viewRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * MASK_SIZE, y: ((e.clientY - r.top) / r.height) * MASK_SIZE };
  };
  const strokeTo = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const m = maskRef.current;
    const ctx = m?.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush * MASK_SIZE;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
    ctx.restore();
    redraw();
  };

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (painting.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    if (!maskRef.current) {
      const c = document.createElement('canvas');
      c.width = MASK_SIZE;
      c.height = MASK_SIZE;
      maskRef.current = c;
    }
    onGestureStart?.();
    const p = toMask(e);
    painting.current = { id: e.pointerId, last: p };
    strokeTo(p, p);
  };
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const st = painting.current;
    if (!st || st.id !== e.pointerId) return;
    const p = toMask(e);
    strokeTo(st.last, p);
    st.last = p;
  };
  const onUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    const st = painting.current;
    if (!st || st.id !== e.pointerId) return;
    painting.current = null;
    const m = maskRef.current;
    if (m) {
      const url = m.toDataURL('image/png');
      ownMask.current = url;
      onChange({ mask: url });
    }
    onGestureEnd?.();
  };

  return (
    <details className="st-mask" open={Boolean(photo.mask) || undefined}>
      <summary>얼굴 부분 색칠해서 고르기</summary>
      <p className="st-hint">얼굴로 쓸 부분을 손가락이나 마우스로 칠해요. 칠한 부분만 눈사람 얼굴에 들어가요.</p>
      <canvas
        ref={viewRef}
        className="st-mask__canvas"
        width={MASK_VIEW * 2}
        height={MASK_VIEW * 2}
        role="img"
        aria-label="얼굴 영역 색칠 캔버스"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="st-row">
        <div className="st-seg" role="radiogroup" aria-label="색칠 도구">
          <button type="button" role="radio" aria-checked={tool === 'paint'} className="st-btn st-btn--ghost" onClick={() => setTool('paint')}>
            칠하기
          </button>
          <button type="button" role="radio" aria-checked={tool === 'erase'} className="st-btn st-btn--ghost" onClick={() => setTool('erase')}>
            지우기
          </button>
        </div>
        <button
          type="button"
          className="st-btn st-btn--ghost"
          disabled={!photo.mask}
          onClick={() => {
            maskRef.current = null;
            ownMask.current = undefined;
            onChange({ mask: undefined });
          }}
        >
          원형으로 되돌리기
        </button>
      </div>
      <Slider label="붓 크기" value={brush} min={0.04} max={0.35} step={0.01} onChange={setBrush} format={(v) => `${Math.round(v * 100)}%`} />
    </details>
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

      <MaskPainter photo={photo} onChange={onChange} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />

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
