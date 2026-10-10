import { expect, test } from '@playwright/test';

const unique = () => `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

test('catalogue loads and can be searched', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByText('Digital Blood Pressure Monitor')).toBeVisible();
  await page.getByPlaceholder(/search products/i).fill('stethoscope');
  await expect(page.getByText('Professional Stethoscope')).toBeVisible();
  await expect(page.getByText('Digital Blood Pressure Monitor')).toHaveCount(0);
});

test('checkout requires sign-in, then order persists across logout and login', async ({ page }) => {
  const email = unique();
  const password = 'Test-pass-123';

  await page.goto('/products');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.goto('/checkout');
  await page.getByRole('button', { name: /sign in or create account/i }).click();

  // Create account (also exercises the show-password toggle)
  await page.getByRole('button', { name: /create an account/i }).click();
  await page.getByPlaceholder('Your full name').fill('E2E Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder(/at least 6/i).fill(password);
  await page.getByRole('button', { name: /show password/i }).click();
  await expect(page.getByPlaceholder(/at least 6/i)).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: /create account/i }).click();

  // Back at checkout (post-login redirect)
  await expect(page.getByRole('heading', { name: /complete your order/i })).toBeVisible();
  await page.getByPlaceholder('0800 000 0000').fill('08000000000');
  await page.getByPlaceholder('Street address').fill('1 Test Street');
  await page.getByPlaceholder('Lagos').first().fill('Lagos');
  await page.getByPlaceholder('Lagos').nth(1).fill('Lagos');
  await page.getByRole('button', { name: /place order/i }).click();

  await expect(page.getByText(/order confirmed/i)).toBeVisible();
  const orderNumber = (await page.locator('.confirmation-card strong').first().innerText()).replace('#', '');

  // Logout and sign back in; the order must still be there
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder(/at least 6/i).fill(password);
  await page.getByRole('button', { name: /^sign in/i }).click();
  await expect(page.getByText(orderNumber)).toBeVisible();
});

test('cart quantity is capped at available stock', async ({ page }) => {
  await page.goto('/products');
  const card = page.locator('.product-card', { hasText: 'Professional Stethoscope' });
  await card.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/cart');
  const plus = page.getByRole('button', { name: '+' });
  for (let i = 0; i < 6; i++) if (await plus.isEnabled()) await plus.click();
  await expect(page.locator('.quantity-control span')).toHaveText('3');
  await expect(plus).toBeDisabled();
});
