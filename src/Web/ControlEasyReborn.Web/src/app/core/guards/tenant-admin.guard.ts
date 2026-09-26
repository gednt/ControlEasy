import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Tenant-admin guard. TenantAdmin role only — PlatformAdmins are bounced
 * to their own landing page so they don't accidentally reconfigure a
 * tenant's consent policy without explicit tenant context.
 */
export const tenantAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    void router.navigate(['/login']);
    return false;
  }

  const roles = authService.roles();
  if (roles.includes('TenantAdmin')) {
    return true;
  }

  void router.navigate(['/']);
  return false;
};
