// Phase 22 (TEST-01) — Fix stale headings/labels in module-pages E2E.
//
// Pre-Phase-17 headings/labels asserted UI that no longer exists:
//   - residents: heading "Residents" → now "Resident register", button "+ Add resident" → "Add resident"
//   - visits: heading "Visits" → "Visit register (administrative)", button "+ Add visit" → no such page
//   - vehicles: heading "Vehicles" → "Vehicles", button "+ Add vehicle" → "Add vehicle"
//   - service-providers: heading "Service Providers" → "Service providers", button "+ Add provider" → "Add provider"
//   - administration: heading "Administration" → "Condominium & System Administration", no create button
//
// Note: E2E runs via `npm run e2e` (manual, not CI). See 22-RESEARCH.md Pitfall 3.

import { test, expect } from '@playwright/test';

const modulePages = [
  { path: '/residents', title: 'Resident register', createLabel: 'Add resident' },
  { path: '/visits', title: 'Visit register (administrative)', createLabel: 'Pre-register visit' },
  { path: '/vehicles', title: 'Vehicles', createLabel: 'Add vehicle' },
  { path: '/service-providers', title: 'Service providers', createLabel: 'Add provider' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ce.access_token', 'e2e-token');
    localStorage.setItem('ce.refresh_token', 'e2e-refresh-token');
    localStorage.setItem('ce.tenant_id', '00000000-0000-0000-0000-000000000001');
    localStorage.setItem('ce.profile_id', '00000000-0000-0000-0000-000000000002');
    localStorage.setItem('ce.roles', JSON.stringify(['TenantAdmin']));
    localStorage.setItem(
      'ce.permissions',
      JSON.stringify([
        'residents.read',
        'residents.write',
        'visits.read',
        'visits.write',
        'vehicles.read',
        'vehicles.write',
        'serviceproviders.read',
        'serviceproviders.write',
        'administration.read',
        'administration.write',
      ]),
    );
  });
});

test.describe('Module primary pages', () => {
  for (const pageDef of modulePages) {
    test(`${pageDef.title} page renders heading and create action`, async ({ page }) => {
      await page.goto(pageDef.path);
      await expect(page.getByRole('heading', { name: pageDef.title })).toBeVisible();
      await expect(page.getByRole('button', { name: pageDef.createLabel })).toBeVisible();
    });
  }

  test('administration page renders heading and settings-tab Save button', async ({ page }) => {
    await page.goto('/administration');
    await expect(
      page.getByRole('heading', { name: 'Condominium & System Administration' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save settings' })).toBeVisible();
  });
});