// studio-qa 소유 (T3). 카메라(getUserMedia) 제약 선택·오류 분류·트랙 종료.
// 2D 영상 합성 전용 — 공간 추적(AR) 없음. 영상은 기기 밖으로 전송하지 않는다.

export type Facing = 'environment' | 'user';

export type CameraSupport = 'ok' | 'insecure' | 'unsupported';

export type CameraErrorKind = 'denied' | 'notfound' | 'busy' | 'insecure' | 'unsupported' | 'unknown';

export interface CameraEnv {
  isSecureContext?: boolean;
  mediaDevices?: { getUserMedia?: unknown } | undefined;
}

/** 실행 환경 지원 여부 (순수). HTTPS 또는 localhost 가 아니면 insecure. */
export function getCameraSupport(env: CameraEnv): CameraSupport {
  if (env.isSecureContext === false) return 'insecure';
  if (!env.mediaDevices || typeof env.mediaDevices.getUserMedia !== 'function') {
    // 비보안 컨텍스트에서는 mediaDevices 자체가 없을 수 있다.
    return env.isSecureContext ? 'unsupported' : 'insecure';
  }
  return 'ok';
}

export function currentCameraSupport(): CameraSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
  return getCameraSupport({ isSecureContext: window.isSecureContext, mediaDevices: navigator.mediaDevices });
}

/**
 * 시도 순서: 원하는 방향(ideal)+고해상도 → 원하는 방향만 → 기본 카메라.
 * ideal 은 해당 카메라가 없으면 다른 카메라를 허용하므로 데스크톱에서도 동작한다.
 */
export function constraintCandidates(facing: Facing): MediaStreamConstraints[] {
  return [
    {
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    },
    { audio: false, video: { facingMode: { ideal: facing } } },
    { audio: false, video: true },
  ];
}

export function classifyCameraError(err: unknown): CameraErrorKind {
  const name = (err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '') || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'notfound';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    case 'TypeError':
      return 'unsupported';
    default:
      return 'unknown';
  }
}

/** 다음 후보로 재시도할 가치가 있는 오류인가 (권한 거부는 재요청하지 않는다) */
export function shouldTryNextCandidate(kind: CameraErrorKind): boolean {
  return kind === 'notfound' || kind === 'busy' || kind === 'unknown';
}

export const CAMERA_MESSAGES: Record<CameraErrorKind, string> = {
  denied: '카메라 권한이 거부되었어요. 브라우저 설정에서 카메라를 허용하거나, 사진으로 대신 촬영할 수 있어요.',
  notfound: '사용할 수 있는 카메라를 찾지 못했어요. 사진으로 대신 촬영해 주세요.',
  busy: '카메라를 시작할 수 없어요. 다른 앱이 카메라를 사용 중인지 확인한 뒤 다시 시도해 주세요.',
  insecure: '카메라는 보안 연결(HTTPS)에서만 사용할 수 있어요. 사진으로 대신 촬영해 주세요.',
  unsupported: '이 브라우저는 카메라를 지원하지 않아요. 사진으로 대신 촬영해 주세요.',
  unknown: '카메라를 시작하는 중 문제가 생겼어요. 다시 시도하거나 사진으로 대신 촬영해 주세요.',
};

export type CameraStartResult =
  | { ok: true; stream: MediaStream; candidateIndex: number }
  | { ok: false; kind: CameraErrorKind };

export type GetUserMedia = (c: MediaStreamConstraints) => Promise<MediaStream>;

/** 후보 제약을 순서대로 시도한다. */
export async function startCamera(facing: Facing, getUserMedia: GetUserMedia): Promise<CameraStartResult> {
  const candidates = constraintCandidates(facing);
  let lastKind: CameraErrorKind = 'unknown';
  for (let i = 0; i < candidates.length; i++) {
    try {
      const stream = await getUserMedia(candidates[i]);
      return { ok: true, stream, candidateIndex: i };
    } catch (e) {
      lastKind = classifyCameraError(e);
      if (!shouldTryNextCandidate(lastKind)) break;
    }
  }
  return { ok: false, kind: lastKind };
}

/** 모든 MediaStreamTrack 종료 */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const t of stream.getTracks()) {
    try {
      t.stop();
    } catch {
      /* already stopped */
    }
  }
}

/** 실제로 얻은 카메라 방향(지원 시). 전면이면 미리보기를 좌우 반전한다. */
export function streamFacing(stream: MediaStream, requested: Facing): Facing {
  const track = stream.getVideoTracks()[0];
  const fm = track?.getSettings?.().facingMode;
  if (fm === 'user' || fm === 'environment') return fm;
  return requested;
}
