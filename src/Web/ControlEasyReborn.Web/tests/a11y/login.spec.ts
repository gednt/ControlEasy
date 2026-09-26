import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login page has no serious/critical a11y violations (light)', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to ControlEasy' })).toBeVisible();
  await page.waitForTimeout(500);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    v => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(violations).toHaveLength(0);
});

test('login page has no serious/critical a11y violations (dark)', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to ControlEasy' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await page.waitForTimeout(500);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    v => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(violations).toHaveLength(0);
});