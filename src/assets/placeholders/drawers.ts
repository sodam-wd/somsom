// workshop-ui 소유: manifest id(예: 'A017') 또는 category(예: 'hat') 키로 드로어 등록.
// 임시 에셋 전용 — 실제 PNG가 public/<path> 에 있으면 loader가 실제 파일을 우선 사용한다.
import type { PlaceholderDrawer } from './index';
import { decorDrawers } from './decor';
import { uiDrawers } from './ui';

export const drawers: Record<string, PlaceholderDrawer> = {
  ...decorDrawers,
  ...uiDrawers,
};
