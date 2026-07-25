'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useCloudStore } from '@/store/useCloudStore';
import { useRange, useDaysLeft } from '@/store/derived';
import { parseSMS } from '@/lib/parser';
import { readSharedText, clearShareQuery } from '@/lib/share/shareTarget';
import { readClipboardOnce } from '@/lib/share/clipboard';
import { UIContext, type SheetState, type TabKey, type UIApi } from '@/components/ui/ui-context';
import { LoginLanding } from '@/components/LoginLanding';
import { AuroraBorealisShader } from '@/components/ui/aurora-borealis-shader';
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
  const cloudInit = useCloudStore((s) => s.init);
  const cloudUser = useCloudStore((s) => s.user);

  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
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

  // 부팅: 데이터 로드 + 클라우드 세션 복원 + 진입 여부 + 공유 처리
  useEffect(() => {
    let enteredFlag = false;
    try {
      enteredFlag = localStorage.getItem('siljeokon.entered') === '1';
    } catch {
      /* ignore */
    }
    setEntered(enteredFlag);
    setMounted(true);

    let cancelled = false;
    (async () => {
      await init();
      await cloudInit();
      if (cancelled) return;

      const shared = readSharedText();
      if (shared && useAppStore.getState().settings.share) {
        // 공유로 들어오면 로그인 화면을 건너뛰고 바로 처리
        setEntered(true);
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

  // 클립보드 자동 감지
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

  // 클라우드 자동 백업 — 로그인 + 설정 ON일 때 데이터 변경을 디바운스해 업로드
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.transactions === prev.transactions && state.cards === prev.cards) return;
      if (!state.settings.cloudAutoBackup) return;
      if (!useCloudStore.getState().user) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        useCloudStore.getState().backupNow().catch(() => {});
      }, 4000);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  if (mounted && !entered && !cloudUser) {
    return (
      <UIContext.Provider value={api}>
        <LoginLanding onEnter={() => setEntered(true)} />
      </UIContext.Provider>
    );
  }

  return (
    <UIContext.Provider value={api}>
      {mounted ? <AuroraBorealisShader opacity={1} /> : null}
      <div className="app-scrim" aria-hidden="true" />

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
