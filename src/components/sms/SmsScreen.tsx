'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useUI } from '@/components/ui/ui-context';
import { Toggle } from '@/components/ui/Toggle';
import { TxnRow } from '@/components/TxnRow';

export function SmsScreen() {
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const unrecognized = useAppStore((s) => s.unrecognized);
  const transactions = useAppStore((s) => s.transactions);
  const cards = useAppStore((s) => s.cards);
  const setSetting = useAppStore((s) => s.setSetting);
  const ingest = useAppStore((s) => s.ingest);
  const dropUnrecognized = useAppStore((s) => s.dropUnrecognized);
  const ui = useUI();

  const [input, setInput] = useState('');

  const accuracy = stats.total ? Math.round((stats.ok / stats.total) * 100) : 0;

  const recentTxns = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 40),
    [transactions],
  );

  const doIngest = async () => {
    if (!input.trim()) {
      ui.toast('분석할 문자를 넣어주세요');
      return;
    }
    const r = await ingest(input);
    setInput('');
    ui.toast(`${r.ok}건 저장${r.fail ? ` · ${r.fail}건 미인식` : ''}${r.dup ? ` · ${r.dup}건 중복` : ''}`);
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) {
        ui.toast('클립보드가 비어 있습니다');
        return;
      }
      setInput(t);
      ui.toast('붙여넣었습니다. 내용을 확인하고 저장하세요');
    } catch {
      ui.toast('브라우저가 클립보드 접근을 막았습니다. 직접 붙여넣어 주세요');
    }
  };

  return (
    <>
      <h1 className="view-title">문자분석</h1>
      <p className="view-sub">결제 문자를 읽어 카드·금액·가맹점·할부를 뽑아냅니다.</p>

      <div className="box">
        <div className="sw">
          <div>
            <div className="t">공유 시트로 받기</div>
            <div className="d">문자 앱에서 공유 → 실적ON을 선택하면 자동으로 분석합니다. 홈 화면에 설치하면 켜집니다.</div>
          </div>
          <Toggle checked={settings.share} onChange={(v) => setSetting('share', v)} label="공유 시트로 받기" />
        </div>
        <div className="sw">
          <div>
            <div className="t">붙여넣기 자동 감지</div>
            <div className="d">앱으로 돌아올 때 클립보드에 결제 문자가 있으면 바로 물어봅니다.</div>
          </div>
          <Toggle
            checked={settings.clipboard}
            onChange={(v) => {
              void setSetting('clipboard', v);
              if (v) ui.toast('앱으로 돌아올 때 클립보드를 확인합니다');
            }}
            label="붙여넣기 자동 감지"
          />
        </div>
        <div className="sw">
          <div>
            <div className="t">중복 결제 건너뛰기</div>
            <div className="d">같은 카드·금액·시각이 이미 있으면 저장하지 않습니다.</div>
          </div>
          <Toggle checked={settings.dedupe} onChange={(v) => setSetting('dedupe', v)} label="중복 결제 건너뛰기" />
        </div>
      </div>

      <div className="sec">분석 현황</div>
      <div className="box">
        <div className="g3" style={{ textAlign: 'center' }}>
          <div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</div>
            <div className="d" style={{ fontSize: 11, color: 'var(--mute)' }}>분석 시도</div>
          </div>
          <div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{stats.ok}</div>
            <div className="d" style={{ fontSize: 11, color: 'var(--mute)' }}>인식 성공</div>
          </div>
          <div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{accuracy}%</div>
            <div className="d" style={{ fontSize: 11, color: 'var(--mute)' }}>정확도</div>
          </div>
        </div>
      </div>

      <div className="sec">문자 넣기</div>
      <div className="box">
        <textarea
          className="i"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'결제 문자를 붙여넣으세요. 여러 건은 빈 줄로 구분하면 한 번에 처리합니다.\n\n예)\n[Web발신]\n신한카드(1234)승인 홍*동\n12,000원 일시불\n07/24 14:23 스타벅스 강남점\n누적 742,300원'}
        />
        <div className="btnrow">
          <button className="btn" onClick={doIngest}>분석해서 저장</button>
          <button className="btn ghost sm" style={{ flex: 'none' }} onClick={paste}>붙여넣기</button>
        </div>
      </div>

      <div className="sec">
        미인식 문자{' '}
        <span className="num" style={{ fontWeight: 700, color: 'var(--warn)' }}>
          {unrecognized.length ? `${unrecognized.length}건` : ''}
        </span>
      </div>
      {unrecognized.length ? (
        unrecognized.map((u) => (
          <div className="box" style={{ marginBottom: 9 }} key={u.id}>
            <div style={{ fontSize: 11.5, color: 'var(--warn)', fontWeight: 700, marginBottom: 6 }}>{u.reason}</div>
            <div className="num" style={{ fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {u.raw.slice(0, 180)}
            </div>
            <div className="btnrow">
              <button className="btn ghost sm" onClick={() => ui.openSheet({ kind: 'manual', unrecId: u.id })}>직접 입력</button>
              <button className="btn ghost sm" onClick={() => void dropUnrecognized(u.id)}>삭제</button>
            </div>
          </div>
        ))
      ) : (
        <div className="box">
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>인식하지 못한 문자가 없습니다.</div>
        </div>
      )}

      <div className="sec">거래 내역</div>
      <div className="box">
        {recentTxns.length ? (
          recentTxns.map((t) => <TxnRow key={t.id} txn={t} cards={cards} onClick={() => ui.openSheet({ kind: 'txn', txnId: t.id })} />)
        ) : (
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>저장된 거래가 없습니다.</div>
        )}
      </div>
    </>
  );
}
