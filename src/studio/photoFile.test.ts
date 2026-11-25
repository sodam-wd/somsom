import { describe, expect, it, vi } from 'vitest';
import {
  chooseOutputMime, computeScaledSize, hasTransparency, loadPhotoFileWith, PHOTO_ERRORS,
  validatePhotoFile, type Decoded, type PhotoDecodeDeps,
} from './photoFile';

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('validatePhotoFile', () => {
  it('accepts supported MIME types', () => {
    expect(validatePhotoFile(f('a.jpg', 'image/jpeg'))).toEqual({ ok: true, value: 'jpeg' });
    expect(validatePhotoFile(f('a.png', 'image/png'))).toEqual({ ok: true, value: 'png' });
    expect(validatePhotoFile(f('a.webp', 'image/webp'))).toEqual({ ok: true, value: 'webp' });
    expect(validatePhotoFile(f('a.heic', 'image/heic'))).toEqual({ ok: true, value: 'heic' });
  });
  it('falls back to extension when MIME is empty/octet-stream', () => {
    expect(validatePhotoFile(f('IMG_1.HEIC', ''))).toEqual({ ok: true, value: 'heic' });
    expect(validatePhotoFile(f('x.JPEG', 'application/octet-stream'))).toEqual({ ok: true, value: 'jpeg' });
  });
  it('rejects unsupported types', () => {
    expect(validatePhotoFile(f('a.gif', 'image/gif'))).toEqual({ ok: false, error: PHOTO_ERRORS.type });
    expect(validatePhotoFile(f('a.svg', 'image/svg+xml'))).toMatchObject({ ok: false });
    expect(validatePhotoFile(f('doc.pdf', 'application/pdf'))).toMatchObject({ ok: false });
    expect(validatePhotoFile(f('noext', ''))).toMatchObject({ ok: false });
    // 위장된 확장자: MIME 이 명시된 경우 MIME 우선
    expect(validatePhotoFile(f('a.jpg', 'text/plain'))).toMatchObject({ ok: false });
  });
  it('rejects empty and oversized files', () => {
    expect(validatePhotoFile(f('a.jpg', 'image/jpeg', 0))).toEqual({ ok: false, error: PHOTO_ERRORS.empty });
    const r = validatePhotoFile(f('a.jpg', 'image/jpeg', 16 * 1024 * 1024));
    expect(r).toEqual({ ok: false, error: PHOTO_ERRORS.size(15 * 1024 * 1024) });
    expect(validatePhotoFile(f('a.jpg', 'image/jpeg', 2000), 1000)).toMatchObject({ ok: false });
  });
});

describe('computeScaledSize', () => {
  it('does not upscale', () => {
    expect(computeScaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('scales long side to max', () => {
    expect(computeScaledSize(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(computeScaledSize(3000, 6000, 1000)).toEqual({ width: 500, height: 1000 });
  });
  it('invalid sizes', () => {
    expect(computeScaledSize(0, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('transparency / output', () => {
  it('detects alpha', () => {
    expect(hasTransparency([1, 2, 3, 255, 1, 2, 3, 255])).toBe(false);
    expect(hasTransparency([1, 2, 3, 255, 1, 2, 3, 10])).toBe(true);
  });
  it('chooses PNG only for transparent png/webp', () => {
    expect(chooseOutputMime('png', true)).toBe('image/png');
    expect(chooseOutputMime('png', false)).toBe('image/jpeg');
    expect(chooseOutputMime('jpeg', true)).toBe('image/jpeg');
    expect(chooseOutputMime('heic', false)).toBe('image/jpeg');
  });
});

describe('loadPhotoFileWith', () => {
  const blob = (name: string, type: string, size = 100) =>
    Object.assign(new Blob([new Uint8Array(size)], { type }), { name });

  function deps(w: number, h: number, opts: { decodeFail?: boolean; encodeFail?: boolean } = {}) {
    const close = vi.fn();
    const encode = vi.fn(async (_d: Decoded, width: number, height: number) => {
      if (opts.encodeFail) throw new Error('x');
      return `data:image/jpeg;base64,${width}x${height}`;
    });
    const d: PhotoDecodeDeps = {
      decode: async () => {
        if (opts.decodeFail) throw new Error('bad');
        return { source: {} as CanvasImageSource, width: w, height: h, close };
      },
      encode,
    };
    return { d, close, encode };
  }

  it('creates a default photo scaled to maxDimension', async () => {
    const { d, close, encode } = deps(4000, 3000);
    const r = await loadPhotoFileWith(blob('p.jpg', 'image/jpeg'), undefined, d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.dataUrl).toBe('data:image/jpeg;base64,2048x1536');
    expect(r.value.crop).toEqual({ x: 256, y: 0, width: 1536, height: 1536 });
    expect(r.value.saturation).toBe(1);
    expect(encode).toHaveBeenCalledWith(expect.anything(), 2048, 1536, 'jpeg');
    expect(close).toHaveBeenCalledOnce();
  });

  it('honours maxDimension option', async () => {
    const { d } = deps(1000, 500);
    const r = await loadPhotoFileWith(blob('p.png', 'image/png'), { maxDimension: 100 }, d);
    expect(r.ok && r.value.dataUrl).toBe('data:image/jpeg;base64,100x50');
  });

  it('returns validation error without decoding', async () => {
    const { d } = deps(10, 10);
    const spy = vi.spyOn(d, 'decode');
    const r = await loadPhotoFileWith(blob('p.gif', 'image/gif'), undefined, d);
    expect(r).toEqual({ ok: false, error: PHOTO_ERRORS.type });
    expect(spy).not.toHaveBeenCalled();
  });

  it('decode failure → Korean message (HEIC specific)', async () => {
    const { d } = deps(10, 10, { decodeFail: true });
    expect(await loadPhotoFileWith(blob('p.jpg', 'image/jpeg'), undefined, d)).toEqual({ ok: false, error: PHOTO_ERRORS.decode });
    expect(await loadPhotoFileWith(blob('p.heic', 'image/heic'), undefined, d)).toEqual({ ok: false, error: PHOTO_ERRORS.heic });
  });

  it('encode failure closes the bitmap', async () => {
    const { d, close } = deps(10, 10, { encodeFail: true });
    expect(await loadPhotoFileWith(blob('p.jpg', 'image/jpeg'), undefined, d)).toEqual({ ok: false, error: PHOTO_ERRORS.encode });
    expect(close).toHaveBeenCalledOnce();
  });

  it('zero-size decode is treated as corrupt', async () => {
    const { d, close } = deps(0, 0);
    expect(await loadPhotoFileWith(blob('p.jpg', 'image/jpeg'), undefined, d)).toEqual({ ok: false, error: PHOTO_ERRORS.decode });
    expect(close).toHaveBeenCalledOnce();
  });
});
