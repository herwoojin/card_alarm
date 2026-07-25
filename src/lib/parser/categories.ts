import type { CategoryName, CategoryRule } from '@/types';

/**
 * 업종 사전 15종 + '기타' (ERD 3.2).
 *
 * 분류는 가맹점명에 키워드가 포함되는지로 판정한다. **먼저 매칭된 업종이 이긴다.**
 * 따라서 배열 순서가 곧 우선순위이며, 좁은 범위(편의점)를 넓은 범위(마트/식료품) 앞에 둔다.
 *
 * 데이터만 고치면 분류가 바뀌도록, 여기서는 사전 데이터만 정의한다.
 */
export const CATEGORIES: readonly CategoryRule[] = [
  { name: '편의점', icon: '🏪', keywords: ['GS25', 'CU', '씨유', '세븐일레븐', '7-ELEVEN', '이마트24', '미니스톱', '편의점'] },
  { name: '카페', icon: '☕', keywords: ['스타벅스', 'STARBUCKS', '투썸', '이디야', '메가커피', '메가엠지씨', '컴포즈', '빽다방', '할리스', '폴바셋', '커피', '카페', '파스쿠찌', '탐앤탐스'] },
  { name: '음식점', icon: '🍚', keywords: ['배달의민족', '배민', '요기요', '쿠팡이츠', '식당', '국밥', '치킨', '피자', '고기', '김밥', '분식', '맘스터치', '버거', '맥도날드', '롯데리아', 'KFC', '포차', '일식', '중화', '한식', '횟집', '족발', '곱창'] },
  { name: '마트/식료품', icon: '🛒', keywords: ['이마트', '홈플러스', '롯데마트', '코스트코', '하나로', '마켓컬리', '컬리', '오아시스', '농협마트', '슈퍼', '청과', '정육'] },
  { name: '온라인쇼핑', icon: '📦', keywords: ['쿠팡', 'COUPANG', '11번가', 'G마켓', '지마켓', '옥션', 'SSG', '네이버페이', '스마트스토어', '무신사', '알리', '테무', '인터파크', '위메프', '티몬', '29CM'] },
  { name: '교통', icon: '🚇', keywords: ['택시', '카카오T', '버스', '지하철', '철도', '코레일', 'SRT', '고속', '주차', '하이패스', '티머니', '캐시비', '대중교통', '렌터카'] },
  { name: '주유/충전', icon: '⛽', keywords: ['주유', '오일뱅크', '칼텍스', 'SK에너지', 'S-OIL', '에쓰오일', '충전소', 'EV', '전기차', 'GS칼텍스'] },
  { name: '통신', icon: '📱', keywords: ['SKT', 'KT', 'LG유플러스', 'LGU', '유플러스', '통신', '인터넷', '알뜰폰'] },
  { name: '의료/약국', icon: '💊', keywords: ['의원', '병원', '약국', '한의원', '치과', '메디', '클리닉', '건강검진'] },
  { name: '문화/구독', icon: '🎬', keywords: ['CGV', '메가박스', '롯데시네마', '넷플릭스', 'NETFLIX', '유튜브', 'YOUTUBE', '스포티파이', '왓챠', '티빙', '쿠팡플레이', '서점', '교보', '예스24', '알라딘', '디즈니'] },
  { name: '백화점/아울렛', icon: '🏬', keywords: ['백화점', '아울렛', '스타필드', '신세계', '롯데월드', '현대아울렛', '프리미엄아울렛'] },
  { name: '생활/뷰티', icon: '🧴', keywords: ['올리브영', '다이소', '화장품', '미용실', '헤어', '네일', '세탁', '문구'] },
  { name: '보험/금융', icon: '🏦', keywords: ['보험', '생명', '손해', '캐피탈', '증권', '이자', '대출'] },
  { name: '공과금/세금', icon: '🧾', keywords: ['국세', '지방세', '세금', '관리비', '전기', '수도', '가스', '한국전력', '도시가스', '국민연금', '건강보험', '고용보험', '등록금', '과태료', '통행료납부'] },
  { name: '상품권/충전', icon: '🎟️', keywords: ['상품권', '기프트', '문화상품권', '선불', '충전', '페이충전', '머니충전', '기프티'] },
  { name: '기타', icon: '•', keywords: [] },
] as const;

/** 업종명 목록 (표시 순서 = 사전 순서). */
export const CATEGORY_NAMES: readonly CategoryName[] = CATEGORIES.map((c) => c.name);

/** 업종명 → 아이콘 맵. */
export const CATEGORY_ICON: Record<CategoryName, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.icon]),
) as Record<CategoryName, string>;

/**
 * 가맹점명을 업종으로 분류한다. 대소문자 무시.
 * 먼저 매칭된 업종이 이기고, 실패하면 '기타'를 반환한다.
 */
export function classify(merchant: string): CategoryName {
  const m = (merchant || '').toUpperCase();
  for (const { name, keywords } of CATEGORIES) {
    for (const k of keywords) {
      if (m.includes(k.toUpperCase())) return name;
    }
  }
  return '기타';
}

/** 대부분의 카드사가 공통으로 실적에서 빼는 기본 제외 업종 3종 (ERD 3.2). */
export const DEFAULT_EXCLUDE: readonly CategoryName[] = ['공과금/세금', '상품권/충전', '보험/금융'];
