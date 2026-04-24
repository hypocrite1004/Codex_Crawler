import { expect, test } from '@playwright/test';

import { login, seedE2EData } from './helpers';

test.beforeEach(() => {
  seedE2EData();
});

test('admin can inspect crawler run items and open created posts', async ({ page }) => {
  await login(page, 'qa_admin', 'password123');
  await page.goto('/admin/crawler');

  const sourceCard = page.locator('.glass-panel').filter({ hasText: 'E2E Crawler Diagnostics' }).first();
  await expect(sourceCard).toBeVisible();

  await sourceCard.getByRole('button', { name: 'Runs' }).click();

  await expect(sourceCard.getByText('Run #')).toBeVisible();
  await expect(sourceCard.getByText('Found')).toBeVisible();
  await expect(sourceCard.getByText('E2E Created Crawl Item')).toBeVisible();
  await expect(sourceCard.getByText('Duplicate source URL')).toBeVisible();
  await expect(sourceCard.getByText('Missing source URL')).toBeVisible();
  await expect(sourceCard.getByText('Item persistence failed')).toBeVisible();

  await sourceCard.getByRole('link', { name: 'Open post' }).click();
  await expect(page).toHaveURL(/\/posts\/\d+/);
  await expect(page.getByRole('heading', { name: 'E2E Published News With Summary' })).toBeVisible();
});

test('admin can filter crawler sources by operational state', async ({ page }) => {
  await login(page, 'qa_admin', 'password123');
  await page.goto('/admin/crawler');

  await expect(page.getByText('Showing')).toBeVisible();
  await page.getByLabel('Search crawler sources').fill('E2E Crawler Diagnostics');
  await page.getByLabel('Health filter').selectOption('healthy');
  await page.getByLabel('Source type filter').selectOption('rss');
  await page.getByLabel('Scheduler filter').selectOption('active');

  await expect(page.getByText('E2E Crawler Diagnostics')).toBeVisible();
  await expect(page.getByText('No sources match the current filters.')).not.toBeVisible();

  await page.getByLabel('Health filter').selectOption('error');
  await expect(page.getByText('No sources match the current filters.')).toBeVisible();

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('E2E Crawler Diagnostics')).toBeVisible();
});
