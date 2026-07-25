'use client';

import type { Card, Transaction } from '@/types';
import { CATEGORY_ICON } from '@/lib/parser/categories';
import { isExcluded } from '@/lib/domain/performance';
import { fmtDate, won } from '@/lib/format';

interface TxnRowProps {
  txn: Transaction;
  cards: Card[];
  onClick?: () => void;
}

/** 거래 1건 행. 대시보드 최근 결제·문자분석 거래 목록에서 공용으로 쓴다. */
export function TxnRow({ txn, cards, onClick }: TxnRowProps) {
  const card = cards.find((c) => c.id === txn.cardId) ?? null;
  const excluded = isExcluded(txn, card);
  const meta = `${fmtDate(txn.date)} · ${card ? card.name : txn.issuerName}${
    txn.installment ? ` · ${txn.installment}개월` : ''
  }`;

  const inner = (
    <>
      <span className="ico" aria-hidden="true">
        {CATEGORY_ICON[txn.category] || '•'}
      </span>
      <span className="mid">
        <span className="mch">{txn.merchant}</span>
        <span className="meta">{meta}</span>
      </span>
      <span className="val num">
        {txn.amount < 0 ? '-' : ''}
        {won(Math.abs(txn.amount))}원
        {excluded ? <small>실적 제외</small> : null}
        {!txn.cardId ? <small>카드 미지정</small> : null}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`tx${txn.canceled ? ' cx' : ''}`} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={`tx static${txn.canceled ? ' cx' : ''}`}>{inner}</div>;
}
