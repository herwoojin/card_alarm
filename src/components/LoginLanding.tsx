'use client';

import { useState } from 'react';
import { ShaderBackground } from '@/components/ui/shader-background';
import { useCloudStore } from '@/store/useCloudStore';

const ENTERED_KEY = 'siljeokon.entered';

/** 첫 진입 화면. 구글 로그인(선택)으로 클라우드 백업을 켜거나, 로그인 없이 로컬로 시작한다. */
export function LoginLanding({ onEnter }: { onEnter: () => void }) {
  const cloud = useCloudStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const markEntered = () => {
    try {
      localStorage.setItem(ENTERED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const google = async () => {
    setErr('');
    setBusy(true);
    try {
      await cloud.signIn();
      markEntered();
      onEnter();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    markEntered();
    onEnter();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 20px calc(24px + env(safe-area-inset-bottom,0px))',
        overflow: 'auto',
      }}
    >
      <ShaderBackground />

      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'rgba(16,27,45,0.55)',
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 22,
          padding: '30px 24px 26px',
          color: '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--hl)', boxShadow: '0 0 0 4px rgba(242,225,75,.25)' }} />
          <b style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.04em' }}>실적ON</b>
        </div>

        <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1.25, margin: '0 0 10px' }}>
          카드 실적, 넘치기 전에
          <br />한 장으로 알려드려요
        </h1>
        <p style={{ fontSize: 13.5, color: '#C6CFDE', lineHeight: 1.6, margin: '0 0 22px' }}>
          로그인하면 내 구글 계정 전용 저장소에 백업돼요. 로그인은 선택이고, 로그인 전에는 아무 정보도 서버로 보내지 않습니다.
        </p>

        {cloud.available ? (
          <button
            type="button"
            onClick={google}
            disabled={busy}
            style={{
              width: '100%',
              minHeight: 50,
              border: 0,
              borderRadius: 12,
              background: '#fff',
              color: '#1f1f1f',
              fontWeight: 700,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            <GoogleG />
            {busy ? '로그인 중…' : 'Google로 계속하기'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={skip}
          style={{
            width: '100%',
            minHeight: 48,
            marginTop: 10,
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 12,
            background: 'transparent',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14.5,
            cursor: 'pointer',
          }}
        >
          로그인 없이 시작 · 이 기기에만 저장
        </button>

        {err ? <p style={{ fontSize: 12, color: '#FFB4A6', marginTop: 12, marginBottom: 0 }}>{err}</p> : null}

        <p style={{ fontSize: 11, color: '#8FA0BA', lineHeight: 1.6, marginTop: 18, marginBottom: 0 }}>
          카드번호 전체·CVC·비밀번호는 어떤 경우에도 저장하지 않습니다. 결제 실적은 결제 문자로만 계산합니다.
        </p>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
