// @ts-check
const { test, expect } = require('@playwright/test');

async function visualDiff(page, url) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot({ fullPage: true, timeout: 10000 });
}

test('home page', async ({ page }) => {
  await visualDiff(page, '/');
});

test('about page', async ({ page }) => {
  await visualDiff(page, '/about');
});

test('owners page', async ({ page }) => {
  await visualDiff(page, '/owners');
});

test('breeders page', async ({ page }) => {
  await visualDiff(page, '/breeders');
});

test('research page', async ({ page }) => {
  await visualDiff(page, '/research');
});

test('diseases page', async ({ page }) => {
  await visualDiff(page, '/diseases');
});

test('databases page', async ({ page }) => {
  await visualDiff(page, '/databases');
});

test('contact us page', async ({ page }) => {
  await visualDiff(page, '/contact-us');
});

test('how you can help page', async ({ page }) => {
  await visualDiff(page, '/how-you-can-help');
});

test('research studies page', async ({ page }) => {
  await visualDiff(page, '/research/all-scarf-sponsored-research-studies/');
});

test('research study page', async ({ page }) => {
  await visualDiff(page, '/research/current-studies/AKCCHF-Grant-03106');
});

test('cataracts page', async ({ page }) => {
  await visualDiff(page, '/diseases/cataracts-posterior-lenticonus');
});

test('database FAQ page', async ({ page }) => {
  await visualDiff(page, '/databases/q-and-a');
});

test('database instructions page', async ({ page }) => {
  await visualDiff(page, '/databases/using-the-database');
});
