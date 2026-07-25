import localFont from 'next/font/local';

/**
 * Paperlogy — 앱 기본 폰트 (self-host, 외부 CDN 의존 없음).
 * 앱의 모든 텍스트에 사용한다. 커버하지 못하는 글리프는 Pretendard로 폴백한다.
 */
export const paperlogy = localFont({
  src: [
    { path: './fonts/Paperlogy-4Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Paperlogy-6SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Paperlogy-7Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/Paperlogy-8ExtraBold.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-paperlogy',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Malgun Gothic', 'system-ui', 'sans-serif'],
});

/**
 * Pretendard 가변 폰트 self-host — Paperlogy 미커버 글리프의 폴백.
 */
export const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  style: 'normal',
  variable: '--font-pretendard',
  preload: true,
  fallback: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Apple SD Gothic Neo',
    'Malgun Gothic',
    'system-ui',
    'sans-serif',
  ],
});
