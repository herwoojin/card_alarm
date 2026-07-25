'use client';

import { useAppStore } from '@/store/useAppStore';
import { useOptimize, useDaysLeft } from '@/store/derived';
import { bestCardFor } from '@/lib/domain/optimize';
import { CATEGORY_NAMES, CATEGORY_ICON } from '@/lib/parser/categories';
import { won } from '@/lib/format';
import { PayCta } from '@/components/PayCta';

export function OptimizeScreen() {
  const cards = useAppStore((s) => s.cards);
  const { actions } = useOptimize();
  const left = useDaysLeft();

  if (!cards.length) {
    return (
      <>
        <h1 className="view-title">최적화</h1>
        <p className="view-sub">넘친 카드는 멈추고, 모자란 카드로 옮깁니다.</p>
        <div className="empty">
          <div className="em" aria-hidden="true">🎯</div>
          <p>카드를 먼저 등록해 주세요.</p>
        </div>
      </>
    );
  }

  const totalSave = actions.reduce((s, a) => s + (a.gain || 0), 0);

  return (
    <>
      <h1 className="view-title">최적화</h1>
      <p className="view-sub">넘친 카드는 멈추고, 모자란 카드로 옮깁니다.</p>

      <div className="box" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>
        <div style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--hl)', fontWeight: 700 }}>
          이번 주기 조치로 얻을 수 있는 금액
        </div>
        <div className="num" style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>
          {won(totalSave)}
          <span style={{ fontSize: 15 }}>원</span>
        </div>
        <div style={{ fontSize: 12, color: '#AFBACD', marginTop: 4 }}>남은 {left}일 안에 아래 순서대로 옮기면 됩니다.</div>
      </div>

      <div className="sec">해야 할 일</div>
      {actions.length ? (
        actions.map((a) => (
          <div className={`act ${a.type}`} key={a.cardId}>
            <h4>{a.title}</h4>
            <p>{a.body}</p>
            {a.gain > 0 ? <span className="save num">+{won(a.gain)}원</span> : null}
            {a.type === 'over' && a.altIssuer ? (
              <div style={{ marginTop: 9 }}>
                <PayCta issuer={a.altIssuer} variant="hl sm" prefix="여기로 옮기기" />
              </div>
            ) : a.type === 'fill-need' ? (
              <div style={{ marginTop: 9 }}>
                <PayCta issuer={a.issuer} variant="ghost sm" prefix="이 카드로 결제" />
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="box">
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>지금은 조치할 항목이 없습니다.</div>
        </div>
      )}

      {actions.some((a) => a.type === 'over' || a.type === 'fill-need') ? (
        <p className="note">결제는 카드사 앱에서 진행됩니다. 실적ON은 카드번호를 저장하지 않고, 실적은 결제 문자로만 반영됩니다.</p>
      ) : null}

      <div className="sec">업종별로 꺼낼 카드</div>
      <div className="box">
        {CATEGORY_NAMES.filter((c) => c !== '기타').map((cat) => {
          const best = bestCardFor(cat, cards);
          return (
            <div className="tx static" key={cat}>
              <span className="ico" aria-hidden="true">{CATEGORY_ICON[cat]}</span>
              <span className="mid">
                <span className="mch">{cat}</span>
                <span className="meta">{best ? best.card.name : '등록된 적립 조건 없음'}</span>
              </span>
              <span className="val num">{best ? `${best.rate}%` : '—'}</span>
            </div>
          );
        })}
      </div>
      <p className="note">적립률은 내 카드 화면에서 직접 입력한 값으로 계산합니다. 카드사 공지와 다르면 값을 수정하세요.</p>
    </>
  );
}
