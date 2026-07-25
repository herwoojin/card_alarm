'use client';

import { useState } from 'react';
import type { CategoryName } from '@/types';
import { CATEGORY_NAMES, classify } from '@/lib/parser/categories';
import { useAppStore } from '@/store/useAppStore';
import { useUI } from '@/components/ui/ui-context';

interface Props {
  unrecId: string;
}

/** 미인식 문자 직접 입력 — 읽지 못한 항목만 채우면 실적에 반영된다. */
export function ManualSheet({ unrecId }: Props) {
  const cards = useAppStore((s) => s.cards);
  const resolveManual = useAppStore((s) => s.resolveManual);
  const ui = useUI();

  const [cardId, setCardId] = useState(cards[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<CategoryName>('기타');

  const onMerchant = (v: string) => {
    setMerchant(v);
    setCategory(classify(v)); // 가맹점 입력 중 실시간으로 업종 자동 선택
  };

  const onSave = async () => {
    const amt = parseInt((amount || '').replace(/[^0-9-]/g, ''), 10);
    if (!cardId || !amt) {
      ui.toast('카드와 금액은 필수입니다');
      return;
    }
    await resolveManual(unrecId, {
      cardId,
      amount: amt,
      date: new Date(date + 'T12:00:00').toISOString(),
      merchant,
      category,
    });
    ui.closeSheet();
    ui.toast('저장했습니다');
  };

  return (
    <>
      <h3>직접 입력</h3>
      <p className="sh-sub">읽지 못한 항목만 채우면 됩니다.</p>
      <label className="f">
        <span>카드</span>
        <select className="i" value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.length ? (
            cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
          ) : (
            <option value="">카드를 먼저 등록하세요</option>
          )}
        </select>
      </label>
      <div className="g2">
        <label className="f">
          <span>금액(원)</span>
          <input className="i num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12000" />
        </label>
        <label className="f">
          <span>날짜</span>
          <input className="i" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="f">
        <span>가맹점</span>
        <input className="i" value={merchant} onChange={(e) => onMerchant(e.target.value)} placeholder="스타벅스 강남점" />
      </label>
      <label className="f">
        <span>업종</span>
        <select className="i" value={category} onChange={(e) => setCategory(e.target.value as CategoryName)}>
          {CATEGORY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <button className="btn" onClick={onSave}>저장</button>
    </>
  );
}
