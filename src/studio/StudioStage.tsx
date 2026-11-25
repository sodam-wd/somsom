// studio-qa 소유 (T3). Keep 단계 촬영 무대: 스튜디오 / 사진 / 라이브 카메라 / 투명.
// 라이브 카메라는 영상 위에 작품을 2D 로 겹치는 합성이며 공간 추적(AR)이 아니다.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { sceneStore, useEditor } from '../editor';
import { canvasToBlob, renderSnowGlobe, shareOrDownload } from '../render';
import type { StudioMode, StudioStageProps } from '../types/contracts';
import { createDefaultBackground, type CameraPlacement, type Scene } from '../types/scene';
import { CAMERA_MESSAGES } from './camera';
import { captureSize, clampPlacement, PLACEMENT_SCALE_MAX, PLACEMENT_SCALE_MIN } from './geometry';
import { toBackgroundPhoto } from './background';
import { useElementSize, useLatestAsync, usePointerGestures } from './hooks';
import { brightenedArtwork, loadBackgroundSource, type BgSource } from './imageOps';
import { loadPhotoFile, PHOTO_ACCEPT } from './photoFile';
import { Slider, pct } from './Slider';
import { captureFileName, drawFrame, type FrameInput } from './stageDraw';
import { useCamera } from './useCamera';

/** 작품 렌더 해상도 (정사각) */
export const ARTWORK_SIZE = 1024;
/** 스튜디오 모드 기본 배경 (외부 배경 미설정 시) — 제안 상태 BG01 */
export const STUDIO_DEFAULT_PRESET = 'BG01';
const STUDIO_FILL = '#E5DACB';

export const MODE_LABEL: Record<StudioMode, string> = {
  studio: '스튜디오',
  photo: '내 사진',
  live: '라이브 카메라',
  clear: '투명 배경',
};

/** 작품(스노우볼, 외부 배경 제외) 렌더 — 관련 장면 값이 바뀔 때만 다시 그린다. */
function useArtwork(scene: Scene) {
  return useLatestAsync(
    () => renderSnowGlobe(scene, { width: ARTWORK_SIZE, height: ARTWORK_SIZE, includeOuterBackground: false }),
    [scene.snowman, scene.world, scene.containerId, scene.baseId, scene.innerBackground],
    120,
  );
}

