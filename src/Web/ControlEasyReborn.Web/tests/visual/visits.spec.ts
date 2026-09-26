import { test, expect } from '@playwright/test';
import { loginAsDemoUser } from '../../e2e/helpers/demo-auth';

// Visits parity = design-system conformance (component + icon adoption).
// Pixel parity is brittle here because the table renders live data from /api/v1/visits.

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
];

const themes = ['light', 'dark'] as const;

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`visits-${viewport.name}-${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAsDemoUser(page);
      await page.goto('/visits');
      await expect(page.getByRole('heading', { name: 'Visit register (administrative)' })).toBeVisible();

      if (theme === 'dark') {
        await page.selectOption('.theme-switcher select', 'dark');
      }

      await expect(page.locator('ce-button').first()).toBeVisible();
      await expect(page.locator('ce-icon').first()).toBeVisible();

      await expect(page).toHaveScreenshot(`visits-${viewport.name}-${theme}.png`, {
        maxDiffPixelRatio: 0.05,
      });
    });
  }
}