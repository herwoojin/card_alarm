import type { Card, Transaction } from '@/types';

/**
 * 거래를 보유 카드에 매칭한다. 순수 함수. (ERD 5)
 * 1) issuer + last4 정확 일치 → 그 카드
 * 2) 같은 issuer 카드가 딱 1장 → 그 카드
 * 3) 그 외 → null (카드 미지정)
 */
export function matchCard(txn: Pick<Transaction, 'issuer' | 'last4'>, cards: Card[]): string | null {
  const exact = cards.find((c) => c.issuer === txn.issuer && c.last4 && c.last4 === txn.last4);
  if (exact) return exact.id;
  const same = cards.filter((c) => c.issuer === txn.issuer);
  if (same.length === 1) return same[0].id;
  return null;
}
