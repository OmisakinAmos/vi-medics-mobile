import { expect, test } from '@playwright/test';
import { installFakeBackend } from './support/fakeBackend';
import { ADMIN, CUSTOMER, signIn } from './support/helpers';

// vm-001 sells at 45,000 and costs 30,000; vm-002 sells at 18,000 and costs 11,000 (see fakeBackend).
const seedOrders = [
  { userEmail: CUSTOMER.email, items: [{ productId: 'vm-001', quantity: 1 }], city: 'Lekki', state: 'Lagos', daysAgo: 2 },                       // counts: 45,000 sales, 15,000 profit
  { userEmail: CUSTOMER.email, items: [{ productId: 'vm-002', quantity: 2 }], city: 'Abeokuta', state: 'Ogun', daysAgo: 3 },                    // counts: 36,000 sales, 14,000 profit
  { userEmail: CUSTOMER.email, items: [{ productId: 'vm-001', quantity: 5 }], status: 'cancelled', paymentStatus: 'confirmed', daysAgo: 2 },   // cancelled: never counts
  { userEmail: CUSTOMER.email, items: [{ productId: 'vm-001', quantity: 4 }], status: 'pending', paymentStatus: 'reported', daysAgo: 1 },       // not confirmed yet: does not count
];

test.describe('admin accounting', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(page, { users: [CUSTOMER, ADMIN], seedOrders });
    await signIn(page, ADMIN);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Accounting' }).click();
  });

  test('overview counts only confirmed, non-cancelled sales and works out profit', async ({ page }) => {
    const kpi = (label: string) => page.locator('.report-kpi').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) });
    await expect(kpi('Sales')).toContainText('81,000');          // 45,000 + 36,000
    await expect(kpi('Sales')).toContainText('2 orders');
    await expect(kpi('Cost of goods sold')).toContainText('52,000'); // 30,000 + 2 x 11,000
    await expect(kpi('Gross profit')).toContainText('29,000');
    await expect(kpi('Net profit')).toContainText('29,000');     // no expenses yet
  });

  test('adding an expense lowers profit (marketing) but not stock purchases', async ({ page }) => {
    await page.getByRole('tab', { name: 'Expenses' }).click();
    await page.getByLabel('Category').selectOption('marketing');
    await page.getByLabel('What was it for?').fill('Instagram ads');
    await page.getByLabel(/Amount/).fill('9000');
    await page.getByRole('button', { name: /save expense/i }).click();
    await expect(page.getByText('Expense saved.')).toBeVisible();
    await expect(page.locator('.acc-expense', { hasText: 'Instagram ads' })).toContainText('9,000');

    await page.getByLabel('Category').selectOption('stock');
    await page.getByLabel('What was it for?').fill('20 pulse oximeters');
    await page.getByLabel(/Amount/).fill('100000');
    await page.getByRole('button', { name: /save expense/i }).click();
    await expect(page.locator('.acc-expense', { hasText: '20 pulse oximeters' })).toBeVisible();

    await page.locator('.acc-subtabs').getByRole('tab', { name: 'Overview' }).click();
    const kpi = (label: string) => page.locator('.report-kpi').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) });
    await expect(kpi('Net profit')).toContainText('20,000');      // 29,000 - 9,000; stock purchase not subtracted again
    await expect(kpi('Spent on stock')).toContainText('100,000');
  });

  test('an expense can be deleted', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.getByRole('tab', { name: 'Expenses' }).click();
    await page.getByLabel('What was it for?').fill('Test packaging');
    await page.getByLabel(/Amount/).fill('2500');
    await page.getByRole('button', { name: /save expense/i }).click();
    const row = page.locator('.acc-expense', { hasText: 'Test packaging' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
  });

  test('products and locations breakdowns add up', async ({ page }) => {
    await page.locator('.acc-subtabs').getByRole('tab', { name: 'Products' }).click();
    const bp = page.locator('.acc-table tbody tr', { hasText: 'Digital Blood Pressure Monitor' });
    await expect(bp).toContainText('45,000');
    await expect(bp).toContainText('15,000');                     // profit
    await expect(page.locator('.acc-table tbody tr', { hasText: 'Fingertip Pulse Oximeter' })).toContainText('14,000');

    await page.getByRole('tab', { name: 'Locations' }).click();
    const lagos = page.locator('.acc-table tbody tr', { hasText: 'Lagos' });
    await expect(lagos).toContainText('45,000');
    await expect(page.locator('.acc-table tbody tr', { hasText: 'Ogun' })).toContainText('36,000');
    await page.getByRole('button', { name: 'By city' }).click();
    await expect(page.locator('.acc-table tbody tr', { hasText: 'Abeokuta, Ogun' })).toContainText('36,000');
  });
});
