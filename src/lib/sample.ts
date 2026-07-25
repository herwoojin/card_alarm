import type { Card, Transaction, Unrecognized, ParseStats, CategoryName, IssuerKey } from '@/types';
import { DEFAULT_EXCLUDE } from '@/lib/parser/categories';
import { cycleRange } from '@/lib/domain/cycle';
import { won } from '@/lib/format';
import { uid } from '@/lib/id';

export interface SampleData {
  cards: Card[];
  transactions: Transaction[];
  unrecognized: Unrecognized[];
  stats: ParseStats;
}

function card(
  id: string,
  issuer: IssuerKey,
  name: string,
  last4: string,
  annualFee: number,
  tiers: { label: string; min: number; benefit: number }[],
  rates: { category: CategoryName; rate: number }[],
): Card {
  const nowISO = new Date().toISOString();
  return {
    id,
    issuer,
    name,
    last4,
    annualFee,
    tiers,
    excludes: [...DEFAULT_EXCLUDE],
    rates: rates.map((r) => ({ ...r, monthlyCap: null })),
    cycleStartDay: null,
    installmentPolicy: 'full',
    active: true,
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

/**
 * 샘플 데이터 — 카드 3장 + 거래 30건. 실적 초과 사례를 포함해
 * 핵심 기능("초과 → 대체 카드 추천")이 첫 화면에 바로 나타나게 한다.
 */
export function buildSample(now: Date = new Date(), cycleStart = 1): SampleData {
  const cards: Card[] = [
    card('c1', 'shinhan', '신한 생활카드', '1234', 15000, [
      { label: '30만', min: 300000, benefit: 10000 },
      { label: '50만', min: 500000, benefit: 22000 },
      { label: '100만', min: 1000000, benefit: 45000 },
    ], [
      { category: '편의점', rate: 5 },
      { category: '카페', rate: 5 },
      { category: '교통', rate: 3 },
    ]),
    card('c2', 'kb', 'KB 쇼핑카드', '5678', 12000, [
      { label: '40만', min: 400000, benefit: 15000 },
      { label: '70만', min: 700000, benefit: 30000 },
    ], [
      { category: '온라인쇼핑', rate: 7 },
      { category: '마트/식료품', rate: 4 },
    ]),
    card('c3', 'hyundai', '현대 주유카드', '9012', 20000, [
      { label: '50만', min: 500000, benefit: 18000 },
      { label: '100만', min: 1000000, benefit: 42000 },
    ], [
      { category: '주유/충전', rate: 6 },
      { category: '백화점/아울렛', rate: 3 },
    ]),
  ];

  const seed: [string, string, number, CategoryName, number][] = [
    ['c1', '스타벅스 강남점', 6800, '카페', 1],
    ['c1', 'GS25 역삼점', 4300, '편의점', 1],
    ['c1', '카카오T 택시', 12400, '교통', 2],
    ['c1', '배달의민족', 27000, '음식점', 2],
    ['c1', '이마트 성수점', 86400, '마트/식료품', 3],
    ['c1', '스타벅스 삼성점', 11200, '카페', 4],
    ['c1', 'CU 논현점', 3900, '편의점', 5],
    ['c1', '한국전력 전기요금', 68000, '공과금/세금', 5],
    ['c1', 'SRT 승차권', 52400, '교통', 6],
    ['c1', '올리브영', 34500, '생활/뷰티', 7],
    ['c1', '배달의민족', 31200, '음식점', 8],
    ['c1', '메가커피', 2500, '카페', 9],
    ['c1', '쿠팡', 158000, '온라인쇼핑', 10],
    ['c1', '이마트 성수점', 124000, '마트/식료품', 11],
    ['c1', 'GS25 역삼점', 7800, '편의점', 12],
    ['c1', 'CGV 강남', 28000, '문화/구독', 13],
    ['c1', '넷플릭스', 17000, '문화/구독', 14],
    ['c1', '병원 진료비', 48000, '의료/약국', 15],
    ['c1', '배달의민족', 24600, '음식점', 16],
    ['c1', '스타벅스 강남점', 9400, '카페', 17],
    ['c1', '신세계백화점 가전', 389000, '백화점/아울렛', 18],
    ['c2', '쿠팡', 64300, '온라인쇼핑', 2],
    ['c2', '11번가', 128000, '온라인쇼핑', 5],
    ['c2', '홈플러스', 73200, '마트/식료품', 8],
    ['c2', '무신사', 96000, '온라인쇼핑', 12],
    ['c2', 'G마켓', 41800, '온라인쇼핑', 15],
    ['c3', 'GS칼텍스 주유', 82000, '주유/충전', 3],
    ['c3', 'SK에너지 주유', 75000, '주유/충전', 11],
    ['c3', '신세계백화점', 210000, '백화점/아울렛', 14],
    ['c3', '현대오일뱅크', 68000, '주유/충전', 18],
  ];

  const { start } = cycleRange(now, cycleStart);
  const nowISO = now.toISOString();

  const transactions: Transaction[] = seed.map(([cardId, merchant, amount, category, day]) => {
    const d = new Date(start);
    d.setDate(d.getDate() + day - 1);
    d.setHours(9 + (day % 10), (day * 7) % 60);
    const c = cards.find((x) => x.id === cardId)!;
    return {
      id: uid(),
      cardId,
      issuer: c.issuer,
      issuerName: c.name,
      last4: c.last4,
      amount,
      date: d.toISOString(),
      merchant,
      category,
      installment: 0,
      canceled: false,
      cumulative: null,
      excludedManual: null,
      raw: `[Web발신]\n${c.name}(${c.last4})승인\n${won(amount)}원 일시불\n${d.getMonth() + 1}/${d.getDate()} ${merchant}`,
      source: 'sms',
      needsReview: false,
      createdAt: nowISO,
    };
  });

  const unrecognized: Unrecognized[] = [
    {
      id: uid(),
      raw: '[Web발신]\n고객님 이번 달 청구금액 안내\n총 1,284,000원\n자세한 내용은 앱에서 확인하세요',
      reason: '결제 문자가 아닌 안내 문자입니다',
      at: Date.now(),
      resolvedTxnId: null,
    },
  ];

  const stats: ParseStats = { total: transactions.length + 2, ok: transactions.length };

  return { cards, transactions, unrecognized, stats };
}
