import { test, expect, request } from '@playwright/test';
import { loginAsDemoUser } from '../../e2e/helpers/demo-auth';

// Phase 24 — DOOR-05/06 visual regression: /administration with the
// Door Integration section enabled. Snapshots light + dark themes at
// desktop and mobile viewports.
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const themes = ['light', 'dark'] as const;

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`administration-${viewport.name}-${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAsDemoUser(page);

      // Enable Door Integration via the admin API so the section renders
      // its full list/state. Synthetic demo seed only.
      const ctx = await request.newContext({
        baseURL: page.url().replace(/\/login.*$/, '').replace(/\/administration.*$/, ''),
      });
      await ctx.put('/api/v1/tenants/current/door-integration', {
        data: { doorIntegrationEnabled: true },
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        // The flag may already be on; ignore failures for the visual snapshot.
      });

      await page.goto('/administration');

      if (theme === 'dark') {
        await page.selectOption('.theme-switcher select', 'dark').catch(() => {
          // No theme switcher present — ignore.
        });
      }

      await expect(page.locator('[data-test="door-integration"]')).toBeVisible({ timeout: 15_000 });

      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot(`administration-${viewport.name}-${theme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}