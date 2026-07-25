'use client';

import type { IssuerKey } from '@/types';
import { ISSUER_APPS, openIssuerApp } from '@/lib/deeplink';

interface PayCtaProps {
  issuer: IssuerKey;
  /** 버튼 스타일 클래스(기본 'hl'). 'sm'을 붙이면 작은 버튼 */
  variant?: string;
  /** 라벨 접두 문구. 기본 "이 카드로 결제" */
  prefix?: string;
}

/**
 * "결제 직전 추천" CTA — 추천 카드의 카드사 앱(앱카드)을 연다.
 * 결제·카드정보는 카드사 앱이 처리하며, 실적ON은 카드번호를 만들지도 저장하지도 않는다.
 */
export function PayCta({ issuer, variant = 'hl', prefix = '이 카드로 결제' }: PayCtaProps) {
  const app = ISSUER_APPS[issuer] ?? ISSUER_APPS.etc;
  return (
    <button
      type="button"
      className={`btn ${variant}`}
      onClick={() => openIssuerApp(issuer)}
      aria-label={`${prefix} — ${app.appName} 열기`}
    >
      {prefix} · {app.appName} 열기
    </button>
  );
}
