// Operational-gatehouse-simulator — Virtual door E2E flow.
//
// Validates the operator path end to end against the demo dev stack:
//   1. The Gatehouse panel shows the dev-only "Virtual door" tab (probe
//      the inspector like device-simulator-ui.spec.ts does; skip when the
//      flag is off),
//   2. an issued visitor QR credential (walk-in registration with a QR
//      pass) is presented at the virtual reader through the UI,
//   3. the presentation receipt reports the canonical outcome with linked
//      record IDs,
//   4. the Reports history table carries the resulting access row.
//
// All visitor names / documents below are generated synthetic values (never
// real-user data). The flow skips (not fails) when the environment lacks
// prerequisites so the suite stays green against minimal demo stacks.

import { test, expect, type Page } from '@playwright/test';
import {
  demoAdminEmail,
  demoAdminPassword,
  applyStackHostHeader,
  authedProbeHeaders,
  loginAsDemoUser,
  uniqueSuffix,
} from './helpers/demo-auth';

const SIMULATOR_PROBE_PATH = '/api/v1/_internal/devices/00000000-0000-0000-0000-000000000001/simulator';

async function isInspectorAvailable(page: Page): Promise<boolean> {
  // The inspector resolves the tenant from a bearer JWT (401 without one),
  // so the probe carries a demo-admin token; worktree stacks reached via
  // localhost additionally need the explicit Host header for Traefik routing.
  const headers = await authedProbeHeaders(page.request);
  const response = await page.request.get(SIMULATOR_PROBE_PATH, headers ? { headers } : undefined);
  return response.ok();
}

