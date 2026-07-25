import { describe, it, expect } from 'vitest';
import type { Card, Transaction, Tier } from '@/types';
import { cycleRange, daysLeft } from '../cycle';
import { computePerformance, isExcluded } from '../performance';
import { optimize } from '../optimize';
import { monthlyTrend, categoryBreakdown, yearlyOutlook } from '../analytics';

/* ── 테스트 헬퍼 ─────────────────────────────────── */
function mkCard(over: Partial<Card> = {}): Card {
  const nowISO = new Date().toISOString();
  return {
    id: 'card-1',
    issuer: 'shinhan',
    name: '테스트카드',
    last4: '1234',
    annualFee: 12000,
    tiers: [
      { label: '30만', min: 300000, benefit: 10000 },
      { label: '50만', min: 500000, benefit: 22000 },
      { label: '100만', min: 1000000, benefit: 45000 },
    ],
    excludes: ['공과금/세금', '상품권/충전', '보험/금융'],
    rates: [],
    cycleStartDay: null,
    installmentPolicy: 'full',
    active: true,
    createdAt: nowISO,
    updatedAt: nowISO,
    ...over,
  };
}

let txnSeq = 0;
function mkTxn(over: Partial<Transaction> = {}): Transaction {
  txnSeq += 1;
  return {
    id: `t-${txnSeq}`,
    cardId: 'card-1',
    issuer: 'shinhan',
    issuerName: '신한카드',
    last4: '1234',
    amount: 100000,
    date: new Date(2026, 6, 10, 12, 0).toISOString(),
    merchant: '테스트가맹점',
    category: '음식점',
    installment: 0,
    canceled: false,
    cumulative: null,
    excludedManual: null,
    raw: '',
    source: 'manual',
    needsReview: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const RANGE = cycleRange(new Date(2026, 6, 15), 1); // 2026-07-01 ~ 08-01

describe('cycle', () => {
  it('주기 시작 31일 + 2월이면 말일(28/29)로 보정한다', () => {
    // 2026-02는 28일까지. startDay=31 → 2/28 시작. now는 그 이후여야 이 주기가 활성
    const r = cycleRange(new Date(2026, 1, 28, 12, 0), 31);
    expect(r.start.getMonth()).toBe(1); // February
    expect(r.start.getDate()).toBe(28); // 31 → 말일 28로 보정
    expect(r.end.getMonth()).toBe(2); // March
    expect(r.end.getDate()).toBe(31); // 3월은 31일 존재
  });

  it('시작일 이전이면 지난 달 주기로 잡는다', () => {
    const r = cycleRange(new Date(2026, 6, 3), 10); // 7/3, startDay 10 → 6/10~7/10
    expect(r.start.getMonth()).toBe(5); // June
    expect(r.start.getDate()).toBe(10);
    expect(r.end.getMonth()).toBe(6); // July
  });

  it('남은 날은 최소 1 (0으로 나누지 않는다)', () => {
    const range = cycleRange(new Date(2026, 6, 15), 1);
    // 주기 종료 시각을 now로 주면 0이 되겠지만 최소 1을 보장
    const atEnd = daysLeft(range.end, range);
    expect(atEnd).toBeGreaterThanOrEqual(1);
  });
});

describe('performance', () => {
  it('구간 경계에 정확히 일치하면(sum === min) 달성으로 본다', () => {
    const card = mkCard();
    const txns = [mkTxn({ amount: 300000, category: '음식점' })];
    const p = computePerformance(card, txns, RANGE);
    expect(p.sum).toBe(300000);
    expect(p.cur?.min).toBe(300000);
    expect(p.next?.min).toBe(500000);
  });

  it('취소 거래로 실적이 구간 아래로 내려간다', () => {
    const card = mkCard();
    const txns = [mkTxn({ amount: 320000 }), mkTxn({ amount: -50000, canceled: true })];
    const p = computePerformance(card, txns, RANGE);
    expect(p.sum).toBe(270000);
    expect(p.cur).toBeNull(); // 30만 구간 미달
    expect(p.next?.min).toBe(300000);
  });

  it('tiers가 빈 배열인 무실적 카드', () => {
    const card = mkCard({ tiers: [] as Tier[] });
    const txns = [mkTxn({ amount: 120000 })];
    const p = computePerformance(card, txns, RANGE);
    expect(p.top).toBeNull();
    expect(p.cur).toBeNull();
    expect(p.next).toBeNull();
    expect(p.overflow).toBe(0);
    expect(p.sum).toBe(120000);
  });

  it('거래 0건이면 sum 0', () => {
    const p = computePerformance(mkCard(), [], RANGE);
    expect(p.sum).toBe(0);
    expect(p.progress).toBe(0);
  });

  it('cardId가 null인 거래는 실적에서 빠진다', () => {
    const card = mkCard();
    const txns = [mkTxn({ amount: 100000 }), mkTxn({ cardId: null, amount: 999999 })];
    const p = computePerformance(card, txns, RANGE);
    expect(p.sum).toBe(100000);
  });

  it('최고 구간 초과 시 overflow를 계산한다', () => {
    const card = mkCard();
    const txns = [mkTxn({ amount: 1180000 })];
    const p = computePerformance(card, txns, RANGE);
    expect(p.overflow).toBe(180000);
    expect(p.next).toBeNull();
    expect(p.progress).toBe(100);
  });

  it('실적 제외 우선순위: excludedManual > card.excludes > 기본', () => {
    const card = mkCard();
    // 업종상 제외(공과금)지만 수동으로 포함 지정
    const included = mkTxn({ category: '공과금/세금', excludedManual: false });
    expect(isExcluded(included, card)).toBe(false);
    // 업종상 포함(음식점)이지만 수동으로 제외 지정
    const excluded = mkTxn({ category: '음식점', excludedManual: true });
    expect(isExcluded(excluded, card)).toBe(true);
    // 규칙에 위임(null) → card.excludes 따름
    const auto = mkTxn({ category: '공과금/세금', excludedManual: null });
    expect(isExcluded(auto, card)).toBe(true);
  });
});

describe('optimize', () => {
  const NOW = new Date(2026, 6, 15, 12, 0);

  it('모든 카드가 최고 구간을 넘겨도 오류 없이 대체 카드 없음 처리', () => {
    const cardA = mkCard({ id: 'A', name: 'A카드' });
    const cardB = mkCard({ id: 'B', name: 'B카드' });
    const txns = [
      mkTxn({ cardId: 'A', amount: 1200000 }),
      mkTxn({ cardId: 'B', amount: 1300000 }),
    ];
    const { actions } = optimize([cardA, cardB], txns, RANGE, NOW);
    expect(actions).toHaveLength(2);
    for (const a of actions) {
      expect(a.type).toBe('over');
      expect(a.altCardName).toBeNull(); // 옮겨갈 미달 카드가 없다
    }
  });

  it('초과 카드가 있으면 대체 카드명과 필요액이 문장에 나타난다', () => {
    const over = mkCard({ id: 'A', name: '신한 생활카드' });
    const shortCard = mkCard({ id: 'B', name: 'KB 쇼핑카드' });
    const txns = [
      mkTxn({ cardId: 'A', amount: 1180000 }),
      mkTxn({ cardId: 'B', amount: 380000 }),
    ];
    const { actions } = optimize([over, shortCard], txns, RANGE, NOW);
    const overAction = actions.find((a) => a.type === 'over');
    expect(overAction).toBeDefined();
    expect(overAction!.body).toContain('KB 쇼핑카드');
    expect(overAction!.altCardName).toBe('KB 쇼핑카드');
  });

  it('도달 어려운 카드에는 포기 권고 문구가 들어간다', () => {
    // 주기 후반, 낮은 소비 속도 → 큰 필요액은 도달 불가 → 'ok' 타입 + 포기 권고
    const now = new Date(2026, 6, 25, 12, 0); // 주기 대부분 경과
    const card = mkCard({ id: 'A', name: '현대 주유카드' });
    const txns = [mkTxn({ cardId: 'A', amount: 20000, date: new Date(2026, 6, 5, 12).toISOString() })];
    const range = cycleRange(now, 1);
    const { actions } = optimize([card], txns, range, now);
    const act = actions[0];
    expect(act.type).toBe('ok');
    expect(act.body).toContain('무리라면 이번 주기는 접고 다른 카드에 집중하세요');
  });

  it('초과 조치가 목록 최상단에 온다', () => {
    const over = mkCard({ id: 'A', name: 'A' });
    const fill = mkCard({ id: 'B', name: 'B' });
    const txns = [mkTxn({ cardId: 'A', amount: 1200000 }), mkTxn({ cardId: 'B', amount: 480000 })];
    const { actions } = optimize([over, fill], txns, RANGE, NOW);
    expect(actions[0].type).toBe('over');
  });
});

describe('analytics', () => {
  const NOW = new Date(2026, 6, 15);

  it('거래 0건이어도 0으로 나누지 않는다', () => {
    const months = monthlyTrend([], 6, NOW);
    expect(months).toHaveLength(6);
    expect(months.every((m) => m.sum === 0)).toBe(true);
    const cats = categoryBreakdown([], RANGE);
    expect(cats).toHaveLength(0);
  });

  it('업종별 합계를 내림차순으로 반환한다', () => {
    const txns = [
      mkTxn({ amount: 50000, category: '카페' }),
      mkTxn({ amount: 120000, category: '온라인쇼핑' }),
      mkTxn({ amount: 30000, category: '카페' }),
    ];
    const cats = categoryBreakdown(txns, RANGE);
    expect(cats[0].category).toBe('온라인쇼핑');
    expect(cats[0].sum).toBe(120000);
    expect(cats[1].category).toBe('카페');
    expect(cats[1].sum).toBe(80000);
  });

  it('연간 전망은 연회비를 차감한다', () => {
    const card = mkCard({ annualFee: 15000 });
    const outlook = yearlyOutlook([card], 10000, 5000);
    expect(outlook.now).toBe(10000 * 12 - 15000);
    expect(outlook.optimized).toBe((10000 + 5000) * 12 - 15000);
    expect(outlook.gain).toBe(5000 * 12);
  });
});
