import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke and journey tests. The check submission is intercepted so tests never write to Wix.
 * Pages read live (public) Wix content, so they need network access.
 */

const PAGES = [
  '/',
  '/how-it-works',
  '/business-types',
  '/pricing',
  '/check',
  '/about',
  '/directory',
  '/directory/apply',
  '/contact',
  '/tools',
  '/tools/website-check',
  '/tools/domain-check',
  '/tools/brand-colours',
  '/tools/email-signature',
  '/account/login',
  '/account/register',
  '/account/reset',
  '/privacy',
  '/terms',
];

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

test.describe('Contact', () => {
  test('switches between a call and a question without JavaScript tricks', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('link', { name: 'Book a free call' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Preferred day')).toBeVisible();
    await page.getByRole('link', { name: 'Ask a question' }).click();
    await expect(page.getByLabel('Your question')).toBeVisible();
    await expect(page.getByLabel('Preferred day')).toHaveCount(0);
  });

  test('validates on the server and keeps what was typed', async ({ page }) => {
    await page.goto('/contact?topic=question');
    await page.getByLabel('Your name').fill('Test Person');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Please check the highlighted fields.')).toBeVisible();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveValue('Test Person');
  });
});

test.describe('Free tools', () => {
  test('brand colours updates the palette from a preset or a custom colour', async ({ page }) => {
    await page.goto('/tools/brand-colours');
    await page.locator('label.preset', { hasText: 'Ocean Calm' }).click();
    await expect(page.locator('[data-hex-out="accent"]')).toHaveText('#00B4D8');
    await page.getByLabel('Or use your own brand colour').fill('#1D6B45');
    await expect(page.locator('[data-hex-out="accent"]')).toHaveText('#1D6B45');
    await expect(page.locator('[data-css]')).toContainText('--brand-accent: #1D6B45;');
  });

  test('email signature previews as you type', async ({ page }) => {
    await page.goto('/tools/email-signature');
    await page.getByLabel('Your name').fill('Rudo Chikore');
    await expect(page.locator('[data-signature-preview]')).toContainText('Rudo Chikore');
  });

  test('website check rejects private addresses', async ({ page }) => {
    await page.goto('/tools/website-check?url=http%3A%2F%2F169.254.169.254%2F');
    await expect(page.getByText('Enter a website address, like example.co.uk.')).toBeVisible();
  });
});

test.describe('Client accounts', () => {
  test('the account area asks visitors to log in', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account\/login\?next=%2Faccount|\/account\/login\?next=\/account/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Log in to your account.');
  });

  test('validates the login form before contacting Wix', async ({ page }) => {
    await page.goto('/account/login');
    await page.getByLabel('Email').fill('nope');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
  });

  test('logging out only works as a POST', async ({ request }) => {
    expect((await request.get('/account/logout')).status()).toBe(405);
  });
});

test.describe('Navigation', () => {
  test('header links to the tools and the client login', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) {
      await page.getByLabel('Menu').click();
      const header = page.getByRole('banner');
      await expect(header.getByRole('link', { name: 'Client log in' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Free tools' })).toBeVisible();
    } else {
      await expect(page.locator('.header-login')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Free tools' })).toBeVisible();
    }
  });
});
