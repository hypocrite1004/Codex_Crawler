import { expect, test } from '@playwright/test';

import { login, seedE2EData } from './helpers';

test.beforeEach(() => {
  seedE2EData();
});

test('staff can access dashboard', async ({ page }) => {
  await login(page, 'qa_staff', 'password123');
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: '보안 인텔리전스 대시보드' })).toBeVisible();
});

test('guest can browse cve list and detail', async ({ page }) => {
  await page.goto('/cves');
  await expect(page.getByRole('heading', { name: 'CVE Intelligence' })).toBeVisible();

  await page.getByRole('link', { name: /CVE-2026-10001/i }).click();
  await expect(page.getByRole('heading', { name: 'CVE-2026-10001' })).toBeVisible();
  await expect(page.getByText('연결된 게시글')).toBeVisible();
});
