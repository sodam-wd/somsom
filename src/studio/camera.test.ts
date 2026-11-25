import { describe, expect, it, vi } from 'vitest';
import {
  classifyCameraError, constraintCandidates, getCameraSupport, startCamera, stopStream, streamFacing,
} from './camera';

const err = (name: string) => Object.assign(new Error(name), { name });

describe('getCameraSupport', () => {
  it('detects insecure context', () => {
    expect(getCameraSupport({ isSecureContext: false, mediaDevices: { getUserMedia: () => 0 } })).toBe('insecure');
    expect(getCameraSupport({ isSecureContext: undefined, mediaDevices: undefined })).toBe('insecure');
  });
  it('detects unsupported', () => {
    expect(getCameraSupport({ isSecureContext: true, mediaDevices: undefined })).toBe('unsupported');
    expect(getCameraSupport({ isSecureContext: true, mediaDevices: {} })).toBe('unsupported');
  });
  it('ok', () => {
    expect(getCameraSupport({ isSecureContext: true, mediaDevices: { getUserMedia: () => 0 } })).toBe('ok');
  });
});

describe('constraintCandidates', () => {
  it('prefers requested facing then default camera, never audio', () => {
    const c = constraintCandidates('environment');
    expect(c).toHaveLength(3);
    expect(c[0].video).toMatchObject({ facingMode: { ideal: 'environment' } });
    expect(c[2].video).toBe(true);
    expect(c.every((x) => x.audio === false)).toBe(true);
    expect(constraintCandidates('user')[0].video).toMatchObject({ facingMode: { ideal: 'user' } });
  });
});

describe('classifyCameraError', () => {
  it('maps DOMException names', () => {
    expect(classifyCameraError(err('NotAllowedError'))).toBe('denied');
    expect(classifyCameraError(err('SecurityError'))).toBe('denied');
    expect(classifyCameraError(err('NotFoundError'))).toBe('notfound');
    expect(classifyCameraError(err('OverconstrainedError'))).toBe('notfound');
    expect(classifyCameraError(err('NotReadableError'))).toBe('busy');
    expect(classifyCameraError(err('TypeError'))).toBe('unsupported');
    expect(classifyCameraError('weird')).toBe('unknown');
    expect(classifyCameraError(null)).toBe('unknown');
  });
});

function fakeStream(facing?: string) {
  const track = { stop: vi.fn(), getSettings: () => ({ facingMode: facing }) };
  return {
    track,
    stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream,
  };
}

describe('startCamera', () => {
  it('returns first successful stream', async () => {
    const { stream } = fakeStream();
    const gum = vi.fn().mockResolvedValue(stream);
    const r = await startCamera('environment', gum);
    expect(r).toEqual({ ok: true, stream, candidateIndex: 0 });
    expect(gum).toHaveBeenCalledOnce();
  });
  it('falls back to default camera on Overconstrained/NotFound', async () => {
    const { stream } = fakeStream();
    const gum = vi.fn()
      .mockRejectedValueOnce(err('OverconstrainedError'))
      .mockRejectedValueOnce(err('NotFoundError'))
      .mockResolvedValueOnce(stream);
    const r = await startCamera('environment', gum);
    expect(r).toMatchObject({ ok: true, candidateIndex: 2 });
    expect(gum.mock.calls[2][0]).toEqual({ audio: false, video: true });
  });
  it('does not re-prompt after permission denial', async () => {
    const gum = vi.fn().mockRejectedValue(err('NotAllowedError'));
    expect(await startCamera('environment', gum)).toEqual({ ok: false, kind: 'denied' });
    expect(gum).toHaveBeenCalledOnce();
  });
  it('reports last error when all candidates fail', async () => {
    const gum = vi.fn().mockRejectedValue(err('NotFoundError'));
    expect(await startCamera('user', gum)).toEqual({ ok: false, kind: 'notfound' });
    expect(gum).toHaveBeenCalledTimes(3);
  });
});

describe('stopStream / streamFacing', () => {
  it('stops every track and tolerates null', () => {
    const { stream, track } = fakeStream();
    stopStream(stream);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(() => stopStream(null)).not.toThrow();
  });
  it('uses track settings when present', () => {
    expect(streamFacing(fakeStream('user').stream, 'environment')).toBe('user');
    expect(streamFacing(fakeStream(undefined).stream, 'environment')).toBe('environment');
  });
});
