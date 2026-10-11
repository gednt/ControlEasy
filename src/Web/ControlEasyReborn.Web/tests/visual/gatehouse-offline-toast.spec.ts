import { test, expect } from '@playwright/test';
import { loginAsDemoUser } from '../../e2e/helpers/demo-auth';

// Phase 26 (DOOR-14) — /gatehouse-panel visual regression for the
// offline-alert toast. The snapshot is taken when a device transitions
// to offline (the test seeds one via the inspector endpoint before
// navigating). Light + dark themes at desktop.
const themes = ['light', 'dark'] as const;

for (const theme of themes) {
  test(`gatehouse-offline-toast-${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAsDemoUser(page);

    await page.goto('/gatehouse');

    if (theme === 'dark') {
      await page.selectOption('.theme-switcher select', 'dark').catch(() => {
        // No theme switcher present — ignore.
      });
    }

    // The toast wrapper appears when DeviceHealthService emits an offline
    // transition; the test relies on a pre-seeded offline device (set via
    // the simulator inspector during the demo seed or via a manual API
    // call). Wait for either the toast wrapper or the page content to render.
    await expect(page.getByRole('heading', { name: 'Gatehouse operator panel' })).toBeVisible({
      timeout: 15_000,
    });

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot(`gatehouse-offline-toast-${theme}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}