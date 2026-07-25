import type { Card, Tier, Transaction } from '@/types';
import { DEFAULT_EXCLUDE } from '@/lib/parser/categories';
import { inRange, type CycleRange } from './cycle';

/** 카드 1장의 주기 실적 계산 결과 (파생 데이터, 저장하지 않음. ERD 4). */
export interface Performance {
  /** 실적 = Σ(주기 내 포함 거래). 취소는 음수로 이미 반영됨 */
  sum: number;
  /** 실적 제외로 분류된 거래 합계 */
  excluded: number;
  /** 이 카드의 주기 내 거래(최신순) */
  list: Transaction[];
  /** min 오름차순 정렬된 구간 */
  tiers: Tier[];
  /** 현재 구간(min ≤ sum인 마지막 구간). 없으면 null */
  cur: Tier | null;
  /** 다음 구간(min > sum인 첫 구간). 없으면 null */
  next: Tier | null;
  /** 최고 구간. 무실적 카드면 null */
  top: Tier | null;
  /** 진행률 0–100 */
  progress: number;
  /** 최고 구간 초과 금액. 초과 아니면 0 */
  overflow: number;
  /** 확보 혜택 = 현재 구간의 benefit */
  benefit: number;
  /** 다음 구간 이득 = next.benefit − cur.benefit */
  nextGain: number;
}

/**
 * 실적 제외 판정. 우선순위: 거래.excludedManual → 카드.excludes → 기본 제외.
 * (TRD 5.2, ERD 2.2)
 */
export function isExcluded(txn: Transaction, card: Card | null | undefined): boolean {
  if (txn.excludedManual !== null && txn.excludedManual !== undefined) {
    return txn.excludedManual;
  }
  const ex = card && card.excludes ? card.excludes : DEFAULT_EXCLUDE;
  return (ex as readonly string[]).includes(txn.category);
}

/**
 * 카드 1장의 실적을 계산한다. 순수 함수.
 * txns는 전체 거래 배열을 받아 내부에서 cardId·주기로 거른다.
 * cardId가 null인 거래는 자연히 제외된다.
 */
export function computePerformance(card: Card, txns: Transaction[], range: CycleRange): Performance {
  const list = txns
    .filter((t) => t.cardId === card.id && inRange(t.date, range))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let sum = 0;
  let excluded = 0;
  for (const t of list) {
    if (isExcluded(t, card)) excluded += t.amount;
    else sum += t.amount;
  }

  const tiers = (card.tiers || []).slice().sort((a, b) => a.min - b.min);
  let cur: Tier | null = null;
  for (const t of tiers) {
    if (sum >= t.min) cur = t; // 경계 정확 일치(sum === min)도 달성으로 본다
  }
  const next = tiers.find((t) => sum < t.min) ?? null;
  const top = tiers.length ? tiers[tiers.length - 1] : null;

  const cap = top ? top.min : Math.max(sum, 1);
  const progress = Math.min(100, Math.round((sum / cap) * 100));
  const overflow = top && sum > top.min ? sum - top.min : 0;
  const benefit = cur ? cur.benefit || 0 : 0;
  const nextGain = next ? (next.benefit || 0) - benefit : 0;

  return { sum, excluded, list, tiers, cur, next, top, progress, overflow, benefit, nextGain };
}
