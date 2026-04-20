import { execSync } from 'child_process';
import path from 'path';

import type { APIRequestContext, Page } from '@playwright/test';

const repoRoot = path.resolve(__dirname, '../../..');

export function seedE2EData() {
  execSync('.\\venv\\Scripts\\python.exe backend\\manage.py seed_e2e_data', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

export async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="text"]').first().fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('http://127.0.0.1:3000/');
}

export async function fetchPublicPostId(request: APIRequestContext, title: string) {
  const response = await request.get(`http://127.0.0.1:8000/api/posts/?search=${encodeURIComponent(title)}&limit=20`);
  const data = await response.json();
  const match = (data.results || []).find((item: { title: string; id: number }) => item.title === title);
  if (!match) {
    throw new Error(`Post not found for title: ${title}`);
  }
  return match.id as number;
}
