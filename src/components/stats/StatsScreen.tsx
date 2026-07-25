'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useRange, useOptimize } from '@/store/derived';
import { computePerformance } from '@/lib/domain/performance';
import { monthlyTrend, categoryBreakdown, yearlyOutlook } from '@/lib/domain/analytics';
import { bestCardFor } from '@/lib/domain/optimize';
import { CATEGORY_ICON } from '@/lib/parser/categories';
import { won } from '@/lib/format';

export function StatsScreen() {
  const cards = useAppStore((s) => s.cards);
  const transactions = useAppStore((s) => s.transactions);
  const range = useRange();
  const { actions } = useOptimize();

  const now = useMemo(() => new Date(), []);
  const months = useMemo(() => monthlyTrend(transactions, 6, now), [transactions, now]);
  const cats = useMemo(() => categoryBreakdown(transactions, range), [transactions, range]);

  const activeCards = cards.filter((c) => c.active !== false);
  const monthlyBenefit = activeCards.reduce((s, c) => s + computePerformance(c, transactions, range).benefit, 0);
  const monthlyExtra = actions.reduce((s, a) => s + (a.gain || 0), 0);
  const outlook = yearlyOutlook(cards, monthlyBenefit, monthlyExtra);
  const fees = cards.reduce((s, c) => s + (c.annualFee || 0), 0);

  if (!transactions.length) {
    return (
      <>
        <h1 className="view-title">분석</h1>
        <p className="view-sub">쓰는 방식이 보이면, 어떤 카드를 남길지도 보입니다.</p>
        <div className="empty">
          <div className="em" aria-hidden="true">📈</div>
          <p>결제 내역이 쌓이면 소비 패턴이 보입니다.</p>
        </div>
      </>
    );
  }

  const mx = Math.max(...months.map((m) => m.sum), 1);
  const catMax = cats.length ? cats[0].sum : 1;
  const catTotal = cats.reduce((s, c) => s + c.sum, 0) || 1;
  const thisMonthSum = months[months.length - 1]?.sum ?? 0;

  return (
    <>
      <h1 className="view-title">분석</h1>
      <p className="view-sub">쓰는 방식이 보이면, 어떤 카드를 남길지도 보입니다.</p>

      <div className="sec">월별 소비</div>
      <div className="box">
        <div className="bars">
          {months.map((m, i) => (
            <div className={`b${i === months.length - 1 ? ' cur' : ''}`} key={`${m.year}-${m.month}`}>
              <i style={{ height: `${Math.max(3, (m.sum / mx) * 100)}%` }} />
              <em>{m.month + 1}월</em>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-2)' }}>
          <span>이번 달</span>
          <b className="num">{won(thisMonthSum)}원</b>
        </div>
      </div>

      <div className="sec">이번 주기 업종별</div>
      <div className="box">
        {cats.length ? (
          cats.map(({ category, sum }) => {
            const best = bestCardFor(category, cards);
            return (
              <div className="hbar" key={category}>
                <div className="l">
                  <b>
                    {CATEGORY_ICON[category] || '•'} {category}
                    {best ? ` · ${best.card.name} 추천` : ''}
                  </b>
                  <span>
                    {won(sum)}원 ({Math.round((sum / catTotal) * 100)}%)
                  </span>
                </div>
                <div className="t">
                  <i style={{ width: `${Math.max(2, (sum / catMax) * 100)}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>이번 주기 내역이 없습니다.</div>
        )}
      </div>

      <div className="sec">연간 전망</div>
      <div className="box">
        <div className="tx static">
          <span className="ico" aria-hidden="true">📅</span>
          <span className="mid">
            <span className="mch">지금 방식 그대로</span>
            <span className="meta">현재 달성 구간 기준 · 연회비 {won(fees)}원 차감</span>
          </span>
          <span className="val num">{won(outlook.now)}원</span>
        </div>
        <div className="tx static">
          <span className="ico" aria-hidden="true">🎯</span>
          <span className="mid">
            <span className="mch">최적화 조치를 따랐을 때</span>
            <span className="meta">매달 권장 카드로 갈아탄다고 가정</span>
          </span>
          <span className="val num" style={{ color: 'var(--go)' }}>{won(outlook.optimized)}원</span>
        </div>
        <div className="tx static">
          <span className="ico" aria-hidden="true">✨</span>
          <span className="mid">
            <span className="mch">연간 추가 확보액</span>
            <span className="meta">차액</span>
          </span>
          <span className="val num" style={{ color: 'var(--go)' }}>+{won(outlook.gain)}원</span>
        </div>
      </div>
      <p className="note">예측은 입력한 혜택 금액과 이번 주기 사용 패턴이 유지된다고 가정한 값입니다.</p>
    </>
  );
}
