import type { Metadata, Viewport } from 'next';
import { pretendard, paperlogy } from './fonts';
import './globals.css';

// 정적 셸. 결제 데이터가 IndexedDB에만 있으므로 서버에서 렌더할 데이터가 없다.
export const metadata: Metadata = {
  title: '실적ON — 신용카드 실적 관리',
  description:
    '카드 결제 문자를 읽어 실적을 추적하고, 구간을 넘긴 순간 다른 카드로 갈아타게 해주는 기기 내 처리 웹앱',
  applicationName: '실적ON',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '실적ON',
  },
  formatDetection: { telephone: false },
  other: { 'mobile-web-app-capable': 'yes' },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#101B2D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${paperlogy.variable} ${pretendard.variable}`}>
      <body>{children}</body>
    </html>
  );
}
