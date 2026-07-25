'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useRange, useDaysLeft } from '@/store/derived';
import { parseSMS } from '@/lib/parser';
import { readSharedText, clearShareQuery } from '@/lib/share/shareTarget';
import { readClipboardOnce } from '@/lib/share/clipboard';
import { UIContext, type SheetState, type TabKey, type UIApi } from '@/components/ui/ui-context';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { CardsScreen } from '@/components/cards/CardsScreen';
import { SmsScreen } from '@/components/sms/SmsScreen';
import { OptimizeScreen } from '@/components/optimize/OptimizeScreen';
import { StatsScreen } from '@/components/stats/StatsScreen';
import { CardEditorSheet } from '@/components/cards/CardEditorSheet';
import { PresetPickerSheet } from '@/components/cards/PresetPickerSheet';
import { ManualSheet } from '@/components/sms/ManualSheet';
import { TxnEditorSheet } from '@/components/sms/TxnEditorSheet';
import { SettingsSheet } from '@/components/settings/SettingsSheet';

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'home', icon: '📊', label: '대시보드' },
  { key: 'cards', icon: '💳', label: '내 카드' },
  { key: 'sms', icon: '📩', label: '문자분석' },
  { key: 'opt', icon: '🎯', label: '최적화' },
  { key: 'stats', icon: '📈', label: '분석' },
];

function CycleLabel() {
  const range = useRange();
  const left = useDaysLeft();
  const s = range.start;
  const e = new Date(range.end.getTime() - 1);
  return (
    <div className="cycle">
      {s.getMonth() + 1}/{s.getDate()} ~ {e.getMonth() + 1}/{e.getDate()} · D-{left}
    </div>
  );
}

export default function Home() {
  const init = useAppStore((s) => s.init);
  const ingest = useAppStore((s) => s.ingest);
  const settingsClipboard = useAppStore((s) => s.settings.clipboard);
  const settingsShare = useAppStore((s) => s.settings.share);

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabKey>('home');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400);
  }, []);

  const go = useCallback((t: TabKey) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  }, []);

  const api: UIApi = {
    tab,
    go,
    toast,
    openSheet: (s) => setSheet(s),
    closeSheet: () => setSheet(null),
  };

  // 부팅: 정리 작업 + 데이터 로드 → SW 등록 → 공유 진입 처리
  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    (async () => {
      await init();
      if (cancelled) return;

      // 공유 시트 진입: ?text= 를 읽어 저장하고 쿼리를 즉시 제거
      const shared = readSharedText();
      if (shared && useAppStore.getState().settings.share) {
        const r = await ingest(shared);
        go('sms');
        toast(r.ok ? `공유받은 문자 ${r.ok}건을 저장했습니다` : '공유받은 문자를 인식하지 못했습니다');
        clearShareQuery();
      }
    })();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 클립보드 자동 감지: 설정이 켜져 있고 탭이 다시 보일 때만
  useEffect(() => {
    if (!settingsClipboard) return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const t = await readClipboardOnce();
      if (!t) return;
      if (parseSMS(t).ok && window.confirm('클립보드에서 결제 문자를 찾았습니다. 저장할까요?')) {
        const r = await ingest(t);
        toast(`${r.ok}건 저장${r.fail ? ` · ${r.fail}건 미인식` : ''}${r.dup ? ` · ${r.dup}건 중복` : ''}`);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [settingsClipboard, ingest, toast]);

  return (
    <UIContext.Provider value={api}>
      <header className="topbar">
        <div className="wrap">
          <div className="brand">
            <span className="dot" aria-hidden="true" />
            실적ON
          </div>
          {mounted ? <CycleLabel /> : <div className="cycle">—</div>}
          <button
            className="btn ghost sm"
            style={{ marginLeft: 8, minHeight: 34, padding: '6px 10px' }}
            onClick={() => setSheet({ kind: 'settings' })}
            aria-label="설정"
          >
            설정
          </button>
        </div>
      </header>

      <main className="wrap">
        {!mounted ? (
          <div className="empty" style={{ paddingTop: 80 }}>
            <p>불러오는 중…</p>
          </div>
        ) : tab === 'home' ? (
          <Dashboard />
        ) : tab === 'cards' ? (
          <CardsScreen />
        ) : tab === 'sms' ? (
          <SmsScreen />
        ) : tab === 'opt' ? (
          <OptimizeScreen />
        ) : (
          <StatsScreen />
        )}
      </main>

      <nav className="tabbar" aria-label="화면 전환">
        <div className="wrap">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} aria-current={tab === t.key} onClick={() => go(t.key)}>
              <em aria-hidden="true">{t.icon}</em>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {sheet ? (
        <div className="sheet" role="dialog" aria-modal="true">
          <button className="bg" aria-label="닫기" onClick={() => setSheet(null)} />
          <div className="panel">
            <div className="grab" aria-hidden="true" />
            {sheet.kind === 'card' ? (
              <CardEditorSheet cardId={sheet.cardId} />
            ) : sheet.kind === 'presets' ? (
              <PresetPickerSheet />
            ) : sheet.kind === 'manual' ? (
              <ManualSheet unrecId={sheet.unrecId} />
            ) : sheet.kind === 'txn' ? (
              <TxnEditorSheet txnId={sheet.txnId} />
            ) : (
              <SettingsSheet />
            )}
          </div>
        </div>
      ) : null}

      <div className={`toast${toastMsg ? ' on' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </UIContext.Provider>
  );
}
