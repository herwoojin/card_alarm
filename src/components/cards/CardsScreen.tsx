'use client';

import { useAppStore } from '@/store/useAppStore';
import { useRange } from '@/store/derived';
import { computePerformance } from '@/lib/domain/performance';
import { DEFAULT_EXCLUDE } from '@/lib/parser/categories';
import { won } from '@/lib/format';
import { useUI } from '@/components/ui/ui-context';

export function CardsScreen() {
  const cards = useAppStore((s) => s.cards);
  const transactions = useAppStore((s) => s.transactions);
  const range = useRange();
  const ui = useUI();

  return (
    <>
      <h1 className="view-title">내 카드</h1>
      <p className="view-sub">실적 구간, 연회비, 혜택, 실적 제외 항목을 카드별로 관리합니다.</p>

      {cards.length === 0 ? (
        <div className="empty">
          <div className="em" aria-hidden="true">🗂️</div>
          <p>
            등록된 카드가 없습니다.
            <br />실적 구간과 혜택을 넣으면 계산이 시작됩니다.
          </p>
        </div>
      ) : (
        cards.map((c) => {
          const p = computePerformance(c, transactions, range);
          const tierTxt = (c.tiers || []).map((t) => `${t.label} → ${won(t.benefit || 0)}원`).join(' / ') || '구간 없음';
          const exTxt = (c.excludes && c.excludes.length ? c.excludes : DEFAULT_EXCLUDE).join(', ') || '없음';
          const rateTxt = (c.rates || []).map((r) => `${r.category} ${r.rate}%`).join(' · ') || '미입력';
          return (
            <div className="box" style={{ marginBottom: 11 }} key={c.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <b style={{ fontSize: 15, letterSpacing: '-.03em' }}>{c.name}</b>
                <span className="l4 num" style={{ fontSize: 11, color: 'var(--mute)' }}>
                  {c.last4 ? '···' + c.last4 : '뒷자리 미등록'}
                </span>
                <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => ui.openSheet({ kind: 'card', cardId: c.id })}>
                  편집
                </button>
              </div>
              <div className="hbar">
                <div className="l">
                  <b>이번 주기 실적</b>
                  <span>{won(p.sum)}원</span>
                </div>
                <div className="t">
                  <i style={{ width: `${p.progress}%`, background: p.overflow > 0 ? 'var(--warn)' : 'var(--ink)' }} />
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.75 }}>
                <div><b>실적 구간</b> · {tierTxt}</div>
                <div><b>연회비</b> · {won(c.annualFee || 0)}원</div>
                <div><b>주요 적립</b> · {rateTxt}</div>
                <div><b>실적 제외</b> · {exTxt}</div>
              </div>
            </div>
          );
        })
      )}

      <div className="btnrow">
        <button className="btn" onClick={() => ui.openSheet({ kind: 'card' })}>카드 추가</button>
        <button className="btn ghost" onClick={() => ui.openSheet({ kind: 'presets' })}>템플릿에서 고르기</button>
      </div>
      <p className="note">구간·혜택 금액은 카드사 공지 기준으로 직접 확인해 입력하세요. 카드사 정책은 수시로 바뀝니다.</p>
    </>
  );
}
