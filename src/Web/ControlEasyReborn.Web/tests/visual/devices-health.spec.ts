import { test, expect } from '@playwright/test';
import { loginAsDemoUser } from '../../e2e/helpers/demo-auth';

// Phase 26 (DOOR-13) — /devices visual regression. Snapshots light + dark
// themes at desktop and mobile viewports. Uses synthetic demo seed only.
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const themes = ['light', 'dark'] as const;

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`devices-health-${viewport.name}-${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAsDemoUser(page);

      await page.goto('/devices');

      if (theme === 'dark') {
        await page.selectOption('.theme-switcher select', 'dark').catch(() => {
          // No theme switcher present — ignore.
        });
      }

      // Wait for either the table or the empty state to render.
      await expect(page.getByRole('heading', { name: 'Device health' })).toBeVisible({ timeout: 15_000 });

      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot(`devices-health-${viewport.name}-${theme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}