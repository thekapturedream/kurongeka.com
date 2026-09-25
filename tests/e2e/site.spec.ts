import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke and journey tests. The check submission is intercepted so tests never write to Wix.
 * Pages read live (public) Wix content, so they need network access.
 */

const PAGES = ['/', '/how-it-works', '/business-types', '/pricing', '/check', '/about', '/directory', '/privacy', '/terms'];

test.describe('pages', () => {
  for (const path of PAGES) {
    test(`${path} renders with one h1, a canonical URL and no horizontal overflow`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/www\.kurongeka\.com/);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }

  test('unknown pages return 404', async ({ page }) => {
    expect((await page.goto('/this-does-not-exist'))?.status()).toBe(404);
    expect((await page.goto('/business-types/this-does-not-exist'))?.status()).toBe(404);
  });

  test('pricing shows launch packages and monthly plans from Wix', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('.package')).not.toHaveCount(0);
    await expect(page.locator('.plan')).not.toHaveCount(0);
  });
});

async function answer(page: Page, label: string) {
  await page.getByLabel(label, { exact: true }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.describe('Kurongeka Check', () => {
  test('asks one question at a time and blocks empty answers', async ({ page }) => {
    await page.goto('/check');
    await expect(page.getByText('Question 1 of 8')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Choose one to continue.')).toBeVisible();
    await expect(page.getByText('Question 1 of 8')).toBeVisible();
  });

  test('completes the journey and lands on the result page', async ({ page }) => {
    let submitted: Record<string, unknown> | null = null;
    await page.route('**/api/check', async (route) => {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, score: 18, resultUrl: '/check/result?s=18&f=15&t=15&p=25&r=pro' }),
      });
    });

    await page.goto('/check?type=clinics-and-dental');
    await expect(page.getByLabel('Clinics and dental practices')).toBeChecked();
    await page.getByRole('button', { name: 'Continue' }).click();
    await answer(page, 'Trading for less than a year');
    await answer(page, 'No website yet');
    await answer(page, 'I am not sure');
    await page.getByLabel('Cash', { exact: true }).check();
    await page.getByLabel('Mobile money, such as EcoCash').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await answer(page, 'It is fine, but it could be better');
    await answer(page, 'Getting more customers');

    await expect(page.getByText('Last step', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Get my score' }).click();
    await expect(page.getByText('Enter your name.')).toBeVisible();

    await page.getByLabel('Your name').fill('Test Person');
    await page.getByLabel('Business name').fill('Test Clinic');
    await page.getByLabel('WhatsApp number').fill('077 123 4567');
    await page.getByRole('button', { name: 'Get my score' }).click();

    await page.waitForURL('**/check/result**');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Not yet set up');
    expect(submitted).toMatchObject({
      businessType: 'clinics-and-dental',
      stage: 'young',
      website: 'none',
      maps: 'unsure',
      payments: ['cash', 'mobile-money'],
      name: 'Test Person',
      contactPreference: 'whatsapp',
    });
  });

  test('offers WhatsApp with the answers when submission fails', async ({ page }) => {
    await page.route('**/api/check', (route) => route.fulfill({ status: 502, body: '{"ok":false}' }));
    await page.goto('/check?type=professional-services');
    await page.getByRole('button', { name: 'Continue' }).click();
    await answer(page, 'Starting out, not trading yet');
    await answer(page, 'No website yet');
    await answer(page, 'No');
    await page.getByLabel('Cash', { exact: true }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await answer(page, 'No, or we do not have one');
    await answer(page, 'Looking more professional');
    await page.getByLabel('Your name').fill('Test Person');
    await page.getByLabel('Business name').fill('Test Firm');
    await page.getByLabel('WhatsApp number').fill('077 123 4567');
    await page.getByRole('button', { name: 'Get my score' }).click();

    const fallback = page.getByRole('link', { name: 'Message us on WhatsApp instead' });
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('href', /Test%20Firm/);
  });
});

test.describe('API', () => {
  test('rejects invalid submissions with field errors', async ({ request }) => {
    const response = await request.post('/api/check', { data: { businessType: 'other' } });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { fieldErrors: Record<string, string> };
    expect(Object.keys(body.fieldErrors)).toEqual(expect.arrayContaining(['stage', 'name', 'phone']));
  });

  test('silently drops honeypot submissions', async ({ request }) => {
    const response = await request.post('/api/check', { data: { company_website: 'spam.example' } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, resultUrl: '/check' });
  });

  test('only accepts POST', async ({ request }) => {
    expect((await request.get('/api/check')).status()).toBe(405);
  });
});