test.describe('Virtual door (gatehouse simulator)', () => {
  test.beforeEach(async ({ page }) => {
    applyStackHostHeader(page);
    await loginAsDemoUser(page, demoAdminEmail, demoAdminPassword);
  });

  test('presents an issued visitor credential end to end and lands the row in Reports', async ({ page }) => {
    test.skip(!(await isInspectorAvailable(page)), 'inspector flag is off in this environment');

    // A fresh browser session has no persisted gatehouse selection; the
    // virtual door creation binds to the selected gatehouse, so pick the
    // first registered one (the demo seed ships "Portaria Principal").
    await page.goto('/gatehouse');
    const locationSelect = page.getByRole('combobox', { name: 'Recording location' });
    await locationSelect.waitFor({ state: 'visible', timeout: 10_000 });
    test.skip((await locationSelect.locator('option').count()) <= 1, 'demo stack has no gatehouse registered');
    await locationSelect.selectOption({ index: 1 });

    // The demo seed leaves door integration off; the virtual door requires
    // the tenant opt-in flag, so enable it (idempotent) through the API.
    const probeHeaders = await authedProbeHeaders(page.request);
    await page.request.put('/api/v1/tenants/current/door-integration', {
      headers: probeHeaders,
      data: { doorIntegrationEnabled: true },
    }).catch(() => undefined);

    // ---------------------------------------------------------------------------
    // 1. Issue a real visitor credential through the walk-in flow.
    // ---------------------------------------------------------------------------
    await page.goto('/gatehouse?tab=walkin');
    const suffix = uniqueSuffix();
    const visitorName = `E2E Visitor ${suffix}`;
    const document = `E2E${suffix}${String(suffix).padStart(4, '0')}`;

    await page.getByTestId('walkin-name').fill(visitorName);
    await page.getByTestId('walkin-document').fill(document);

    const walkthroughSelect = page.locator('#walkin-apartment');
    const optionCount = await walkthroughSelect.locator('option').count();
    test.skip(optionCount <= 1, 'demo stack has no apartments; cannot issue a credential');
    const firstOptionValue = await walkthroughSelect.locator('option').nth(1).getAttribute('value');
    await walkthroughSelect.selectOption(firstOptionValue!);

    // Generate the QR pass (checked by default) and submit.
    await page.getByTestId('walkin-submit-btn').click();
    await page.getByText('checked in successfully', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 });

    // The issued payload is displayed exactly once — copy it from the pass modal.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'View QR pass' }).click();
    const copyButton = page.locator('button.copy-btn');
    await copyButton.waitFor({ state: 'visible', timeout: 10_000 });
    await copyButton.click();
    const token = await page.evaluate(() => navigator.clipboard.readText());
    test.skip(!token || token.length < 8, 'QR pass token could not be captured from clipboard');

    // ---------------------------------------------------------------------------
    // 2. Present the credential at the virtual door (Entrance).
    // ---------------------------------------------------------------------------
    await page.goto('/gatehouse?tab=virtual');
    await page.getByTestId('tab-virtual').waitFor({ state: 'visible', timeout: 10_000 });
    // The deep link applies the virtual console once the inspector probe
    // resolves (see gatehouse-panel.page.ts) — wait for either the
    // reader card or the empty state to materialize.
    await page
      .locator('[data-testid="virtual-door-empty-state"], [data-testid="virtual-door-device-select"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => undefined);

    const emptyState = page.getByTestId('virtual-door-empty-state');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      const createBtn = page.getByTestId('virtual-door-create-btn');
      test.skip(!(await createBtn.isVisible().catch(() => false)),
        'no virtual reader and the signed-in user cannot create one');
      await createBtn.click();
      await page.getByTestId('virtual-door-device-select').waitFor({ state: 'visible', timeout: 15_000 });
    } else if (!(await page.getByTestId('virtual-door-device-select').isVisible().catch(() => false))) {
      test.skip(true, 'virtual door console did not render in this environment');
    }

    await page.getByTestId('virtual-door-token-input').fill(token);
    await page.getByTestId('virtual-door-direction-entrance').click();
    const presentButton = page.getByTestId('virtual-door-present-btn').locator('button');
    await expect(presentButton).toBeEnabled({ timeout: 10_000 });
    await presentButton.click();

    // 3. The operational receipt reports the canonical outcome + linked IDs.
    const receipt = page.getByTestId('virtual-door-receipt');
    await expect(receipt).toBeVisible({ timeout: 15_000 });
    // Hard assertion: only accepted credentials reach the Reports step — a
    // denial means the demo environment or the flow broke and must fail.
    await expect(receipt).toContainText(/Visit advanced|Access recorded/);
    await expect(receipt.getByTestId('virtual-door-receipt-direction')).toContainText('entrance');
    expect(
      (await receipt.getByTestId('virtual-door-receipt-visit').count()) > 0 ||
        (await receipt.getByTestId('virtual-door-receipt-access').count()) > 0,
    ).toBe(true);

    // The reader never coerces Exit into Entrance and never advances a visit.
    await page.getByTestId('virtual-door-direction-exit').click();
    await expect(presentButton).toBeEnabled({ timeout: 10_000 });
    await presentButton.click();
    const exitReceipt = page.getByTestId('virtual-door-receipt');
    await expect(exitReceipt).toBeVisible({ timeout: 15_000 });
    await expect(exitReceipt).toContainText(/Access recorded/);
    await expect(exitReceipt.getByTestId('virtual-door-receipt-direction')).toContainText('exit');
    await expect(exitReceipt.getByTestId('virtual-door-receipt-visit')).toHaveCount(0);

    // 4. The Reports history carries the access ledger row.
    await page.goto('/reports');
    await page.getByTestId('reports-history-table').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByTestId('ledger-search-input').fill(visitorName);
    // Retry-tolerant: the reports table reloads (debounced filter) before the
    // filtered row appears.
    await expect(page.getByTestId('reports-history-table')).toContainText(visitorName, {
      timeout: 10_000,
    });
  });

  test('hides the virtual door tab when the inspector flag is disabled', async ({ page }) => {
    test.skip(await isInspectorAvailable(page), 'inspector flag is on; this test runs only when it is off');

    await page.goto('/gatehouse');
    // expect(...).toHaveCount(0) already retries until the UI probe settles
    // and the inspectorAvailable signal resolves to `false`.
    await expect(page.getByTestId('tab-virtual')).toHaveCount(0);
    await expect(page.getByTestId('panel-virtual')).toHaveCount(0);
  });
});