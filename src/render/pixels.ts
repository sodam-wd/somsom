// editor-engine 소유 (T1). 순수 픽셀 처리 (Canvas 필터 미지원 브라우저 대비 직접 처리).

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * 밝기·섬유 질감 보존 tint (원본 데이터는 바꾸지 않고 새 배열 반환).
 * 알파 가중 평균 밝기 m 이 tint 색에 대응하도록, 각 픽셀의 상대 밝기 L/m 으로
 * 어두운 부분은 tint 를 어둡게, 밝은 부분은 흰색 쪽으로 보간한다. 알파는 유지.
 */
export function tintPixels(src: Uint8ClampedArray, hex: string): Uint8ClampedArray {
  const [tr, tg, tb] = hexToRgb(hex);
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3] / 255;
    if (a <= 0) continue;
    sum += luminance(src[i], src[i + 1], src[i + 2]) * a;
    wsum += a;
  }
  const m = wsum > 0 ? Math.min(0.98, Math.max(0.05, sum / wsum)) : 0.5;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    out[i + 3] = a;
    if (a === 0) continue;
    const L = luminance(src[i], src[i + 1], src[i + 2]);
    if (L <= m) {
      const k = L / m;
      out[i] = tr * k;
      out[i + 1] = tg * k;
      out[i + 2] = tb * k;
    } else {
      const k = (L - m) / (1 - m);
      out[i] = tr + (255 - tr) * k;
      out[i + 1] = tg + (255 - tg) * k;
      out[i + 2] = tb + (255 - tb) * k;
    }
  }
  return out;
}

/**
 * 채도/밝기/대비 보정 (각 0..2, 1 = 원본). 제자리 수정.
 */
export function adjustPixels(data: Uint8ClampedArray, saturation: number, brightness: number, contrast: number): void {
  if (saturation === 1 && brightness === 1 && contrast === 1) return;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * brightness;
    let g = data[i + 1] * brightness;
    let b = data[i + 2] * brightness;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[i] = gray + (r - gray) * saturation;
    data[i + 1] = gray + (g - gray) * saturation;
    data[i + 2] = gray + (b - gray) * saturation;
  }
}

/**
 * 부드러운 타원 마스크 알파 (0..1). (u,v) ∈ [-1,1] 정규화 좌표, feather 0..1.
 * 경계 안쪽 (1 - feather) 까지는 1, 바깥 경계 1 에서 0, 사이는 smoothstep.
 */
export function ellipseMaskAlpha(u: number, v: number, feather: number): number {
  const d = Math.sqrt(u * u + v * v);
  const f = Math.min(1, Math.max(0.001, feather));
  const inner = 1 - f;
  if (d <= inner) return 1;
  if (d >= 1) return 0;
  const t = (d - inner) / f;
  return 1 - t * t * (3 - 2 * t);
}

/** 결정적 의사난수 (mulberry32) */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
