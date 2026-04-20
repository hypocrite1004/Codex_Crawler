import { expect, test } from '@playwright/test';

import { login, seedE2EData } from './helpers';

test.beforeEach(() => {
  seedE2EData();
});

test('staff can approve a review post from admin posts', async ({ page }) => {
  await login(page, 'qa_staff', 'password123');

  await page.goto('/admin/posts');
  await expect(page.getByRole('heading', { name: '게시글 워크플로우' })).toBeVisible();
  await expect(page.getByText('E2E Review Intel')).toBeVisible();

  await page.getByRole('button', { name: '승인' }).first().click();
  await expect(page.getByText('게시글을 승인했습니다.')).toBeVisible();
});
