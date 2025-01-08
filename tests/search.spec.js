// @ts-check
const { test, expect } = require('@playwright/test');

test('hemophili', async ({ page }) => {
  await page.goto('/diseases');
  await page.evaluate(() => document.fonts.ready);
  const search = page.getByRole('searchbox', { name: 'Search all diseases...' });
  await search.fill('hemophili');
  await page.waitForSelector('#hits .ais-Hits-item', { state: 'visible' });
  const hits = await page.locator('#hits .ais-Hits-item').allTextContents();
  expect(hits).toContainEqual(expect.stringContaining('Hemophilia'));
  expect(hits).toContainEqual(expect.stringContaining('A to Z Diseases'));
  await expect(page).toHaveScreenshot({ fullPage: true, timeout: 10000 });
});
