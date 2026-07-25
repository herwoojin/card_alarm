'use client';

import { useState } from 'react';
import type { CategoryName, IssuerKey } from '@/types';
import { ISSUERS } from '@/lib/parser/rules';
import { CATEGORY_NAMES } from '@/lib/parser/categories';
import { DEFAULT_EXCLUDE } from '@/lib/parser/categories';
import { useAppStore, normalizeTiersInput } from '@/store/useAppStore';
import { useUI } from '@/components/ui/ui-context';

interface TierRow {
  label: string;
  min: string;
  benefit: string;
}

interface Props {
  cardId?: string;
}

const DEFAULT_TIERS: TierRow[] = [
  { label: '30만', min: '300000', benefit: '10000' },
  { label: '50만', min: '500000', benefit: '20000' },
  { label: '100만', min: '1000000', benefit: '35000' },
];

export function CardEditorSheet({ cardId }: Props) {
  const card = useAppStore((s) => (cardId ? s.cards.find((c) => c.id === cardId) : undefined));
  const saveCard = useAppStore((s) => s.saveCard);
  const removeCard = useAppStore((s) => s.removeCard);
  const ui = useUI();

  const [issuer, setIssuer] = useState<IssuerKey>(card?.issuer ?? 'shinhan');
  const [last4, setLast4] = useState(card?.last4 ?? '');
  const [name, setName] = useState(card?.name ?? '');
  const [annualFee, setAnnualFee] = useState(String(card?.annualFee ?? 0));
  const [tiers, setTiers] = useState<TierRow[]>(
    card ? card.tiers.map((t) => ({ label: t.label, min: String(t.min), benefit: String(t.benefit) })) : DEFAULT_TIERS,
  );
  const [excludes, setExcludes] = useState<Set<CategoryName>>(
    new Set(card ? card.excludes : DEFAULT_EXCLUDE),
  );
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    (card?.rates ?? []).forEach((r) => (m[r.category] = String(r.rate)));
    return m;
  });

  const updateTier = (i: number, key: keyof TierRow, value: string) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));
  const addTier = () => setTiers((prev) => [...prev, { label: '', min: '', benefit: '' }]);
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const toggleExclude = (cat: CategoryName) =>
    setExcludes((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const onSave = async () => {
    const normalizedTiers = normalizeTiersInput(
      tiers.map((t) => ({
        label: t.label.trim(),
        min: parseInt(t.min.replace(/[^0-9]/g, '') || '0', 10),
        benefit: parseInt(t.benefit.replace(/[^0-9]/g, '') || '0', 10),
      })),
    );
    const rateList = CATEGORY_NAMES.filter((n) => n !== '기타')
      .map((n) => ({ category: n, rate: parseFloat(rates[n] || '0'), monthlyCap: null }))
      .filter((r) => r.rate > 0);
    const issuerName = ISSUERS.find((i) => i.key === issuer)?.name ?? '카드';

    await saveCard({
      id: cardId,
      issuer,
      name: name.trim() || issuerName,
      last4: last4.replace(/\D/g, '').slice(0, 4),
      annualFee: parseInt(annualFee.replace(/[^0-9]/g, '') || '0', 10),
      tiers: normalizedTiers,
      excludes: [...excludes],
      rates: rateList,
    });
    ui.closeSheet();
    ui.toast('저장했습니다');
  };

  const onDelete = async () => {
    if (!cardId) return;
    await removeCard(cardId);
    ui.closeSheet();
    ui.toast('카드를 삭제했습니다 (거래 내역은 보존됩니다)');
  };

  return (
    <>
      <h3>{card ? '카드 편집' : '카드 추가'}</h3>
      <p className="sh-sub">카드사 공지에 적힌 값을 그대로 옮겨 적으면 계산이 정확해집니다.</p>

      <div className="g2">
        <label className="f">
          <span>카드사</span>
          <select className="i" value={issuer} onChange={(e) => setIssuer(e.target.value as IssuerKey)}>
            {ISSUERS.filter((i) => i.key !== 'etc').map((i) => (
              <option key={i.key} value={i.key}>{i.name}</option>
            ))}
          </select>
        </label>
        <label className="f">
          <span>카드 뒷 4자리</span>
          <input
            className="i num"
            maxLength={4}
            inputMode="numeric"
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
          />
        </label>
      </div>
      <label className="f">
        <span>카드 이름</span>
        <input className="i" value={name} onChange={(e) => setName(e.target.value)} placeholder="신한 딥드림" />
      </label>
      <label className="f">
        <span>연회비(원)</span>
        <input className="i num" inputMode="numeric" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} />
      </label>

      <div className="sec" style={{ marginTop: 14 }}>실적 구간</div>
      <div>
        {tiers.map((t, i) => (
          <div className="g3" style={{ marginBottom: 7, gridTemplateColumns: '1fr 1fr 1fr auto' }} key={i}>
            <input className="i" value={t.label} onChange={(e) => updateTier(i, 'label', e.target.value)} placeholder="30만" />
            <input className="i num" inputMode="numeric" value={t.min} onChange={(e) => updateTier(i, 'min', e.target.value)} placeholder="300000" />
            <input className="i num" inputMode="numeric" value={t.benefit} onChange={(e) => updateTier(i, 'benefit', e.target.value)} placeholder="혜택 10000" />
            <button className="btn ghost sm" style={{ minWidth: 40 }} onClick={() => removeTier(i)} aria-label="구간 삭제">✕</button>
          </div>
        ))}
      </div>
      <button className="btn ghost sm" onClick={addTier}>구간 추가</button>

      <div className="sec">실적에서 빼는 업종</div>
      <div className="chips">
        {CATEGORY_NAMES.map((n) => (
          <button type="button" className={`chip${excludes.has(n) ? ' on' : ''}`} key={n} aria-pressed={excludes.has(n)} onClick={() => toggleExclude(n)}>
            {n}
          </button>
        ))}
      </div>

      <div className="sec">업종별 적립률(%)</div>
      <div className="g2">
        {CATEGORY_NAMES.filter((n) => n !== '기타').map((n) => (
          <label className="f" style={{ marginBottom: 6 }} key={n}>
            <span>{n}</span>
            <input
              className="i num"
              inputMode="decimal"
              value={rates[n] ?? ''}
              onChange={(e) => setRates((prev) => ({ ...prev, [n]: e.target.value }))}
              placeholder="0"
            />
          </label>
        ))}
      </div>

      <button className="btn" onClick={onSave}>저장</button>
      {card ? (
        <div className="btnrow">
          <button className="btn ghost" onClick={onDelete}>카드 삭제</button>
        </div>
      ) : null}
    </>
  );
}
