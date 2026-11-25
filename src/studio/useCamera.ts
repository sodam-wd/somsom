// studio-qa 소유 (T3). 라이브 카메라 수명 관리.
// 비활성화(모드 전환)·언마운트·페이지 숨김(visibilitychange/pagehide) 시 모든 트랙을 stop 한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  currentCameraSupport, startCamera, stopStream, streamFacing, type CameraErrorKind, type Facing,
} from './camera';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'paused' | 'error';

export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const token = useRef(0);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [actualFacing, setActualFacing] = useState<Facing>('environment');

  const release = useCallback(() => {
    token.current++; // 진행 중인 start 결과는 폐기·종료된다
    stopStream(streamRef.current);
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {
        /* noop */
      }
      v.srcObject = null;
    }
  }, []);

  const stop = useCallback(
    (next: CameraStatus = 'idle') => {
      release();
      setStatus(next);
    },
    [release],
  );

  const start = useCallback(
    async (f: Facing) => {
      const support = currentCameraSupport();
      if (support !== 'ok') {
        release();
        setErrorKind(support);
        setStatus('error');
        return;
      }
      release();
      const my = ++token.current;
      setStatus('starting');
      setErrorKind(null);
      const r = await startCamera(f, (c) => navigator.mediaDevices.getUserMedia(c));
      if (my !== token.current) {
        if (r.ok) stopStream(r.stream); // 취소됨(모드 전환·언마운트·숨김)
        return;
      }
      if (!r.ok) {
        setErrorKind(r.kind);
        setStatus('error');
        return;
      }
      const stream = r.stream;
      streamRef.current = stream;
      setActualFacing(streamFacing(stream, f));
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current !== stream) return;
        stopStream(stream);
        streamRef.current = null;
        setErrorKind('busy');
        setStatus('error');
      });
      const v = videoRef.current;
      if (v) {
        v.muted = true;
        v.playsInline = true;
        v.srcObject = stream;
        try {
          await v.play();
        } catch {
          /* autoplay 정책 — muted+playsinline 이면 대부분 허용 */
        }
      }
      if (my !== token.current) return;
      setStatus('live');
    },
    [release],
  );

  // 비활성화(다른 모드) → 종료
  useEffect(() => {
    if (!active) stop('idle');
  }, [active, stop]);

  // 언마운트 → 종료
  useEffect(() => () => release(), [release]);

  // 페이지 숨김 → 종료 (복귀 시 사용자가 다시 켬)
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && streamRef.current) stop('paused');
    };
    const onPageHide = () => {
      if (streamRef.current) stop('paused');
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [stop]);

  const flip = useCallback(() => {
    const nf: Facing = facing === 'environment' ? 'user' : 'environment';
    setFacing(nf);
    if (streamRef.current || status === 'starting') void start(nf);
  }, [facing, start, status]);

  return {
    videoRef,
    status,
    errorKind,
    facing,
    /** 전면 카메라면 미리보기·캡처 모두 좌우 반전 (거울처럼 보이게) */
    mirror: actualFacing === 'user',
    start: () => start(facing),
    stop: () => stop('idle'),
    flip,
    /** 테스트/디버그용: 현재 스트림 보유 여부 */
    hasStream: () => streamRef.current !== null,
  };
}
