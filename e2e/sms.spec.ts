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
 * 시나리오 2 — 문자입력.
 * 여러 건을 빈 줄로 구분해 일괄 붙여넣고 저장하면 거래로 파싱되어 목록에 남는다.
 * 미인식 문자는 조용히 사라지지 않는다.
 */
test('문자입력: 2건 일괄 붙여넣기가 거래로 저장된다', async ({ page }) => {
  await page.goto('/');
  // 마운트 대기(빈 상태의 템플릿 버튼이 뜨면 준비 완료)
  await expect(page.getByRole('button', { name: '템플릿에서 카드 추가' })).toBeVisible();

  await page.getByRole('button', { name: '문자분석' }).click();

  const two = [
    '[Web발신]',
    '신한카드(1234)승인 홍*동',
    '12,000원 일시불',
    '07/24 14:23 스타벅스 강남점',
    '',
    '[Web발신]',
    'KB국민카드(5678)승인',
    '45,600원 일시불',
    '07/23 19:10 이마트 성수점',
  ].join('\n');

  await page.getByPlaceholder(/결제 문자를 붙여넣으세요/).fill(two);
  await page.getByRole('button', { name: '분석해서 저장' }).click();

  // 저장 결과 토스트
  await expect(page.getByText(/2건 저장/)).toBeVisible();

  // 거래 내역에 두 가맹점이 남는다
  await expect(page.getByText('스타벅스 강남점')).toBeVisible();
  await expect(page.getByText('이마트 성수점')).toBeVisible();

  // 분석 현황 반영
  await expect(page.getByText('인식 성공')).toBeVisible();
});

test('자동화: ?text= 로 열면 자동 저장되고 확인 화면이 뜬다', async ({ page }) => {
  const sms = '신한카드(1234) 승인 12,000원 일시불 스타벅스 강남점';
  await page.goto('/?text=' + encodeURIComponent(sms));
  // 자동 처리 확인 오버레이
  await expect(page.getByText('1건 저장했습니다')).toBeVisible();
  await page.getByRole('button', { name: '확인' }).click();
  // 거래 목록(문자분석 탭)에 남는다
  await expect(page.getByText('스타벅스 강남점')).toBeVisible();
});

test('문자입력: 안내 문자는 미인식으로 보존된다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '템플릿에서 카드 추가' })).toBeVisible();
  await page.getByRole('button', { name: '문자분석' }).click();

  await page.getByPlaceholder(/결제 문자를 붙여넣으세요/).fill('[Web발신]\n고객님 이번 달 청구금액 안내\n총 1,284,000원');
  await page.getByRole('button', { name: '분석해서 저장' }).click();

  // 미인식 사유가 화면에 남는다 (버려지지 않음)
  await expect(page.getByText('결제 문자가 아닌 안내 문자입니다')).toBeVisible();
});
