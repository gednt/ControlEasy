import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAsDemoUser } from '../../e2e/helpers/demo-auth';

test('dashboard page has no serious/critical a11y violations', async ({ page }) => {
  await loginAsDemoUser(page);
  await page.goto('/');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.waitForTimeout(500);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    v => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(violations).toHaveLength(0);
});