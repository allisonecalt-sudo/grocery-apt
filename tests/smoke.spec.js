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

test('single-surface: 5 cards in correct order, no tabs, no I-am pills', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  // Pills/tabs removed
  await expect(page.locator('#who-Allison')).toHaveCount(0);
  await expect(page.locator('#who-Avital')).toHaveCount(0);
  await expect(page.locator('.who-row')).toHaveCount(0);
  await expect(page.locator('.tabs')).toHaveCount(0);
  await expect(page.locator('.tab-btn')).toHaveCount(0);
  await expect(page.locator('#content-allison')).toHaveCount(0);
  await expect(page.locator('#content-avital')).toHaveCount(0);

  // 5 cards present in DOM, in expected order.
  const titles = await page.locator('.main > .section-card .section-header .title span').first().evaluate(() => {
    const t = Array.from(document.querySelectorAll('.main > .section-card .section-header .title > span:first-of-type, .main > .nutri-card .nutri-header .title > span:first-of-type'));
    return t.map((el) => el.textContent.trim());
  });
  expect(titles).toEqual([
    'Apartment List',
    "Allison's List",
    'Allison + Avital',
    "Avital's List",
    'Nutritionist Reminders',
  ]);
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

test('Avital card is reachable from home (no tab switching required)', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  // Avital section header visible without any user action.
  const avitalHeader = page.locator('#avital-body').locator('..').locator('.section-header .title span').first();
  await expect(avitalHeader).toBeVisible();
  // Avital input also reachable (after expanding card if collapsed).
  const avitalInputExists = await page.locator('#avital-input').count();
  expect(avitalInputExists).toBe(1);
});

test('Edit modal List dropdown still has all 4 destinations', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  const options = await page.locator('#edit-list option').evaluateAll((opts) =>
    opts.map((o) => o.value),
  );
  expect(options).toEqual(['apt', 'allison', 'avital', 'allison_avital', 'allison_nutritionist']);
});
