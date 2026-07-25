'use client';

import { AuroraBorealisShader } from '@/components/ui/aurora-borealis-shader';

/**
 * 로그인 화면을 제외한 모든 페이지의 공용 배경 — 오로라(three.js) + 가독성 스크림.
 * 스크림은 콘텐츠 뒤·오로라 앞에 깔려, 오로라가 보이면서도 텍스트가 읽히게 한다.
 */
export function AppBackground({ opacity = 1 }: { opacity?: number }) {
  return (
    <>
      <AuroraBorealisShader opacity={opacity} />
      <div className="app-scrim" aria-hidden="true" />
    </>
  );
}
