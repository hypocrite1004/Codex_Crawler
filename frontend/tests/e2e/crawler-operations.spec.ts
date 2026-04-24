import { expect, test } from '@playwright/test';

import { login, seedE2EData } from './helpers';

test.beforeEach(() => {
  seedE2EData();
});

test('admin can inspect crawler run items and open created posts', async ({ page }) => {
  await login(page, 'qa_admin', 'password123');
  await page.goto('/admin/crawler');

  const sourceCard = page.getByTestId('crawler-source-card').filter({ has: page.getByRole('heading', { name: 'E2E Crawler Diagnostics' }) });
  await expect(sourceCard).toBeVisible();

  await sourceCard.getByRole('button', { name: 'Runs' }).click();

  await expect(sourceCard.getByText('Run #')).toBeVisible();
  await expect(sourceCard.getByText('Partial item failures', { exact: true })).toBeVisible();
  await expect(sourceCard.getByText('Found', { exact: true })).toBeVisible();
  await expect(sourceCard.getByText('E2E Created Crawl Item')).toBeVisible();
  await expect(sourceCard.getByText('Duplicate URL', { exact: true })).toBeVisible();
  await expect(sourceCard.getByText('Duplicate source URL')).toBeVisible();
  await expect(sourceCard.getByText('Missing item URL', { exact: true })).toBeVisible();
  await expect(sourceCard.getByText('Missing source URL')).toBeVisible();
  await expect(sourceCard.getByText('Persistence failure', { exact: true })).toBeVisible();
  await expect(sourceCard.getByText('Item persistence failed')).toBeVisible();

  await sourceCard.getByRole('link', { name: 'Open post' }).click();
  await expect(page).toHaveURL(/\/posts\/\d+/);
  await expect(page.getByRole('heading', { name: 'E2E Published News With Summary' })).toBeVisible();
});

test('admin can filter crawler sources by operational state', async ({ page }) => {
  await login(page, 'qa_admin', 'password123');
  await page.goto('/admin/crawler');

  await expect(page.getByText('Collection Status')).toBeVisible();
  await expect(page.getByText('Reliability Alerts')).toBeVisible();
  await expect(page.getByText('High failure rate')).toBeVisible();
  await expect(page.getByText('7d success')).toBeVisible();
  await expect(page.getByText('Showing')).toBeVisible();
  await page.getByLabel('Search crawler sources').fill('E2E Crawler Diagnostics');
  await page.getByLabel('Health filter').selectOption('healthy');
  await page.getByLabel('Source type filter').selectOption('rss');
  await page.getByLabel('Scheduler filter').selectOption('active');

  const sourceCard = page.getByTestId('crawler-source-card').filter({ has: page.getByRole('heading', { name: 'E2E Crawler Diagnostics' }) });
  await expect(sourceCard).toBeVisible();
  await expect(page.getByText('No sources match the current filters.')).not.toBeVisible();

  await page.getByLabel('Health filter').selectOption('error');
  await expect(page.getByText('No sources match the current filters.')).toBeVisible();

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(sourceCard).toBeVisible();
});
