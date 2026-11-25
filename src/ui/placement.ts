// workshop-ui 소유: 탭으로 추가할 때의 카테고리별 기본 위치·크기 (순수 함수).
// 눈사람 몸통(A001–A003) 배치를 기준으로 얼굴 부품은 머리에, 모자는 위, 목도리는 이음매, 팔은 옆에 둔다.
import { LAYER_BASE_SIZE, LOGICAL_SIZE, type Layer } from '../types/scene';
import { ASSETS_BY_ID } from '../assets/manifest';

export const BODY_IDS = ['A001', 'A002', 'A003'];
/** 몸통 임시/실제 에셋에서 공이 차지하는 비율(대략) */
const BODY_FILL = 0.92;

interface Ball {
  x: number;
  y: number;
  d: number;
}

function balls(layers: Layer[]): Ball[] {
  return layers
    .filter((l) => BODY_IDS.includes(l.assetId) && l.visible !== false)
    .map((l) => ({ x: l.x, y: l.y, d: LAYER_BASE_SIZE * Math.abs(l.scaleX) * BODY_FILL }))
    .sort((a, b) => a.y - b.y); // 위(머리) → 아래
}

const clampL = (v: number) => Math.min(LOGICAL_SIZE - 20, Math.max(20, v));

function at(x: number, y: number, size: number, extra: Partial<Layer> = {}): Partial<Layer> {
  const s = Math.max(0.1, size / LAYER_BASE_SIZE);
  return { x: clampL(x), y: clampL(y), scaleX: s, scaleY: s, ...extra };
}

/** 눈사람(snowman) 레이어 기본 배치 */
export function snowmanPlacement(assetId: string, layers: Layer[]): Partial<Layer> {
  const cat = ASSETS_BY_ID[assetId]?.category ?? '';
  const same = layers.filter((l) => ASSETS_BY_ID[l.assetId]?.category === cat).length;
  const b = balls(layers);
  const head: Ball = b[0] ?? { x: 500, y: 420, d: 260 };
  const bottom: Ball = b[b.length - 1] ?? { x: 500, y: 700, d: 360 };
  const mid: Ball = b.length >= 2 ? b[1] : bottom;
  const D = head.d;

  switch (cat) {
    case 'body': {
      if (!b.length) return at(500, 720, 380);
      const d = head.d * 0.75;
      return at(head.x, head.y - (head.d / 2 + d / 2) * 0.82, d / BODY_FILL);
    }
    case 'eyes':
      return at(head.x, head.y - D * 0.08, D * 0.95);
    case 'nose':
      return at(head.x + D * 0.04, head.y + D * 0.05, D * 0.55);
    case 'mouth':
      return at(head.x, head.y + D * 0.22, D * 0.55);
    case 'blush':
      return at(head.x, head.y + D * 0.12, D * 0.95);
    case 'hat': {
      const S = D * 1.1;
      return at(head.x, head.y - D * 0.28 - S * 0.17, S);
    }
    case 'scarf': {
      const S = D * 1.15;
      return at(head.x, head.y + D * 0.42, S);
    }
    case 'arms': {
      const S = mid.d * 0.85;
      const right = same % 2 === 1;
      const dx = mid.d * 0.62 + S * 0.15;
      return at(mid.x + (right ? dx : -dx), mid.y - mid.d * 0.18, S, { flipX: right });
    }
    case 'clothes':
      return at(mid.x, mid.y, mid.d * 1.1);
    case 'decor': {
      const S = Math.max(40, mid.d * 0.28);
      return at(mid.x, mid.y - mid.d * 0.2 + same * S * 0.75, S);
    }
    case 'props': {
      const S = bottom.d * 0.7;
      const right = same % 2 === 0;
      return at(bottom.x + (right ? 1 : -1) * bottom.d * 0.68, bottom.y, S);
    }
    case 'friends': {
      const S = bottom.d * 0.55;
      const right = same % 2 === 1;
      return at(bottom.x + (right ? 1 : -1) * bottom.d * 0.7, bottom.y + bottom.d * 0.2, S);
    }
    default:
      return at(500 + same * 18, 500 + same * 18, 200);
  }
}

/** 스노우볼 세계(world) 레이어 기본 배치 — 눈사람(가운데) 양옆 바닥에 번갈아 */
const LANDSCAPE_SLOTS: [number, number][] = [[235, 220], [765, 220], [320, 165], [680, 165], [180, 140], [820, 140]];
const FRIEND_SLOTS: [number, number][] = [[250, 150], [750, 150], [340, 120], [660, 120]];
const GROUND_Y = 820;

export function worldPlacement(assetId: string, layers: Layer[]): Partial<Layer> {
  const cat = ASSETS_BY_ID[assetId]?.category ?? '';
  const same = layers.filter((l) => ASSETS_BY_ID[l.assetId]?.category === cat).length;
  const slots = cat === 'friends' ? FRIEND_SLOTS : LANDSCAPE_SLOTS;
  const [x, S] = slots[same % slots.length];
  const round = Math.floor(same / slots.length);
  // 정사각 프레임 안에서 내용 바닥은 대략 0.85 지점 → 중심을 바닥선보다 S*0.35 위로
  const y = GROUND_Y - S * 0.35 + round * 14 + (cat === 'friends' ? 20 : 0);
  return at(x + round * 16, y, S);
}
