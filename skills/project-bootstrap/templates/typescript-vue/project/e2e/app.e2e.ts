import { expect, test } from '@playwright/test';

// 雛形の最小の E2E。主要フローができたら置き換える
test('トップページが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#q-app')).toBeVisible();
});
