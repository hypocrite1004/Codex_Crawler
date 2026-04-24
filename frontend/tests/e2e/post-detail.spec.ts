import { expect, test } from '@playwright/test';

import { fetchPublicPostId, login, seedE2EData } from './helpers';

test.beforeEach(() => {
  seedE2EData();
});

test('guest can view published post detail and sees login prompt for comments', async ({ page, request }) => {
  const postId = await fetchPublicPostId(request, 'E2E Published News Without Summary');
  await page.goto(`/posts/${postId}`);

  await expect(page.getByRole('heading', { name: 'E2E Published News Without Summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Discussion (1)' })).toBeVisible();
  await expect(page.locator('a[href="/login"]').last()).toBeVisible();
});

test('guest can discover security-rich posts from the public feed', async ({ page }) => {
  await page.goto('/?search=E2E%20Published%20News%20With%20Summary&has_security_context=true');

  await expect(page.getByText('E2E Published News With Summary')).toBeVisible();
  await expect(page.getByText(/Security context:.*1 CVE/)).toBeVisible();
  await expect(page.getByText(/Security context:.*1 IOC/)).toBeVisible();
  await expect(page.getByText(/Security context:.*1 related/)).toBeVisible();
});

test('guest can understand a security-rich post and continue to CVE discovery', async ({ page, request }) => {
  const postId = await fetchPublicPostId(request, 'E2E Published News With Summary');
  await page.goto(`/posts/${postId}`);

  const understandingCard = page.getByLabel('Why this post matters');
  await expect(page.getByRole('heading', { name: 'Why this matters' })).toBeVisible();
  await expect(understandingCard.getByText('Public visitors can quickly see the affected CVE and IOC before reading the full article.')).toBeVisible();
  await expect(understandingCard.getByRole('link', { name: /IOC: 198\.51\.100\.77/ })).toBeVisible();
  await expect(understandingCard.getByRole('link', { name: '#threat-intel' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Related Coverage' })).toBeVisible();

  await page.getByRole('link', { name: /CVE-2026-10001/ }).first().click();
  await expect(page).toHaveURL(/\/cves\/\d+/);
  await expect(page.getByRole('heading', { name: 'CVE-2026-10001' })).toBeVisible();
});

test('staff sees operator controls for summary and comments', async ({ page, request }) => {
  await login(page, 'qa_staff', 'password123');
  const postId = await fetchPublicPostId(request, 'E2E Published News Without Summary');
  await page.goto(`/posts/${postId}`);

  await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as Curated' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' }).first()).toBeVisible();
});
