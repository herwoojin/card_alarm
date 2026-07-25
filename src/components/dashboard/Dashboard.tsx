'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useOptimize, useRange, useDaysLeft } from '@/store/derived';
import { computePerformance } from '@/lib/domain/performance';
import { won, josa } from '@/lib/format';
import { useUI } from '@/components/ui/ui-context';
import { CardGauge } from './CardGauge';
import { TxnRow } from '@/components/TxnRow';
import { PayCta } from '@/components/PayCta';

export function Dashboard() {
  const cards = useAppStore((s) => s.cards);
  const transactions = useAppStore((s) => s.transactions);
  const range = useRange();
  const left = useDaysLeft();
  const { actions, target } = useOptimize();
  const ui = useUI();

  const activeCards = useMemo(() => cards.filter((c) => c.active !== false), [cards]);

  const recent = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6),
    [transactions],
  );

  const perfById = useMemo(() => {
    const map = new Map(activeCards.map((c) => [c.id, computePerformance(c, transactions, range)]));
    return map;
  }, [activeCards, transactions, range]);

  if (!activeCards.length) {
    return (
      <div className="empty">
        <div className="em" aria-hidden="true">💳</div>
        <p>
          카드를 등록하면 이번 주기에 어떤 카드를 써야 하는지
          <br />한 장으로 알려드립니다.
        </p>
        <button className="btn" onClick={() => ui.openSheet({ kind: 'presets' })}>
          템플릿에서 카드 추가
        </button>
        <div style={{ height: 8 }} />
        <a className="btn ghost" href="/guide" style={{ display: 'block', textDecoration: 'none' }}>
          📖 아주 쉽게 보는 사용법
        </a>
      </div>
    );
  }

  const over = actions.find((a) => a.type === 'over');
  const pick = target ? target.card : activeCards[0];
  const pickPerf = perfById.get(pick.id)!;
  const why = over
    ? `${josa(over.cardName, ['은', '는'])} 최고 구간을 넘겼습니다. 이제 여기로 옮기세요.`
    : pickPerf.next
      ? `${pickPerf.next.label} 구간까지 ${won(pickPerf.next.min - pickPerf.sum)}원 남아 가장 가깝습니다.`
      : '모든 카드가 구간을 채웠습니다. 무리해서 더 쓸 필요 없습니다.';

  const totalBenefit = activeCards.reduce((s, c) => s + (perfById.get(c.id)?.benefit ?? 0), 0);
  const totalSpend = activeCards.reduce((s, c) => s + (perfById.get(c.id)?.sum ?? 0), 0);

  return (
    <>
      <div className="hero">
        <div className="mark" aria-hidden="true" />
        <div className="eyebrow">지금 이 카드로</div>
        <div className="pick">{pick.name}</div>
        <p className="why">{why}</p>
        <div className="stat">
          <div>
            이번 주기 실적<b className="num">{won(totalSpend)}원</b>
          </div>
          <div>
            확보한 혜택<b className="num">{won(totalBenefit)}원</b>
          </div>
          <div>
            남은 날<b className="num">{left}일</b>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <PayCta issuer={pick.issuer} />
        </div>
        <p className="why" style={{ marginTop: 8, fontSize: 11.5 }}>
          결제는 카드사 앱에서 진행됩니다. 실적ON은 카드번호를 저장하지 않습니다.
        </p>
      </div>

      <div className="sec">카드별 실적 진행률</div>
      <div>
        {activeCards.map((c) => (
          <CardGauge key={c.id} card={c} perf={perfById.get(c.id)!} onEdit={() => ui.openSheet({ kind: 'card', cardId: c.id })} />
        ))}
      </div>

      <div className="sec">최근 결제</div>
      <div className="box">
        {recent.length ? (
          recent.map((t) => <TxnRow key={t.id} txn={t} cards={cards} onClick={() => ui.openSheet({ kind: 'txn', txnId: t.id })} />)
        ) : (
          <div className="empty" style={{ padding: 18 }}>
            <p style={{ margin: 0 }}>문자분석 탭에서 결제 문자를 넣어보세요.</p>
          </div>
        )}
      </div>

      <p className="note">모든 계산은 이 기기 안에서만 이뤄집니다. 결제 내역은 서버로 전송되지 않습니다.</p>
    </>
  );
}
