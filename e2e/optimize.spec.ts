import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('siljeokon.entered', '1');
    } catch {
      /* ignore */
    }
  });
});

/**
 * 시나리오 3 — 최적화.
 * 카드 두 장을 템플릿으로 등록하고, 한 장을 최고 구간 위로 밀어 넣으면
 * 최적화 화면이 대체 카드로 옮기라는 구체적 조치를 제시한다.
 */
test('최적화: 초과 카드에 대체 카드 조치가 나타난다', async ({ page }) => {
  await page.goto('/');

  // 카드1: 3구간형(신한, 최고 100만)
  await page.getByRole('button', { name: '템플릿에서 카드 추가' }).click();
  await page.getByRole('button', { name: /3구간형/ }).click();
  await expect(page.getByRole('heading', { name: '내 카드' })).toBeVisible();

  // 카드2: 2구간형(KB) — 대체(미달) 카드
  await page.getByRole('button', { name: '템플릿에서 고르기' }).click();
  await page.getByRole('button', { name: /2구간형/ }).click();
  await expect(page.getByText('2구간형 (40/70만)')).toBeVisible();

  // 신한 카드를 최고 구간(100만) 위로 밀어 넣는 결제 문자(날짜 없음 → 이번 주기)
  await page.getByRole('button', { name: '문자분석' }).click();
  await page.getByPlaceholder(/결제 문자를 붙여넣으세요/).fill('신한카드(1234) 승인 1,200,000원 일시불 스타벅스');
  await page.getByRole('button', { name: '분석해서 저장' }).click();
  await expect(page.getByText(/1건 저장/)).toBeVisible();

  // 최적화 화면
  await page.getByRole('button', { name: '최적화', exact: true }).click();
  await expect(page.getByText('이번 주기 조치로 얻을 수 있는 금액')).toBeVisible();
  await expect(page.getByText(/최고 구간 달성, 지금부터는 손해/)).toBeVisible();
  await expect(page.getByText('옮기세요')).toBeVisible();

  // 대체 카드사 앱 열기 CTA
  await expect(page.getByRole('button', { name: /여기로 옮기기/ })).toBeVisible();
  await expect(page.getByText('업종별로 꺼낼 카드')).toBeVisible();
});
