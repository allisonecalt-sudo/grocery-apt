const { test, expect } = require('@playwright/test');

const APP_URL = 'https://allisonecalt-sudo.github.io/grocery-apt/';

test('page loads successfully', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  const title = await page.title();
  console.log('Title:', title);
  expect(title).not.toBe('Site not found · GitHub Pages');
});

test('no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('Errors:', errors.length ? errors : 'None');
  expect(errors).toHaveLength(0);
});

test('header has Allison + Avital pills (no Ruthie)', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('#who-Allison')).toBeVisible();
  await expect(page.locator('#who-Avital')).toBeVisible();
  await expect(page.locator('#who-Ruthie')).toHaveCount(0);
});

test('cut features are gone (no shop-mode/trips/staples/receipts)', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('.shop-btn')).toHaveCount(0);
  await expect(page.locator('.shop-history-btn')).toHaveCount(0);
  await expect(page.locator('#trips-overlay')).toHaveCount(0);
  await expect(page.locator('#shopping-overlay')).toHaveCount(0);
  await expect(page.locator('.staples-card')).toHaveCount(0);
  await expect(page.locator('#receipt-modal-bg')).toHaveCount(0);
});

test('PWA manifest is reachable and valid', async ({ page }) => {
  const res = await page.request.get(APP_URL + 'manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.name).toBe('Apt Grocery');
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
});
