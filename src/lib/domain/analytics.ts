import type { Card, CategoryName, Transaction } from '@/types';
import { inRange, type CycleRange } from './cycle';

export interface MonthBucket {
  year: number;
  /** 0-based month index */
  month: number;
  sum: number;
}

/**
 * 최근 N개월 합계. 순수 함수. 거래 0건이면 전부 0인 버킷 배열.
 * (취소는 음수로 반영되어 자연 차감된다)
 */
export function monthlyTrend(txns: Transaction[], months: number, now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), sum: 0 });
  }
  for (const t of txns) {
    const d = new Date(t.date);
    const b = buckets.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
    if (b) b.sum += t.amount;
  }
  return buckets;
}

export interface CategoryBucket {
  category: CategoryName;
  sum: number;
}

/** 이번 주기 업종별 합계, 내림차순. 순수 함수. */
export function categoryBreakdown(txns: Transaction[], range: CycleRange): CategoryBucket[] {
  const map = new Map<CategoryName, number>();
  for (const t of txns) {
    if (!inRange(t.date, range)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, sum]) => ({ category, sum }))
    .sort((a, b) => b.sum - a.sum);
}

export interface YearlyOutlook {
  /** 지금 방식 그대로 (연회비 차감 후) */
  now: number;
  /** 최적화 조치를 따랐을 때 (연회비 차감 후) */
  optimized: number;
  /** 연간 추가 확보액 (차액) */
  gain: number;
}

/**
 * 연간 전망. 순수 함수.
 * @param cards 카드(연회비 합산용)
 * @param monthlyBenefit 현재 확보 중인 월 혜택 합 (Σ perf.benefit)
 * @param monthlyExtra 최적화 조치로 추가되는 월 이득 합 (Σ action.gain)
 */
export function yearlyOutlook(cards: Card[], monthlyBenefit: number, monthlyExtra: number): YearlyOutlook {
  const fees = cards.reduce((s, c) => s + (c.annualFee || 0), 0);
  const nowVal = monthlyBenefit * 12 - fees;
  const optimized = (monthlyBenefit + monthlyExtra) * 12 - fees;
  return { now: nowVal, optimized, gain: optimized - nowVal };
}
