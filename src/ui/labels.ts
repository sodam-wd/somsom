// workshop-ui 소유: 화면 표시용 한국어 이름 (manifest 파일명/ID는 변경하지 않음).
import type { Stage } from '../types/scene';

export const STAGE_LABELS: Record<Stage, { short: string; title: string; hint: string }> = {
  welcome: { short: '시작', title: '공방에 오신 걸 환영해요', hint: '로고와 작품을 둘러보고 만들기를 시작해요.' },
  roll: { short: '굴리기', title: '눈덩이 굴리기', hint: '펠트 바닥 어디서나 끌어서 굴려요. 원하는 크기에서 ‘올리기’를 눌러요.' },
  dress: { short: '꾸미기', title: '재료 서랍에서 꾸미기', hint: '재료를 탭하거나 끌어다 놓고, 선택한 부품을 조절해요.' },
  build: { short: '스노우볼', title: '스노우볼 짓기', hint: '유리 용기와 받침대를 고르고 겨울 풍경을 배치해요.' },
  born: { short: '탄생', title: '탄생 증명서', hint: '이름과 성격을 적어 눈사람을 탄생시켜요.' },
  keep: { short: '소장', title: '촬영하고 소장하기', hint: '촬영 모드를 골라 사진을 남기고 PNG로 저장해요.' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  body: '몸통', eyes: '눈', nose: '코', mouth: '입', blush: '볼터치', hat: '모자', scarf: '목도리',
  arms: '팔', clothes: '옷', decor: '장식', props: '소품', friends: '친구들', landscape: '풍경',
  glass: '유리 용기', base: '받침대', ground: '바닥', texture: '질감', photo: '얼굴 사진',
};

export const ASSET_LABELS: Record<string, string> = {
  A001: '둥근 몸통', A002: '타원 몸통', A003: '울퉁불퉁 몸통',
  A004: '검은 단추 눈', A005: '갈색 단추 눈', A006: '구슬 눈', A007: '자수 눈',
  A008: '당근 코', A009: '양모 코', A010: '단추 코',
  A011: '미소', A012: '활짝 웃음', A013: '무표정', A014: '놀란 입',
  A015: '분홍 볼터치', A016: '복숭아 볼터치',
  A017: '비니', A018: '방울 모자', A019: '베레모', A020: '산타 모자', A021: '실크햇', A022: '귀덮개 모자',
  A023: '니트 목도리 1', A024: '니트 목도리 2', A025: '니트 목도리 3', A026: '체크 목도리', A027: '펠트 목도리',
  A028: '나뭇가지 팔', A029: '양모 팔', A030: '벙어리장갑 팔',
  A031: '니트 조끼', A032: '펠트 망토', A033: '코트',
  A034: '단추 1', A035: '단추 2', A036: '리본', A037: '하트', A038: '안경',
  A039: '선물 상자', A040: '빗자루', A041: '랜턴', A042: '지팡이', A043: '별',
  A044: '토끼', A045: '여우', A046: '곰', A047: '새',
  A048: '전나무 1', A049: '전나무 2', A050: '전나무 3', A051: '오두막 1', A052: '오두막 2',
  A053: '울타리', A054: '가로등', A055: '눈 덮인 바위',
  A056: '둥근 돔 후면', A057: '둥근 돔 전면', A058: '아치 돔 후면', A059: '아치 돔 전면',
  A060: '병 후면', A061: '병 전면',
  A062: '밝은 오크 받침대', A063: '진한 오크 받침대', A064: '양모 눈 바닥', A065: '양모 얼굴 질감',
  UI01: '린넨', UI02: '오크 작업대', UI03: '스티치 라벨', UI04: '펠트 버튼', UI05: '재료 트레이',
  UI06: '증명서 종이', UI07: '털실 뭉치', UI08: '공예 가위', UI09: '색 팔레트', UI10: '줄자',
  UI11: '엠보 도장', UI12: '선물 상자(UI)', UI13: '빈 이름표', UI14: '바늘과 실', UI15: '전시 매트',
  B01: '메인 로고', B02: '로고 심볼', B03: '로고 워드마크',
  BG01: '린넨 스튜디오', BG02: '겨울 창가', BG03: '크리스마스 조명', BG04: '겨울밤',
};

export const CONTAINER_LABELS = { round: '둥근 돔', arch: '아치 돔', bottle: '유리병' } as const;
export const BASE_LABELS = { A062: '밝은 오크', A063: '진한 오크' } as const;

export function assetLabel(id: string): string {
  return ASSET_LABELS[id] ?? id;
}
