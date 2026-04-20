import { expect, test } from '@playwright/test';

import { fetchPublicPostId, login, seedE2EData } from './helpers';

test.beforeEach(() => {
  seedE2EData();
});

test('guest can view published post detail and sees login prompt for comments', async ({ page, request }) => {
  const postId = await fetchPublicPostId(request, 'E2E Published News Without Summary');
  await page.goto(`/posts/${postId}`);

  await expect(page.getByRole('heading', { name: 'E2E Published News Without Summary' })).toBeVisible();
  await expect(page.getByText('댓글 작성은 로그인 후 가능합니다.')).toBeVisible();
});

test('staff sees operator controls for summary and comments', async ({ page, request }) => {
  await login(page, 'qa_staff', 'password123');
  const postId = await fetchPublicPostId(request, 'E2E Published News Without Summary');
  await page.goto(`/posts/${postId}`);

  await expect(page.getByRole('button', { name: '요약 생성' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' }).first()).toBeVisible();
});
