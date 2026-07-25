import type { IssuerKey } from '@/types';

/**
 * 카드사 앱카드 딥링크. (v1.1 절충안)
 *
 * 실적ON은 결제 수단이 아니다. "이 카드로 결제하세요" 추천을 강화하되, 실제 결제·카드정보는
 * 카드사 공식 앱(앱카드)이 처리한다. 우리는 전체 카드번호(PAN)를 만들지도 저장하지도 않는다.
 * 여기서 하는 일은 오직: 추천 카드의 카드사 앱을 열어주는 것(설치돼 있으면 앱, 없으면 스토어).
 *
 * 원칙(숫자를 단정하지 않는다)을 딥링크에도 적용한다:
 * - androidPackage 는 best-effort 이며, 틀리거나 미설치여도 **스토어 검색으로 안전하게 폴백**한다.
 * - iOS/데스크톱은 스토어/웹 검색(항상 유효한 URL)으로 연다.
 * - 데이터(ISSUER_APPS)만 고치면 동작이 바뀐다.
 */
export interface IssuerApp {
  /** 소비자용 카드사 페이 앱 이름 */
  appName: string;
  /** Android 패키지명(best-effort). 열기 실패 시 스토어 검색으로 폴백 */
  androidPackage?: string;
  /** 스토어 검색어 — 항상 유효한 폴백 */
  storeTerm: string;
}

// ⚠️ androidPackage 는 확인 필요값이다. 틀려도 스토어 검색으로 폴백하므로 앱은 안전하게 동작한다.
export const ISSUER_APPS: Record<IssuerKey, IssuerApp> = {
  shinhan: { appName: '신한SOL페이', androidPackage: 'com.shcard.smartpay', storeTerm: '신한 SOL페이' },
  kb: { appName: 'KB Pay', androidPackage: 'com.kbcard.cxh.appcard', storeTerm: 'KB Pay' },
  samsung: { appName: '삼성카드', androidPackage: 'kr.co.samsungcard.mpocket', storeTerm: '삼성카드' },
  hyundai: { appName: '현대카드', androidPackage: 'com.hyundaicard.hyundaicardmobile', storeTerm: '현대카드' },
  lotte: { appName: '롯데카드(디지로카)', androidPackage: 'com.lcacApp', storeTerm: '롯데카드 디지로카' },
  woori: { appName: '우리WON카드', androidPackage: 'com.wooricard.smartapp', storeTerm: '우리WON카드' },
  hana: { appName: '하나카드', androidPackage: 'com.hanaskcard.paycla', storeTerm: '하나카드 원큐페이' },
  nh: { appName: 'NH올원페이', storeTerm: 'NH올원페이' },
  bc: { appName: '페이북(BC카드)', androidPackage: 'com.tmoney.paybook', storeTerm: '페이북 BC카드' },
  ibk: { appName: 'i-ONE뱅크', storeTerm: 'IBK 아이원카드' },
  kakao: { appName: '카카오페이', androidPackage: 'com.kakao.talk', storeTerm: '카카오페이' },
  toss: { appName: '토스', androidPackage: 'viva.republica.toss', storeTerm: '토스' },
  etc: { appName: '카드사 앱', storeTerm: '카드' },
};

export type OpenPlatform = 'android' | 'ios' | 'other';

export function detectPlatform(ua: string): OpenPlatform {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

export function playSearchUrl(term: string): string {
  return `https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps`;
}

export function appStoreSearchUrl(term: string): string {
  return `https://apps.apple.com/kr/search?term=${encodeURIComponent(term)}`;
}

/** 설치돼 있으면 앱을 열고, 없으면 fallbackUrl 로 이동하는 Android intent URL. */
export function androidIntentUrl(pkg: string, fallbackUrl: string): string {
  return `intent://#Intent;package=${pkg};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

export interface OpenTarget {
  url: string;
  /** 새 탭으로 여는 것이 자연스러운 외부 링크인지(데스크톱) */
  newTab: boolean;
}

/**
 * 플랫폼별로 어떤 URL로 이동할지 결정한다. 순수 함수(테스트 가능).
 * 결제 데이터는 전혀 실리지 않는다 — 카드사명/앱명만 사용한다.
 */
export function resolveOpenTarget(issuer: IssuerKey, platform: OpenPlatform): OpenTarget {
  const app = ISSUER_APPS[issuer] ?? ISSUER_APPS.etc;
  if (platform === 'android') {
    const fallback = playSearchUrl(app.storeTerm);
    return { url: app.androidPackage ? androidIntentUrl(app.androidPackage, fallback) : fallback, newTab: false };
  }
  if (platform === 'ios') {
    return { url: appStoreSearchUrl(app.storeTerm), newTab: false };
  }
  return { url: playSearchUrl(app.storeTerm), newTab: true };
}

/** 실제로 카드사 앱(또는 스토어)을 연다. 부수효과 O. 클라이언트에서만 호출. */
export function openIssuerApp(issuer: IssuerKey): void {
  if (typeof window === 'undefined') return;
  const target = resolveOpenTarget(issuer, detectPlatform(navigator.userAgent));
  if (target.newTab) window.open(target.url, '_blank', 'noopener,noreferrer');
  else window.location.href = target.url;
}
