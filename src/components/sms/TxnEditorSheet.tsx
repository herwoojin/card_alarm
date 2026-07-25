'use client';

import { useState } from 'react';
import type { CategoryName } from '@/types';
import { CATEGORY_NAMES } from '@/lib/parser/categories';
import { isExcluded } from '@/lib/domain/performance';
import { fmtDate, won } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import { useUI } from '@/components/ui/ui-context';

interface Props {
  txnId: string;
}

type ExcludeChoice = 'auto' | 'in' | 'out';

/** 거래 편집 — 카드 지정 / 업종 / 실적 반영 3택 / 원문 보기 / 삭제. */
export function TxnEditorSheet({ txnId }: Props) {
  const txn = useAppStore((s) => s.transactions.find((t) => t.id === txnId));
  const cards = useAppStore((s) => s.cards);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const removeTransaction = useAppStore((s) => s.removeTransaction);
  const ui = useUI();

  const card = cards.find((c) => c.id === txn?.cardId) ?? null;
  const initialChoice: ExcludeChoice = txn == null || txn.excludedManual === null ? 'auto' : txn.excludedManual ? 'out' : 'in';

  const [cardId, setCardId] = useState(txn?.cardId ?? '');
  const [category, setCategory] = useState<CategoryName>(txn?.category ?? '기타');
  const [choice, setChoice] = useState<ExcludeChoice>(initialChoice);

  if (!txn) return null;

  const onSave = async () => {
    const excludedManual = choice === 'auto' ? null : choice === 'out';
    await updateTransaction(txn.id, { cardId: cardId || null, category, excludedManual });
    ui.closeSheet();
    ui.toast('반영했습니다');
  };

  const onDelete = async () => {
    await removeTransaction(txn.id);
    ui.closeSheet();
    ui.toast('삭제했습니다');
  };

  const currentExcluded = isExcluded(txn, card);

  return (
    <>
      <h3>{txn.merchant}</h3>
      <p className="sh-sub">
        {fmtDate(txn.date)} · {txn.issuerName} · {won(Math.abs(txn.amount))}원{txn.canceled ? ' (취소)' : ''}
      </p>
      <label className="f">
        <span>카드 지정</span>
        <select className="i" value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">지정 안 함</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="f">
        <span>업종</span>
        <select className="i" value={category} onChange={(e) => setCategory(e.target.value as CategoryName)}>
          {CATEGORY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="f">
        <span>실적 반영</span>
        <select className="i" value={choice} onChange={(e) => setChoice(e.target.value as ExcludeChoice)}>
          <option value="auto">업종 규칙에 맡기기 (현재 {currentExcluded ? '제외' : '포함'})</option>
          <option value="in">실적에 포함</option>
          <option value="out">실적에서 제외</option>
        </select>
      </label>
      <details style={{ margin: '6px 0 14px' }}>
        <summary style={{ fontSize: 12, color: 'var(--mute)' }}>원본 문자 보기</summary>
        <div className="num" style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', color: 'var(--ink-2)', marginTop: 8 }}>
          {txn.raw || '—'}
        </div>
      </details>
      <button className="btn" onClick={onSave}>저장</button>
      <div className="btnrow">
        <button className="btn ghost" onClick={onDelete}>이 거래 삭제</button>
      </div>
    </>
  );
}
