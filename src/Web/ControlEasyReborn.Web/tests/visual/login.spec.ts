import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
];

const themes = ['light', 'dark'] as const;

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`login-${viewport.name}-${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Sign in to ControlEasy' })).toBeVisible();

      if (theme === 'dark') {
        await page.getByRole('button', { name: 'Toggle theme' }).click();
      }

      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot(`login-${viewport.name}-${theme}.png`, {
        maxDiffPixelRatio: 0.001,
      });
    });
  }
}