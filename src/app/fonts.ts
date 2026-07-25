import localFont from 'next/font/local';

/**
 * Pretendard 가변 폰트 self-host. (외부 CDN 의존 없음 — 기기 내 처리 원칙)
 * 빌드 시 프로젝트에 포함된 woff2를 next/font가 최적화·프리로드한다.
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
