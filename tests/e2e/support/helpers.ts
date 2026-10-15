import { expect, type Page } from '@playwright/test';

export const CUSTOMER = { email: 'amaka@example.test', password: 'Test-pass-123', fullName: 'Amaka Obi' };
export const OTHER_CUSTOMER = { email: 'tunde@example.test', password: 'Test-pass-123', fullName: 'Tunde Bello' };
export const ADMIN = { email: 'admin@example.test', password: 'Test-pass-123', fullName: 'Shop Admin', admin: true };

/** Adds a product to the cart from the catalogue. */
export async function addToCart(page: Page, productName: string) {
  await page.goto('/products');
  const card = page.locator('.product-card', { hasText: productName });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Add to cart' }).click();
}

/** Signs in through the real login form. */
export async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(who.email);
  await page.getByPlaceholder(/at least 6/i).fill(who.password);
  await page.getByRole('button', { name: /^sign in/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
}

/** Fills the checkout form (name and email come from the account) and taps the pay button. */
export async function placeOrderFromCheckout(page: Page, details: { phone?: string; address?: string; city?: string; state?: string } = {}) {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: /complete your order/i })).toBeVisible();
  await page.getByLabel('Phone number').fill(details.phone ?? '08012345678');
  await page.getByLabel('Address').fill(details.address ?? '12 Admiralty Way, Lekki');
  await page.getByLabel('City').fill(details.city ?? 'Lagos');
  await page.getByLabel('State').fill(details.state ?? 'Lagos');
  await page.getByRole('button', { name: /by bank transfer/i }).click();
}

/** The "Have you paid?" prompt is a browser dialog: accept it. */
export function acceptDialogs(page: Page) {
  page.on('dialog', (d) => void d.accept());
}
