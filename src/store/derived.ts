import { useMemo } from 'react';
import { useAppStore } from './useAppStore';
import { cycleRange, daysLeft, type CycleRange } from '@/lib/domain/cycle';
import { computePerformance, type Performance } from '@/lib/domain/performance';
import { optimize, type OptimizeResult } from '@/lib/domain/optimize';
import type { Card } from '@/types';

/**
 * 이번 주기 범위. 메모이제이션 키는 (cycleStart, 오늘 날짜).
 * TRD 8절 메모이제이션 원칙에 맞춰 데이터가 바뀔 때만 재계산한다.
 */
export function useRange(): CycleRange {
  const cycleStart = useAppStore((s) => s.settings.cycleStart);
  const dayKey = new Date().toDateString();
  // dayKey를 의존성에 둬 날짜가 바뀌면(자정 경과) 주기가 다시 계산되게 한다.
  return useMemo(() => {
    void dayKey;
    return cycleRange(new Date(), cycleStart);
  }, [cycleStart, dayKey]);
}

export function useDaysLeft(): number {
  const range = useRange();
  const dayKey = new Date().toDateString();
  return useMemo(() => {
    void dayKey;
    return daysLeft(new Date(), range);
  }, [range, dayKey]);
}

/** 카드 1장의 실적. */
export function usePerformance(card: Card): Performance {
  const transactions = useAppStore((s) => s.transactions);
  const range = useRange();
  return useMemo(() => computePerformance(card, transactions, range), [card, transactions, range]);
}

/**
 * 최적화 결과. 무효화 키: (cards, transactions, cycleStart, reachableFactor).
 * (ERD 4절 메모이제이션 키에 준함)
 */
export function useOptimize(): OptimizeResult {
  const cards = useAppStore((s) => s.cards);
  const transactions = useAppStore((s) => s.transactions);
  const cycleStart = useAppStore((s) => s.settings.cycleStart);
  const reachableFactor = useAppStore((s) => s.settings.reachableFactor);
  const dayKey = new Date().toDateString();
  return useMemo(() => {
    void dayKey;
    const now = new Date();
    const range = cycleRange(now, cycleStart);
    return optimize(cards, transactions, range, now, reachableFactor);
  }, [cards, transactions, cycleStart, reachableFactor, dayKey]);
}
