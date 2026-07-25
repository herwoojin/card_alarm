'use client';

import { useEffect, useState } from 'react';
import { useCloudStore } from '@/store/useCloudStore';
import { useAppStore } from '@/store/useAppStore';
import { useUI } from '@/components/ui/ui-context';
import { Toggle } from '@/components/ui/Toggle';

function fmtWhen(ts: number | null): string {
  if (!ts) return '없음';
  const d = new Date(ts);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** 설정 시트의 클라우드(구글 로그인 + Firebase Storage 백업) 섹션. 완전 옵트인. */
export function CloudSection() {
  const cloud = useCloudStore();
  const autoBackup = useAppStore((s) => s.settings.cloudAutoBackup);
  const setSetting = useAppStore((s) => s.setSetting);
  const ui = useUI();

  const [pass, setPass] = useState('');
  const [encrypt, setEncrypt] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = cloud.inboxToken ? `${origin}/.netlify/functions/ingest?token=${cloud.inboxToken}&text=` : '';
  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      ui.toast('웹훅 주소를 복사했습니다');
    } catch {
      ui.toast('복사 실패 — 주소를 길게 눌러 복사하세요');
    }
  };

  useEffect(() => {
    void cloud.init();
  }, [cloud]);

  if (!cloud.available) {
    return (
      <>
        <div className="sec">클라우드 백업</div>
        <p className="note">
          Firebase가 설정되지 않아 클라우드 동기화가 꺼져 있습니다. 지금은 모든 데이터가 이 기기에만 저장됩니다.
        </p>
      </>
    );
  }

  const signIn = async () => {
    try {
      await cloud.signIn();
      ui.toast('로그인했습니다');
    } catch (e) {
      ui.toast(e instanceof Error ? `로그인 실패: ${e.message}` : '로그인에 실패했습니다');
    }
  };

  const backup = async () => {
    if (encrypt && !pass) {
      ui.toast('암호화하려면 비밀번호를 입력하세요');
      return;
    }
    try {
      await cloud.backupNow(encrypt ? pass : undefined);
      ui.toast(encrypt ? '암호화해서 클라우드에 백업했습니다' : '클라우드에 백업했습니다');
    } catch (e) {
      ui.toast(e instanceof Error ? `백업 실패: ${e.message}` : '백업에 실패했습니다');
    }
  };

  const restore = async (mode: 'merge' | 'overwrite') => {
    try {
      const r = await cloud.restore(mode, pass || undefined);
      ui.toast(`복원 완료 · 카드 ${r.cards}장 · 거래 ${r.transactions}건${r.skippedDuplicates ? ` · 중복 ${r.skippedDuplicates} 건너뜀` : ''}`);
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : '복원에 실패했습니다');
    }
  };

  return (
    <>
      <div className="sec">클라우드 백업 (구글)</div>

      {!cloud.user ? (
        <>
          <button className="btn" onClick={signIn} disabled={cloud.busy}>
            구글로 로그인
          </button>
          <p className="note">
            로그인하면 이 기기의 데이터를 <b>내 구글 계정 전용 저장소</b>에 백업할 수 있어, 브라우저 데이터를 지워도 복구됩니다.
            로그인은 선택이며, 로그인 전에는 아무 정보도 서버로 보내지 않습니다.
          </p>
        </>
      ) : (
        <>
          <div className="box" style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center' }}>👤</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cloud.user.displayName || '로그인됨'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cloud.user.email}</div>
              </div>
              <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => void cloud.signOut()} disabled={cloud.busy}>
                로그아웃
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 9 }}>마지막 클라우드 백업 · {fmtWhen(cloud.lastCloudBackupAt)}</div>
          </div>

          <label className="f" style={{ marginBottom: 8 }}>
            <span>비밀번호 (선택 · 암호화/복원용)</span>
            <input className="i" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="비밀번호를 입력하면 서버도 내용을 못 봅니다" autoComplete="off" />
          </label>
          <div className="sw" style={{ borderBottom: 0, paddingTop: 4 }}>
            <div><div className="t">비밀번호로 암호화</div><div className="d">켜면 업로드 전에 이 기기에서 암호화합니다. 비밀번호를 잊으면 복구할 수 없습니다.</div></div>
            <Toggle checked={encrypt} onChange={setEncrypt} label="비밀번호로 암호화" />
          </div>

          <div className="btnrow">
            <button className="btn" onClick={backup} disabled={cloud.busy}>클라우드에 백업</button>
          </div>
          <div className="btnrow">
            <button className="btn ghost sm" onClick={() => void restore('merge')} disabled={cloud.busy}>복원(병합)</button>
            <button className="btn ghost sm" onClick={() => void restore('overwrite')} disabled={cloud.busy}>복원(덮어쓰기)</button>
          </div>

          <div className="sw" style={{ marginTop: 4 }}>
            <div><div className="t">자동 백업</div><div className="d">데이터가 바뀌면 잠시 뒤 자동으로 클라우드에 올립니다. (비밀번호를 입력해 두면 암호화해서 올립니다)</div></div>
            <Toggle checked={autoBackup} onChange={(v) => void setSetting('cloudAutoBackup', v)} label="자동 백업" />
          </div>

          <div className="sec">문자 자동 수신 (웹훅 · 무료)</div>
          {cloud.inboxAvailable && webhookUrl ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                폰 자동화(단축어/MacroDroid)나 Make·Zapier·n8n가 문자 도착 시 아래 주소를 열게 하세요. 앱이 닫혀 있어도 다음에 열 때 자동으로 저장됩니다. <b>[문자내용]</b> 자리에 받은 문자를 넣습니다.
              </p>
              <div className="num" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', fontSize: 11.5, wordBreak: 'break-all', color: 'var(--ink-2)' }}>
                {webhookUrl}[문자내용]
              </div>
              <div className="btnrow">
                <button className="btn ghost sm" onClick={copyWebhook}>웹훅 주소 복사</button>
                <a className="btn ghost sm" href="/guide#auto" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>설정 방법</a>
              </div>
              <p className="note">이 주소에는 개인 토큰이 들어 있습니다. 남에게 공유하지 마세요(내 계정 수신함에만 저장됩니다).</p>
            </>
          ) : (
            <p className="note" style={{ marginTop: 0 }}>
              실시간 클라우드 수신함(앱이 닫혀 있어도 받기)을 쓰려면 Realtime Database 설정이 필요합니다. `FIREBASE_SETUP.md`의 “문자 자동 수신함” 단계를 참고하세요. 그 전에도 설정의 “문자 자동 수집(앱 열기)”은 바로 됩니다.
            </p>
          )}
        </>
      )}
    </>
  );
}