export function StudioStage({ mode, className, onCapture, onRequestMode }: StudioStageProps) {
  const scene = useEditor((s) => s.scene);
  const placement = scene.cameraPlacement;
  const outer = scene.outerBackground;

  // 라이브 카메라 실패 시 "사진으로 대신하기" — 모드 prop 은 바꿀 수 없으므로 내부에서 사진 모드로 전환
  const [fallbackPhoto, setFallbackPhoto] = useState(false);
  useEffect(() => setFallbackPhoto(false), [mode]);
  const eff: StudioMode = mode === 'live' && fallbackPhoto ? 'photo' : mode;

  const cam = useCamera(eff === 'live');
  const art = useArtwork(scene);
  const artBright = useMemo(
    () => (art.value ? brightenedArtwork(art.value, placement.brightness) : null),
    [art.value, placement.brightness],
  );

  // 배경 소스
  const bgWanted = eff === 'studio' || (eff === 'photo' && outer.kind === 'photo');
  const bg = useLatestAsync<BgSource | null>(
    () => (bgWanted ? loadBackgroundSource(outer, eff === 'studio' ? STUDIO_DEFAULT_PRESET : undefined) : Promise.resolve(null)),
    [bgWanted, eff, outer],
  );
  const bgTransform = outer.kind === 'none' ? createDefaultBackground() : outer;

  const frameInput = (video: HTMLVideoElement | null): FrameInput => ({
    background: (eff === 'studio' || eff === 'photo') && bg.value ? { src: bg.value, transform: bgTransform } : null,
    fill: eff === 'studio' ? STUDIO_FILL : null,
    video: eff === 'live' && video ? { el: video, mirror: cam.mirror } : null,
    art: artBright,
    placement,
  });

  // 미리보기 캔버스 (라이브 모드에서는 영상 위에 작품만 그린다 — 영상은 <video> 로 표시)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || box.width === 0 || box.height === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(box.width * dpr);
    const h = Math.round(box.height * dpr);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, w, h, frameInput(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.width, box.height, eff, bg.value, artBright, placement, outer]);

  // 작품 배치 제스처 (1손가락 이동, 핀치·휠 크기)
  const placeRef = useRef(placement);
  placeRef.current = placement;
  const work = useRef<CameraPlacement | null>(null);
  const gestures = usePointerGestures({
    onStart: () => {
      work.current = placeRef.current;
      sceneStore.beginGesture();
    },
    onMove: (d) => {
      const w = work.current;
      if (!w || box.width === 0) return;
      const next = clampPlacement({ ...w, x: w.x + d.dx / box.width, y: w.y + d.dy / box.height, scale: w.scale * d.scale });
      work.current = next;
      sceneStore.setCameraPlacement(next);
    },
    onEnd: () => {
      if (!work.current) return;
      work.current = null;
      sceneStore.endGesture();
    },
  });
  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const p = placement;
    let next: Partial<CameraPlacement> | null = null;
    switch (e.key) {
      case 'ArrowLeft': next = { x: p.x - step }; break;
      case 'ArrowRight': next = { x: p.x + step }; break;
      case 'ArrowUp': next = { y: p.y - step }; break;
      case 'ArrowDown': next = { y: p.y + step }; break;
      case '+': case '=': next = { scale: p.scale * 1.05 }; break;
      case '-': case '_': next = { scale: p.scale / 1.05 }; break;
      default: return;
    }
    e.preventDefault();
    sceneStore.setCameraPlacement(clampPlacement({ ...p, ...next }));
  };

  // 사진 모드: 외부 배경 사진 선택
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const onPhotoFile = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const r = await loadPhotoFile(file);
      if (!r.ok) {
        setPhotoError(r.error);
        return;
      }
      const cur = sceneStore.getState().scene.outerBackground;
      sceneStore.setBackground('outer', { ...cur, kind: 'photo', presetId: undefined, photo: toBackgroundPhoto(r.value) });
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // 촬영
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [shotMsg, setShotMsg] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  const canCapture =
    !!artBright && box.width > 0 && !capturing && (eff !== 'live' || cam.status === 'live') && (eff !== 'photo' || outer.kind === 'photo');

  const capture = async () => {
    if (!canCapture) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const { width, height } = captureSize(box.width, box.height);
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      const input = frameInput(eff === 'live' ? cam.videoRef.current : null);
      if (eff === 'live' && (!input.video || !input.video.el.videoWidth)) throw new Error('video not ready');
      drawFrame(ctx, width, height, input);
      const blob = await canvasToBlob(c);
      c.width = 0;
      c.height = 0;
      onCapture?.(blob);
      setShotMsg(null);
      setShot({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setCaptureError('촬영하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setCapturing(false);
    }
  };

  const saveShot = async () => {
    if (!shot) return;
    try {
      const r = await shareOrDownload(shot.blob, captureFileName(eff));
      setShotMsg(r === 'shared' ? '공유 창을 열었어요.' : '이미지를 저장했어요.');
    } catch {
      setShotMsg('저장하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const liveBlocked = eff === 'live' && cam.status === 'error';
  const retryable = cam.errorKind !== 'insecure' && cam.errorKind !== 'unsupported';

  return (
    <section className={`st-stage st-stage--${eff} ${className ?? ''}`} aria-label={`촬영: ${MODE_LABEL[eff]}`}>
      <div
        className="st-stage__view"
        ref={boxRef}
        tabIndex={0}
        role="application"
        aria-label="작품 배치. 끌어서 이동, 두 손가락이나 + - 키로 크기 조절, 화살표로 이동"
        onKeyDown={onStageKey}
        {...gestures}
      >
        {eff === 'live' && (
          <video
            ref={cam.videoRef}
            className="st-stage__video"
            style={cam.mirror ? { transform: 'scaleX(-1)' } : undefined}
            playsInline
            muted
            autoPlay
            aria-hidden="true"
          />
        )}
        <canvas ref={canvasRef} className="st-stage__canvas" aria-hidden="true" />

        {art.pending && !art.value && <p className="st-stage__note">작품을 준비하는 중…</p>}
        {art.error != null && !art.value && <p className="st-stage__note st-error" role="alert">작품 이미지를 만들지 못했어요.</p>}

        {eff === 'photo' && outer.kind !== 'photo' && (
          <div className="st-stage__overlay">
            <p>작품을 놓을 배경 사진을 골라 주세요.</p>
            <button type="button" className="st-btn" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
              {photoBusy ? '불러오는 중…' : '배경 사진 선택'}
            </button>
          </div>
        )}

        {eff === 'live' && cam.status !== 'live' && (
          <div className="st-stage__overlay">
            {cam.status === 'idle' && (
              <>
                <p>카메라 영상 위에 작품을 겹쳐 찍어요.</p>
                <button type="button" className="st-btn" onClick={() => void cam.start()}>
                  카메라 켜기
                </button>
              </>
            )}
            {cam.status === 'starting' && <p>카메라를 켜는 중… 권한 요청이 보이면 허용해 주세요.</p>}
            {cam.status === 'paused' && (
              <>
                <p>화면을 벗어나 카메라를 껐어요.</p>
                <button type="button" className="st-btn" onClick={() => void cam.start()}>
                  카메라 다시 켜기
                </button>
              </>
            )}
            {liveBlocked && (
              <>
                <p role="alert">{CAMERA_MESSAGES[cam.errorKind ?? 'unknown']}</p>
                <div className="st-row">
                  {retryable && (
                    <button type="button" className="st-btn st-btn--ghost" onClick={() => void cam.start()}>
                      다시 시도
                    </button>
                  )}
                  <button type="button" className="st-btn" onClick={() => (onRequestMode ? onRequestMode('photo') : setFallbackPhoto(true))}>
                    사진으로 대신하기
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept={PHOTO_ACCEPT} hidden onChange={(e) => void onPhotoFile(e.currentTarget.files?.[0])} />

      <div className="st-stage__notes">
        {mode === 'live' && <p className="st-tag">2D 합성 · 공간 인식(AR) 아님</p>}
        {(eff === 'live' || eff === 'photo') && <p className="st-hint">사진과 카메라 영상은 이 기기에서만 처리되며 외부로 전송되지 않아요.</p>}
        {eff === 'clear' && <p className="st-hint">배경 없이 투명 PNG로 저장돼요. (미리보기 바탕색은 저장되지 않아요)</p>}
        {eff === 'studio' && outer.kind === 'none' && <p className="st-hint">배경: 린넨 스튜디오 (제안 배경)</p>}
        {mode === 'live' && fallbackPhoto && (
          <p className="st-hint">
            라이브 카메라 대신 사진으로 촬영 중이에요.{' '}
            <button type="button" className="st-btn st-btn--ghost" onClick={() => setFallbackPhoto(false)}>
              카메라 다시 시도
            </button>
          </p>
        )}
        {bg.value?.isPlaceholder && (eff === 'studio' || eff === 'photo') && <p className="st-tag st-tag--warn">임시 배경 (실제 이미지 미생성)</p>}
        {photoError && (
          <p className="st-error" role="alert">
            {photoError} 기존 배경은 그대로예요.
          </p>
        )}
      </div>

      <div className="st-stage__controls">
        <div className="st-row st-row--main">
          {eff === 'live' && (
            <>
              <button type="button" className="st-btn st-btn--ghost" onClick={cam.flip} aria-label={cam.facing === 'environment' ? '전면 카메라로 전환' : '후면 카메라로 전환'}>
                {cam.facing === 'environment' ? '전면으로' : '후면으로'}
              </button>
              {cam.status === 'live' && (
                <button type="button" className="st-btn st-btn--ghost" onClick={cam.stop}>
                  카메라 끄기
                </button>
              )}
            </>
          )}
          {eff === 'photo' && outer.kind === 'photo' && (
            <button type="button" className="st-btn st-btn--ghost" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
              사진 바꾸기
            </button>
          )}
          <button type="button" className="st-shutter" onClick={() => void capture()} disabled={!canCapture} aria-label="촬영하기">
            <span aria-hidden="true" />
          </button>
        </div>
        {captureError && <p className="st-error" role="alert">{captureError}</p>}
        <div className="st-sliders">
          <Slider
            label="크기"
            value={placement.scale}
            min={PLACEMENT_SCALE_MIN}
            max={PLACEMENT_SCALE_MAX}
            step={0.01}
            onChange={(v) => sceneStore.setCameraPlacement({ scale: v })}
            onGestureStart={() => sceneStore.beginGesture()}
            onGestureEnd={() => sceneStore.endGesture()}
          />
          <Slider
            label="그림자"
            value={placement.shadow}
            min={0}
            max={1}
            onChange={(v) => sceneStore.setCameraPlacement({ shadow: v })}
            onGestureStart={() => sceneStore.beginGesture()}
            onGestureEnd={() => sceneStore.endGesture()}
          />
          <Slider
            label="밝기"
            value={placement.brightness}
            min={0}
            max={2}
            format={pct}
            onChange={(v) => sceneStore.setCameraPlacement({ brightness: v })}
            onGestureStart={() => sceneStore.beginGesture()}
            onGestureEnd={() => sceneStore.endGesture()}
          />
        </div>
      </div>

      {shot && (
        <div className="st-shot" role="dialog" aria-modal="true" aria-label="촬영 결과">
          <img src={shot.url} alt="촬영한 작품 사진" className={eff === 'clear' ? 'st-shot__img st-shot__img--clear' : 'st-shot__img'} />
          {shotMsg && <p className="st-hint" role="status">{shotMsg}</p>}
          <div className="st-row">
            <button type="button" className={onCapture ? 'st-btn st-btn--ghost' : 'st-btn'} onClick={() => void saveShot()}>
              {onCapture ? '한 번 더 저장·공유' : '저장·공유'}
            </button>
            <button type="button" className="st-btn st-btn--ghost" onClick={() => setShot(null)}>
              다시 찍기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
