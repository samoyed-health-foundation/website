// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
  viewport: { width: 390, height: 844 },
});

test('toggle navbar', async ({ page, }, testInfo) => {
  test.skip(process.env.CI !== 'true', 'This test is too flaky without CI settings');

  await page.goto('/');

  const button = page.getByLabel('Menu');
  const menu = page.getByTestId('navbar');

  // starts closed
  await expect(menu).toBeHidden();
  const initial = testInfo.title + ".png";
  await expect(page).toHaveScreenshot(initial, { fullPage: false, timeout: 10000 });

  // click to open
  await button.click();
  await expect(menu).not.toBeHidden();
  const opened = testInfo.title + "opened.png";
  await expect(page).toHaveScreenshot(opened, { fullPage: false, timeout: 10000 });

  // click again to close
  await button.click();
  await expect(menu).toBeHidden();
  const closed = testInfo.title + "closed.png";
  await expect(page).toHaveScreenshot(closed, { fullPage: false, timeout: 10000 });
})
