import { test, expect } from '@playwright/test';
import { loginAsDemoUser } from '../../e2e/helpers/demo-auth';

// Dashboard parity = design-system conformance (component + icon adoption).
// The Shift Ledger diverges from mockup/index.html's "Dashboard preview" stat grid;
// that divergence is a surfaced human decision (see .planning/phases/22-*-RESEARCH.md Pitfall 1).
// We assert structural conformance (ce-button + ce-icon visible) rather than pixel parity.

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
];

const themes = ['light', 'dark'] as const;

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`dashboard-${viewport.name}-${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAsDemoUser(page);
      await page.goto('/');
      await expect(page.getByRole('heading').first()).toBeVisible();

      if (theme === 'dark') {
        await page.selectOption('.theme-switcher select', 'dark');
      }

      await expect(page.locator('ce-button').first()).toBeVisible();
      await expect(page.locator('ce-icon').first()).toBeVisible();

      await expect(page).toHaveScreenshot(`dashboard-${viewport.name}-${theme}.png`, {
        maxDiffPixelRatio: 0.05,
      });
    });
  }
}