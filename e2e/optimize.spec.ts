import { test, expect } from '@playwright/test';

/**
 * 시나리오 3 — 최적화.
 * 샘플 데이터에는 최고 구간을 넘긴 카드가 있어, 최적화 화면이
 * 대체 카드명과 필요액이 담긴 구체적 조치를 제시한다.
 */
test('최적화: 초과 카드에 대체 카드 조치가 나타난다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '샘플 데이터로 둘러보기' }).click();
  await expect(page.getByText('지금 이 카드로')).toBeVisible(); // 샘플 로드 확인

  await page.getByRole('button', { name: '최적화' }).click();

  // 상단 요약
  await expect(page.getByText('이번 주기 조치로 얻을 수 있는 금액')).toBeVisible();

  // 초과 조치 — 신한 생활카드가 최고 구간을 넘겨 대체 카드로 옮기라고 안내
  await expect(page.getByText('신한 생활카드 — 최고 구간 달성, 지금부터는 손해')).toBeVisible();
  await expect(page.getByText('옮기세요')).toBeVisible();

  // 초과 조치에 "여기로 옮기기"(대체 카드사 앱 열기) CTA가 붙는다
  await expect(page.getByRole('button', { name: /여기로 옮기기/ })).toBeVisible();

  // 업종별로 꺼낼 카드 표
  await expect(page.getByText('업종별로 꺼낼 카드')).toBeVisible();
});
