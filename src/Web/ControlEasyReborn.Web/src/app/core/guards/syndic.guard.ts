import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Audit review guard. TenantAdmins (syndics) and PlatformAdmins can review
 * the full audit log. Porteiros do not get read access to the historical
 * log — they only register new entries via the gatehouse workflow.
 */
export const syndicGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    void router.navigate(['/login']);
    return false;
  }

  const roles = authService.roles();
  if (roles.includes('TenantAdmin') || roles.includes('PlatformAdmin')) {
    return true;
  }

  void router.navigate(['/']);
  return false;
};
