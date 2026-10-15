import type { FullConfig } from '@playwright/test';

// The dev stack serves a self-signed certificate (docker/reverse-proxy/certs).
// Node's global fetch rejects it; disable verification for the health poll
// only (dev-only process, cert is our own generated one).
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'https://localhost:8443';
  const email = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@controleasy.app';
  const password = process.env['E2E_ADMIN_PASSWORD'] ?? 'demo123';

  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(`${baseURL}/api/v1/security/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Worktree stacks reached via localhost keep Traefik routing intact
          // through an explicit Host header (see applyStackHostHeader).
          ...(process.env['E2E_STACK_HOST'] ? { host: process.env['E2E_STACK_HOST'] } : {}),
        },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // stack still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Demo stack login not ready at ${baseURL} after 3 minutes.`);
}

export default globalSetup;
