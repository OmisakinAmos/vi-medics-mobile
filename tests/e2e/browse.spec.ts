import { expect, test } from '@playwright/test';
import { installFakeBackend } from './support/fakeBackend';
import { addToCart } from './support/helpers';

test.describe('browsing and cart', () => {
  test.beforeEach(async ({ page }) => { await installFakeBackend(page); });

  test('main navigation bar sits after the logo and works', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'Shop', 'Servicing', 'Cart', 'Sign in']) await expect(nav.getByRole('link', { name })).toBeVisible();
    await nav.getByRole('link', { name: 'Shop' }).click();
    await expect(page).toHaveURL(/\/products$/);
    await nav.getByRole('link', { name: 'Servicing' }).click();
    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole('heading', { name: /equipment maintenance and servicing/i })).toBeVisible();
    await nav.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('catalogue loads and can be searched', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByText('Digital Blood Pressure Monitor').first()).toBeVisible();
    await page.getByPlaceholder(/search products/i).fill('stethoscope');
    await expect(page.getByText('Professional Stethoscope').first()).toBeVisible();
    await expect(page.getByText('Digital Blood Pressure Monitor')).toHaveCount(0);
  });

  test('product details show price and stock', async ({ page }) => {
    await page.goto('/product/vm-001');
    await expect(page.getByRole('heading', { name: 'Digital Blood Pressure Monitor' })).toBeVisible();
    await expect(page.getByText(/45,000/).first()).toBeVisible();
    await expect(page.getByText(/in stock/i).first()).toBeVisible();
  });

  test('an out-of-stock product cannot be bought', async ({ page }) => {
    await installFakeBackend(page, { stock: { 'vm-004': 0 } });
    await page.goto('/products');
    const card = page.locator('.product-card', { hasText: 'Portable Nebulizer' });
    await expect(card.getByText('Out of stock')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
  });

  test('cart quantity cannot go above available stock', async ({ page }) => {
    await addToCart(page, 'Professional Stethoscope'); // only 3 in stock
    await page.goto('/cart');
    const plus = page.getByRole('button', { name: '+', exact: true });
    for (let i = 0; i < 6; i++) if (await plus.isEnabled()) await plus.click();
    await expect(page.locator('.quantity-control span')).toHaveText('3');
    await expect(plus).toBeDisabled();
    await expect(page.getByText(/maximum available quantity/i)).toBeVisible();
  });

  test('cart total has no delivery fee: delivery is arranged separately', async ({ page }) => {
    await addToCart(page, 'Digital Blood Pressure Monitor');
    await page.goto('/cart');
    const summary = page.locator('.summary');
    await expect(summary.getByText('Arranged separately')).toBeVisible();
    await expect(summary.locator('.summary-total')).toContainText('45,000');
    await expect(summary).not.toContainText('5,000.00');
    await expect(summary).not.toContainText('50,000');
  });

  test('cart survives a page reload', async ({ page }) => {
    await addToCart(page, 'Digital Medical Thermometer');
    await page.reload();
    await page.goto('/cart');
    await expect(page.getByText('Digital Medical Thermometer').first()).toBeVisible();
  });
});
