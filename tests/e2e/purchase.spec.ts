import { expect, test } from '@playwright/test';
import { installFakeBackend } from './support/fakeBackend';
import { ADMIN, CUSTOMER, OTHER_CUSTOMER, acceptDialogs, addToCart, placeOrderFromCheckout, signIn } from './support/helpers';

const users = [CUSTOMER, OTHER_CUSTOMER, ADMIN];

test.describe('purchase journey', () => {
  test('checkout asks a signed-out visitor to sign in', async ({ page }) => {
    await installFakeBackend(page, { users });
    await addToCart(page, 'Digital Medical Thermometer');
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: /sign in to place your order/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /by bank transfer/i })).toHaveCount(0);
  });

  test('wrong password is rejected with a clear message', async ({ page }) => {
    await installFakeBackend(page, { users });
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(CUSTOMER.email);
    await page.getByPlaceholder(/at least 6/i).fill('not-the-password');
    await page.getByRole('button', { name: /^sign in/i }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid login credentials/i);
  });

  test('full journey: order, bank details, "I have paid", receipt, thank-you, My Orders', async ({ page }) => {
    const backend = await installFakeBackend(page, { users });
    acceptDialogs(page);

    await signIn(page, CUSTOMER);
    await addToCart(page, 'Digital Medical Thermometer');
    await page.goto('/cart');
    const plus = page.getByRole('button', { name: '+', exact: true });
    await plus.click(); await plus.click(); // 3 x 8,500 = 25,500
    await page.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page.getByRole('heading', { name: /complete your order/i })).toBeVisible();
    await expect(page.locator('.checkout-summary .summary-total')).toContainText('25,500');

    // Order is saved and the bank transfer page shows the exact amount, no delivery added
    await page.getByLabel('Phone number').fill('08012345678');
    await page.getByLabel('Address').fill('12 Admiralty Way, Lekki');
    await page.getByLabel('City').fill('Lagos');
    await page.getByLabel('State').fill('Lagos');
    await page.getByRole('button', { name: /pay .*25,500 by bank transfer/i }).click();

    await expect(page.getByRole('heading', { name: /pay by bank transfer/i })).toBeVisible();
    await expect(page.locator('.pay-total')).toContainText('25,500');
    await expect(page.locator('.pay-total')).toContainText(/delivery is arranged separately/i);
    await expect(page.getByText('Vi-Medics Test Account')).toBeVisible();
    await expect(page.getByText('0123456789')).toBeVisible();
    expect(backend.orders).toHaveLength(1);
    expect(backend.orders[0].payment_status).toBe('awaiting');
    expect(backend.orders[0].delivery_fee).toBe(0);

    // "I have paid" -> receipt on screen, emailed, marked as reported
    await page.getByRole('button', { name: /i have paid/i }).click();
    await expect(page.getByRole('heading', { name: /here is your receipt/i })).toBeVisible();
    await expect(page.getByText(/has been emailed to amaka@example.test/i)).toBeVisible();
    const receipt = page.locator('#receipt');
    await expect(receipt).toContainText('Digital Medical Thermometer');
    await expect(receipt).toContainText('Arranged separately');
    await expect(receipt.locator('.receipt-total')).toContainText('25,500');
    await expect(receipt).toContainText('Payment reported');
    expect(backend.orders[0].payment_status).toBe('reported');
    expect(backend.receiptRequests).toHaveLength(1);
    expect(backend.receiptRequests[0].hasToken).toBe(true);

    // Done -> plain thank-you page with NO receipt on it
    await page.getByRole('button', { name: /done/i }).click();
    await expect(page.getByRole('heading', { name: /thank you for your order/i })).toBeVisible();
    await expect(page.locator('#receipt')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /print/i })).toHaveCount(0);

    // My Orders lists it
    await page.getByRole('button', { name: /view my orders/i }).click();
    await expect(page.locator('.order-card')).toContainText('#VM-10001');
    await expect(page.locator('.order-card')).toContainText('Payment reported');
  });

  test('if the receipt email fails, the receipt is still shown with a clear note', async ({ page }) => {
    await installFakeBackend(page, { users, emailFails: true });
    acceptDialogs(page);
    await signIn(page, CUSTOMER);
    await addToCart(page, 'Digital Medical Thermometer');
    await placeOrderFromCheckout(page);
    await page.getByRole('button', { name: /i have paid/i }).click();
    await expect(page.getByRole('heading', { name: /here is your receipt/i })).toBeVisible();
    await expect(page.getByText(/could not email the receipt/i)).toBeVisible();
    await expect(page.locator('#receipt')).toContainText('#VM-10001');
  });

  test('stock is checked by the server: a sold-out item cannot be ordered', async ({ page }) => {
    const backend = await installFakeBackend(page, { users });
    await signIn(page, CUSTOMER);
    await addToCart(page, 'Professional Stethoscope');
    // Someone else buys the remaining stock after it was added to this cart
    (backend.products.find((p) => p.id === 'vm-003') as Record<string, unknown>).stock_quantity = 0;
    await placeOrderFromCheckout(page);
    await expect(page.getByRole('alert')).toContainText(/insufficient stock/i);
    expect(backend.orders).toHaveLength(0);
  });

  test('a customer cannot hold more than 3 unpaid orders', async ({ page }) => {
    const seed = Array.from({ length: 3 }, () => ({ userEmail: CUSTOMER.email, items: [{ productId: 'vm-005', quantity: 1 }], status: 'pending', paymentStatus: 'awaiting' }));
    await installFakeBackend(page, { users, seedOrders: seed });
    await signIn(page, CUSTOMER);
    await addToCart(page, 'Digital Medical Thermometer');
    await placeOrderFromCheckout(page);
    await expect(page.getByRole('alert')).toContainText(/3 unpaid orders/i);
  });

  test('an unpaid order can be cancelled from My Orders and its stock is released', async ({ page }) => {
    const backend = await installFakeBackend(page, { users });
    page.on('dialog', (d) => void d.accept());
    await signIn(page, CUSTOMER);
    await addToCart(page, 'Digital Medical Thermometer');
    await placeOrderFromCheckout(page);
    await expect(page.getByRole('heading', { name: /pay by bank transfer/i })).toBeVisible();
    const stockAfterOrder = backend.products.find((p) => p.id === 'vm-005')!.stock_quantity;

    await page.goto('/account');
    await page.getByRole('button', { name: /view order/i }).click();
    await page.getByRole('button', { name: /cancel order/i }).click();
    await expect(page.locator('.order-card')).toContainText('Cancelled');
    expect(backend.orders[0].status).toBe('cancelled');
    expect(backend.products.find((p) => p.id === 'vm-005')!.stock_quantity).toBe((stockAfterOrder as number) + 1);
    await expect(page.getByRole('button', { name: /cancel order/i })).toHaveCount(0);
  });

  test('orders persist after sign-out, and a customer only sees their own', async ({ page }) => {
    await installFakeBackend(page, {
      users,
      seedOrders: [{ userEmail: OTHER_CUSTOMER.email, items: [{ productId: 'vm-001', quantity: 1 }] }],
    });
    acceptDialogs(page);
    await signIn(page, CUSTOMER);
    await addToCart(page, 'Digital Medical Thermometer');
    await placeOrderFromCheckout(page);
    await expect(page.getByRole('heading', { name: /pay by bank transfer/i })).toBeVisible();

    await page.goto('/account');
    await expect(page.locator('.order-card')).toHaveCount(1); // not Tunde's order
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sign in' })).toBeVisible();
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /sign in to see your orders/i })).toBeVisible();

    await signIn(page, CUSTOMER);
    await page.goto('/account');
    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('.order-card')).toContainText('#VM-10002');
  });

  test('a normal customer cannot open the admin area', async ({ page }) => {
    await installFakeBackend(page, { users });
    await signIn(page, CUSTOMER);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /no access/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Accounting' })).toHaveCount(0);
  });
});
