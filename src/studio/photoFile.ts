// studio-qa 소유 (T3). 사용자 사진 로컬 decode — 외부 통신 없음.
// 파일 검증 → decode(EXIF 방향 반영) → 긴 변 축소 → data URL 재인코딩(메타데이터 제거 효과)
import type { PhotoLoadOptions } from '../types/contracts';
import { createDefaultPhoto, type Photo, type Result } from '../types/scene';

export const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
export const DEFAULT_MAX_DIMENSION = 2048;
export const JPEG_QUALITY = 0.9;

export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const ACCEPTED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const;
/** <input accept> 값 */
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';

export const PHOTO_ERRORS = {
  type: '지원하지 않는 파일 형식이에요. JPEG, PNG, WebP 사진을 선택해 주세요.',
  size: (maxBytes: number) => `사진이 너무 커요. ${Math.round(maxBytes / 1024 / 1024)}MB 이하의 사진을 선택해 주세요.`,
  empty: '파일이 비어 있거나 손상되었어요. 다른 사진을 선택해 주세요.',
  heic: '이 브라우저에서는 HEIC 사진을 열 수 없어요. JPEG 또는 PNG로 변환해 다시 선택해 주세요.',
  decode: '사진을 열 수 없어요. 파일이 손상되었거나 이 브라우저가 지원하지 않는 형식이에요.',
  encode: '사진을 처리하는 중 문제가 생겼어요. 다시 시도해 주세요.',
} as const;

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export type PhotoKind = 'jpeg' | 'png' | 'webp' | 'heic';

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function kindFromMime(mime: string): PhotoKind | null {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
    case 'image/pjpeg':
      return 'jpeg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
    case 'image/heic-sequence':
    case 'image/heif-sequence':
      return 'heic';
    default:
      return null;
  }
}

function kindFromExt(ext: string): PhotoKind | null {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'jpeg';
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
    case 'heic':
    case 'heif':
      return 'heic';
    default:
      return null;
  }
}

/**
 * 형식/크기 검증 (순수). MIME 이 비었거나 일반 바이너리로 보고되는 경우(일부 모바일 HEIC)
 * 확장자로 판단한다. 다른 image/* MIME 은 확장자와 무관하게 거부한다.
 */
export function validatePhotoFile(file: FileLike, maxBytes = DEFAULT_MAX_BYTES): Result<PhotoKind> {
  const mime = (file.type || '').toLowerCase();
  let kind = kindFromMime(mime);
  if (!kind && (mime === '' || mime === 'application/octet-stream')) kind = kindFromExt(extOf(file.name));
  if (!kind) return { ok: false, error: PHOTO_ERRORS.type };
  if (!(file.size > 0)) return { ok: false, error: PHOTO_ERRORS.empty };
  if (file.size > maxBytes) return { ok: false, error: PHOTO_ERRORS.size(maxBytes) };
  return { ok: true, value: kind };
}

/** 긴 변이 maxDim 을 넘으면 비율 유지 축소 (확대하지 않음). */
export function computeScaledSize(w: number, h: number, maxDim = DEFAULT_MAX_DIMENSION): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
  const long = Math.max(w, h);
  if (long <= maxDim) return { width: Math.round(w), height: Math.round(h) };
  const s = maxDim / long;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** RGBA 데이터에 반투명 픽셀이 있는지 (step 픽셀마다 샘플) */
export function hasTransparency(data: ArrayLike<number>, step = 1): boolean {
  const stride = Math.max(1, Math.floor(step)) * 4;
  for (let i = 3; i < data.length; i += stride) {
    if (data[i] < 255) return true;
  }
  return false;
}

/** 출력 형식 결정: 투명 가능 원본(png/webp)이고 실제 투명 픽셀이 있으면 PNG */
export function chooseOutputMime(kind: PhotoKind, transparent: boolean): 'image/png' | 'image/jpeg' {
  return (kind === 'png' || kind === 'webp') && transparent ? 'image/png' : 'image/jpeg';
}

// ── decode (브라우저 의존) ─────────────────────────────────
export interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

export interface PhotoDecodeDeps {
  decode: (file: Blob) => Promise<Decoded>;
  /** 축소 그리기 + 인코딩. 투명 판단도 여기서 수행. */
  encode: (d: Decoded, width: number, height: number, kind: PhotoKind) => Promise<string>;
}

async function decodeWithImageElement(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = url;
    });
    // 현대 브라우저는 <img> 에 EXIF 방향(image-orientation: from-image 기본)을 반영한다.
    if (typeof img.decode === 'function') await img.decode().catch(() => undefined);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error('empty image');
    return { source: img, width, height, close: () => undefined };
  } finally {
    // drawImage 전에 해제해도 이미 decode 된 이미지는 그릴 수 있다.
    URL.revokeObjectURL(url);
  }
}

export async function browserDecode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // 옵션 미지원 또는 형식 미지원 → <img> 경로로 재시도
    }
  }
  return decodeWithImageElement(file);
}

export async function browserEncode(d: Decoded, width: number, height: number, kind: PhotoKind): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(d.source, 0, 0, width, height);
  let transparent = false;
  if (kind === 'png' || kind === 'webp') {
    try {
      const data = ctx.getImageData(0, 0, width, height).data;
      transparent = hasTransparency(data, 2);
    } catch {
      transparent = true;
    }
  }
  const mime = chooseOutputMime(kind, transparent);
  const url = canvas.toDataURL(mime, mime === 'image/jpeg' ? JPEG_QUALITY : undefined);
  // 메모리 해제
  canvas.width = 0;
  canvas.height = 0;
  if (!url.startsWith('data:image/')) throw new Error('encode failed');
  return url;
}

export const browserDeps: PhotoDecodeDeps = { decode: browserDecode, encode: browserEncode };

/** 의존성 주입 버전 (테스트용) */
export async function loadPhotoFileWith(
  file: File | (Blob & FileLike),
  opts: PhotoLoadOptions | undefined,
  deps: PhotoDecodeDeps,
): Promise<Result<Photo>> {
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDim = opts?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const v = validatePhotoFile(file, maxBytes);
  if (!v.ok) return v;
  const kind = v.value;

  let decoded: Decoded;
  try {
    decoded = await deps.decode(file);
  } catch {
    return { ok: false, error: kind === 'heic' ? PHOTO_ERRORS.heic : PHOTO_ERRORS.decode };
  }
  try {
    if (!(decoded.width > 0) || !(decoded.height > 0)) return { ok: false, error: PHOTO_ERRORS.decode };
    const { width, height } = computeScaledSize(decoded.width, decoded.height, maxDim);
    let dataUrl: string;
    try {
      dataUrl = await deps.encode(decoded, width, height, kind);
    } catch {
      return { ok: false, error: PHOTO_ERRORS.encode };
    }
    return { ok: true, value: createDefaultPhoto(dataUrl, width, height) };
  } finally {
    decoded.close();
  }
}

/** 계약: 사용자 사진 파일을 로컬에서 decode 하여 Photo 로 만든다. */
export function loadPhotoFile(file: File, opts?: PhotoLoadOptions): Promise<Result<Photo>> {
  return loadPhotoFileWith(file, opts, browserDeps);
}

/** data URL 이미지의 원본 크기 (crop 편집용, 로컬) */
export function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUrl;
  });
}
