import { test, expect } from '@playwright/test';

// 로그인 랜딩을 건너뛰고 바로 앱으로 진입
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
 * 시나리오 1 — 온보딩(템플릿 기반).
 * 카드 0장 상태에서 템플릿으로 첫 카드를 등록하고, 사용법 안내가 노출된다.
 */
test('온보딩: 템플릿으로 첫 카드를 등록한다', async ({ page }) => {
  await page.goto('/');

  // 빈 상태 — 등록 유도 + 사용법 링크
  await expect(page.getByText('카드를 등록하면')).toBeVisible();
  await expect(page.getByRole('link', { name: /아주 쉽게 보는 사용법/ })).toBeVisible();

  // 템플릿에서 카드 추가 → 3구간형 선택
  await page.getByRole('button', { name: '템플릿에서 카드 추가' }).click();
  await expect(page.getByText('템플릿에서 고르기')).toBeVisible();
  await page.getByRole('button', { name: /3구간형/ }).click();

  // 내 카드 화면으로 이동하고 카드가 등록됨
  await expect(page.getByRole('heading', { name: '내 카드' })).toBeVisible();
  await expect(page.getByText('3구간형 (30/50/100만)')).toBeVisible();
});

test('가이드 페이지가 열린다', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: '아주 쉽게 보는 사용법' })).toBeVisible();
  await expect(page.getByText('내 카드 등록하기')).toBeVisible();
  await expect(page.getByRole('link', { name: '실적ON 시작하기' })).toBeVisible();
});
