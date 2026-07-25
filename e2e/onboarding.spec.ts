import { test, expect } from '@playwright/test';

/**
 * 시나리오 1 — 온보딩.
 * 카드 0장 상태에서 [샘플 데이터로 둘러보기] 한 번으로 가치를 즉시 보여준다.
 * (PLAN 나가는 문: "카드 0장에서 샘플 데이터로 30초 안에 가치를 보여준다")
 */
test('온보딩: 샘플 데이터로 첫 화면이 채워진다', async ({ page }) => {
  await page.goto('/');

  // 빈 상태 — 등록 유도 문구와 두 버튼
  await expect(page.getByText('카드를 등록하면')).toBeVisible();
  const sampleBtn = page.getByRole('button', { name: '샘플 데이터로 둘러보기' });
  await expect(sampleBtn).toBeVisible();

  await sampleBtn.click();

  // 히어로(오늘 이 카드) + 카드 게이지 3장이 나타난다 (게이지는 고유 aria-label로 지정)
  await expect(page.getByText('지금 이 카드로')).toBeVisible();
  await expect(page.getByRole('button', { name: /신한 생활카드 실적/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /KB 쇼핑카드 실적/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /현대 주유카드 실적/ })).toBeVisible();

  // 최근 결제 목록도 채워진다
  await expect(page.getByText('최근 결제')).toBeVisible();

  // 결제 직전 추천 CTA(카드사 앱 열기) + 개인정보 고지
  await expect(page.getByRole('button', { name: /이 카드로 결제/ })).toBeVisible();
  await expect(page.getByText('실적ON은 카드번호를 저장하지 않습니다')).toBeVisible();
});
