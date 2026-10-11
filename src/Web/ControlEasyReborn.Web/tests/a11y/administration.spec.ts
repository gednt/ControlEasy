import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAsDemoUser } from '../../e2e/helpers/demo-auth';

// Phase 24 — DOOR-05/06 a11y: zero serious/critical Axe violations on the
// /administration page (which now includes the Door Integration section).
test('administration page has no serious/critical a11y violations', async ({ page }) => {
  await loginAsDemoUser(page);
  await page.goto('/administration');
  await expect(page.getByRole('heading', { name: 'Condominium & System Administration' })).toBeVisible();
  await expect(page.locator('[data-test="door-integration"]')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    v => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(violations).toHaveLength(0);
});