import { expect, test } from '@playwright/test';

import { login, seedE2EData } from './helpers';

test.beforeEach(() => {
  seedE2EData();
});

test('author can login and submit a draft for review from profile', async ({ page }) => {
  await login(page, 'qa_author', 'password123');

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await expect(page.getByText('E2E Draft Intel')).toBeVisible();

  await page.getByRole('button', { name: 'Submit for Review' }).first().click();

  await expect(page.getByText('Post submitted for review.')).toBeVisible();
  await expect(page.getByText('E2E Draft Intel')).toBeVisible();
});
