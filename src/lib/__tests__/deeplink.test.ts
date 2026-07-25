import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  resolveOpenTarget,
  playSearchUrl,
  appStoreSearchUrl,
  androidIntentUrl,
  ISSUER_APPS,
} from '../deeplink';

describe('deeplink — 플랫폼 판별', () => {
  it('Android UA', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; SM-S911N)')).toBe('android');
  });
  it('iOS UA', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
  });
  it('데스크톱 UA', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('other');
  });
});

describe('deeplink — URL 빌더', () => {
  it('Play 스토어 검색 URL', () => {
    expect(playSearchUrl('신한 SOL페이')).toBe('https://play.google.com/store/search?q=%EC%8B%A0%ED%95%9C%20SOL%ED%8E%98%EC%9D%B4&c=apps');
  });
  it('App Store 검색 URL', () => {
    expect(appStoreSearchUrl('KB Pay')).toBe('https://apps.apple.com/kr/search?term=KB%20Pay');
  });
  it('Android intent URL은 fallback을 포함한다', () => {
    const url = androidIntentUrl('com.shcard.smartpay', 'https://play.google.com/x');
    expect(url).toContain('package=com.shcard.smartpay');
    expect(url).toContain('S.browser_fallback_url=');
    expect(url.startsWith('intent://')).toBe(true);
  });
});

describe('deeplink — resolveOpenTarget (순수, 결제정보 없음)', () => {
  it('Android + 패키지 있음 → intent URL', () => {
    const t = resolveOpenTarget('shinhan', 'android');
    expect(t.url.startsWith('intent://')).toBe(true);
    expect(t.url).toContain('com.shcard.smartpay');
    // 실패 시 스토어 검색으로 폴백하도록 fallback_url 포함
    expect(t.url).toContain('play.google.com');
  });

  it('Android + 패키지 없음 → 스토어 검색으로 폴백', () => {
    // nh는 androidPackage가 없다
    expect(ISSUER_APPS.nh.androidPackage).toBeUndefined();
    const t = resolveOpenTarget('nh', 'android');
    expect(t.url.startsWith('https://play.google.com/store/search')).toBe(true);
  });

  it('iOS → App Store 검색', () => {
    const t = resolveOpenTarget('kb', 'ios');
    expect(t.url.startsWith('https://apps.apple.com/kr/search')).toBe(true);
  });

  it('데스크톱 → 새 탭', () => {
    const t = resolveOpenTarget('samsung', 'other');
    expect(t.newTab).toBe(true);
    expect(t.url).toContain('play.google.com');
  });

  it('URL에 카드번호 등 결제정보가 실리지 않는다', () => {
    for (const p of ['android', 'ios', 'other'] as const) {
      const t = resolveOpenTarget('hyundai', p);
      expect(t.url).not.toMatch(/\d{8,}/); // 8자리 이상 연속 숫자(카드번호류) 없음
    }
  });
});
