// 증명서 손글씨 글꼴: 나눔손글씨 펜 (SIL OFL 1.1, public/fonts/OFL-NanumPenScript.txt). 원본 TTF 그대로 사용.
// 필요할 때만 불러온다 (탄생 단계·증명서 저장).
export const HAND_FONT = 'SomsomHand';
const HAND_URL = 'fonts/NanumPenScript-Regular.ttf';
let loading: Promise<boolean> | null = null;

/** 손글씨 글꼴을 문서에 등록하고 불러온다. 실패해도 대체 글꼴로 계속 진행. */
export function ensureHandFont(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      if (typeof FontFace === 'undefined' || !document.fonts) return false;
      const base = (import.meta.env.BASE_URL as string | undefined) ?? './';
      const face = new FontFace(HAND_FONT, `url(${base}${HAND_URL})`, { display: 'swap' });
      await face.load();
      document.fonts.add(face);
      return true;
    } catch {
      loading = null;
      return false;
    }
  })();
  return loading;
}
