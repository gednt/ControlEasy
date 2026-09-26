// Phase 22 (TEST-01) — Stale E2E refresh.
//
// The Phase-13 "Gatehouse Workflow" describe block exercised a removed FAB/tile
// dashboard ("New entry" / "Register entry" / "Entry denied" / "Gatehouse only" /
// "Override"). Phase 17 replaced those tiles with a tabbed operator panel at
// /gatehouse; the previous tests now assert UI that no longer exists.
//
// This file retains the still-valuable audit-review and consent-policy flows
// (they target /audit and /admin/consent-policy, both still present) and
// rewrites the gatehouse portion against the current tabbed panel.
//
// Note: Playwright E2E runs via `npm run e2e` against the Docker stack, NOT
// inside `verify-ci-local.sh`. See 22-RESEARCH.md Pitfall 3.

import { test, expect } from '@playwright/test';
import {
  demoAdminEmail,
  demoAdminPassword,
  loginAsDemoUser,
  selectFirstApartmentOption,
} from './helpers/demo-auth';

test.describe('Gatehouse Operator Panel', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera']);
    await loginAsDemoUser(page, demoAdminEmail, demoAdminPassword);
  });

  test('panel loads with the tablist and defaults to the QR scan tab', async ({ page }) => {
    await page.goto('/gatehouse');
    await expect(page.getByRole('tablist', { name: 'Gatehouse operator tabs' })).toBeVisible();
    await expect(page.getByTestId('tab-qr')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('panel-qr')).toBeVisible();
  });

  test('tab switching renders the matching panel', async ({ page }) => {
    await page.goto('/gatehouse');

    await page.getByTestId('tab-manual').click();
    await expect(page.getByTestId('panel-manual')).toBeVisible();
    await expect(page.getByTestId('tab-manual')).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('tab-walkin').click();
    await expect(page.getByTestId('panel-walkin')).toBeVisible();
    await expect(page.getByTestId('walkin-name')).toBeVisible();
    await expect(page.getByTestId('tab-walkin')).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('tab-visits').click();
    await expect(page.getByTestId('panel-visits')).toBeVisible();
    await expect(page.getByTestId('open-visits-search')).toBeVisible();
    await expect(page.getByTestId('tab-visits')).toHaveAttribute('aria-selected', 'true');
  });

  test('walk-in registration submits and surfaces a success card', async ({ page }) => {
    await page.goto('/gatehouse');
    await page.getByTestId('tab-walkin').click();

    await page.getByTestId('walkin-name').fill('FedEx Driver');
    await page.getByTestId('walkin-document').fill('11222333000181');
    await page.getByTestId('walkin-phone').fill('11988887777');
    await page.getByTestId('walkin-purpose').fill('Delivery');

    await selectFirstApartmentOption(page, 'walkin-apartment');

    await page.getByTestId('walkin-submit-btn').click();

    await expect(page.getByText(/checked in successfully/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Audit Review', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, demoAdminEmail, demoAdminPassword);
  });

  test('audit page loads with filter row and export button', async ({ page }) => {
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Audit filters' })).toBeVisible();
  });

  test('filter by override state narrows visible rows', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForResponse(
      (res) => res.url().includes('/api/v1/entry-log') && res.request().method() === 'GET',
      { timeout: 10_000 },
    );

    await page.locator('select').nth(1).selectOption('entered_override');
    await page.waitForTimeout(500);

    const badges = page.locator('ce-entry-state-badge .label');
    const count = await badges.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(badges.nth(i)).toHaveText(/Override/i);
      }
    }
  });

  test('CSV export downloads a file with millisecond timestamps', async ({ page }) => {
    await page.goto('/audit');
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.getByRole('button', { name: /Export CSV/i }).click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/entry-log-\d{4}-\d{2}-\d{2}\.csv/);

    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import('fs');
    const content = fs.readFileSync(path!, 'utf8');
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}/);
  });

  test('audit row shows state badge and renders override border', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForResponse(
      (res) => res.url().includes('/api/v1/entry-log') && res.request().method() === 'GET',
      { timeout: 10_000 },
    );
    const rowCount = await page.locator('ce-audit-row').count();
    if (rowCount === 0) {
      await expect(page.getByText(/No entries match/i)).toBeVisible();
    } else {
      await expect(page.locator('ce-entry-state-badge').first()).toBeVisible();
    }
  });
});

test.describe('Consent Policy Editor', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, demoAdminEmail, demoAdminPassword);
  });

  test('editor page renders with 4 toggle rows and Save button disabled when clean', async ({ page }) => {
    await page.goto('/admin/consent-policy');
    await expect(page.getByRole('heading', { name: 'Consent Policy' })).toBeVisible();
    await expect(page.locator('button[role="switch"]')).toHaveCount(4);
    const saveBtn = page.getByRole('button', { name: 'Save policy' });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
  });

  test('toggle dirty change enables Save button; Save calls PUT and surfaces toast', async ({ page }) => {
    await page.goto('/admin/consent-policy');
    await expect(page.getByRole('heading', { name: 'Consent Policy' })).toBeVisible();

    const putPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/consent-policy') &&
        res.request().method() === 'PUT',
      { timeout: 10_000 },
    );

    await page.locator('button[role="switch"]').first().click();
    const saveBtn = page.getByRole('button', { name: 'Save policy' });
    await expect(saveBtn).toBeEnabled();

    await saveBtn.click();
    const put = await putPromise;
    expect(put.ok()).toBe(true);
    await expect(page.getByText('Policy updated')).toBeVisible({ timeout: 5_000 });
  });
});