import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, throwError, switchMap, tap, catchError } from 'rxjs';
import { SecurityApiService, LoginResponse, TenantLookupResponse } from './security-api.service';
import { TenantSessionService } from './tenant-session.service';

export type { LoginResponse, TenantLookupResponse } from './security-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'ce.access_token';
  private readonly refreshKey = 'ce.refresh_token';
  private readonly emailKey = 'ce.email';
  private readonly tenantIdKey = 'ce.tenant_id';
  private readonly profileIdKey = 'ce.profile_id';
  private readonly rolesKey = 'ce.roles';
  private readonly permissionsKey = 'ce.permissions';
  private readonly mustChangePasswordKey = 'ce.must_change_password';
  private readonly demoPersonaKey = 'ce.demo_persona';

  private readonly api: SecurityApiService;
  private readonly router: Router;
  private readonly tenantSession: TenantSessionService;

  readonly accessToken = signal<string | null>(this.loadFromStorage(this.tokenKey));
  readonly refreshTokenValue = signal<string | null>(this.loadFromStorage(this.refreshKey));
  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly tenantId = signal<string | null>(this.loadFromStorage(this.tenantIdKey));
  readonly profileId = signal<string | null>(this.loadFromStorage(this.profileIdKey));
  readonly roles = signal<string[]>(this.loadJsonFromStorage(this.rolesKey));
  readonly permissions = signal<string[]>(this.loadJsonFromStorage(this.permissionsKey));
  readonly userDisplayName = signal<string | null>(null);
  readonly mustChangePassword = signal(this.loadMustChangePassword());
  readonly isDemoPersona = signal(this.loadDemoPersonaFromStorage());

  private pendingCurrentPassword: string | null = null;

  readonly isPlatformAdmin = computed(() => this.roles().includes('PlatformAdmin'));
  readonly isTenantAdmin = computed(() => this.roles().includes('TenantAdmin'));

  constructor(api: SecurityApiService, router: Router, tenantSession: TenantSessionService) {
    this.api = api;
    this.router = router;
    this.tenantSession = tenantSession;
    const existingToken = this.accessToken();
    if (existingToken) {
      this.syncClaimsFromToken(existingToken);
      if (
        this.roles().includes('TenantAdmin') &&
        !this.hasPermission('Access.Control.Issue') &&
        this.refreshTokenValue()
      ) {
        this.refreshAuth().subscribe({ error: () => {} });
      }
    }
  }

  postLoginRoute(): string {
    return this.isPlatformAdmin() ? '/platform/condominiums' : '/';
  }

  loadSession(): void {
    if (!this.isAuthenticated()) return;

    this.api.getSession().subscribe({
      next: (session) => {
        this.tenantSession.applySession(session);
        this.setDemoPersona(session.isDemoPersona);
      },
      error: () => {
        this.tenantSession.clear();
      },
    });
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.login({ email, password }).pipe(
      tap((response) => {
        this.setTokens(response.token, response.refreshToken);
        this.tenantId.set(response.tenantId);
        this.profileId.set(response.profileId);
        this.roles.set(this.normalizeRoles(response.roles));
        this.permissions.set(this.normalizePermissions(response.permissions));
        this.setMustChangePassword(response.mustChangePassword);
        if (response.mustChangePassword) {
          this.pendingCurrentPassword = password;
        }
        this.setDemoPersona(response.isDemoPersona);
        this.tenantSession.clear();
        this.saveToStorage(this.tenantIdKey, response.tenantId);
        this.saveToStorage(this.profileIdKey, response.profileId);
        this.saveJsonToStorage(this.rolesKey, this.roles());
        this.saveJsonToStorage(this.permissionsKey, this.permissions());
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.api.changePassword({ currentPassword, newPassword }).pipe(
      tap(() => {
        this.setMustChangePassword(false);
        this.pendingCurrentPassword = null;
      }),
    );
  }

  getPendingCurrentPassword(): string | null {
    return this.pendingCurrentPassword;
  }

  refreshAuth(): Observable<string | null> {
    const refresh = this.refreshTokenValue();
    if (!refresh) {
      this.logout();
      return of(null);
    }
    return this.api.refresh(refresh).pipe(
      tap((response) => {
        this.setTokens(response.token, response.refreshToken);
      }),
      switchMap(() => of(this.accessToken())),
      catchError(() => {
        this.logout();
        return of(null);
      }),
    );
  }

  switchTenant(tenantId: string): Observable<void> {
    return this.api.switchTenant(tenantId).pipe(
      tap((response) => {
        this.setTokens(response.token, response.refreshToken);
        this.tenantId.set(response.tenantId);
        this.profileId.set(response.profileId);
        this.roles.set(this.normalizeRoles(response.roles));
        this.permissions.set(this.normalizePermissions(response.permissions));
        this.saveToStorage(this.tenantIdKey, response.tenantId);
        this.saveToStorage(this.profileIdKey, response.profileId);
        this.saveJsonToStorage(this.rolesKey, this.roles());
        this.saveJsonToStorage(this.permissionsKey, this.permissions());
        this.setDemoPersona(response.isDemoPersona);
        this.loadSession();
      }),
      switchMap(() => of(void 0)),
    );
  }

  lookupTenants(email: string): Observable<TenantLookupResponse[]> {
    return this.api.lookupTenants(email);
  }

  logout(): void {
    this.accessToken.set(null);
    this.refreshTokenValue.set(null);
    this.tenantId.set(null);
    this.profileId.set(null);
    this.roles.set([]);
    this.permissions.set([]);
    this.mustChangePassword.set(false);
    this.pendingCurrentPassword = null;
    this.setDemoPersona(false);
    this.tenantSession.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.refreshKey);
      localStorage.removeItem(this.tenantIdKey);
      localStorage.removeItem(this.profileIdKey);
      localStorage.removeItem(this.rolesKey);
      localStorage.removeItem(this.permissionsKey);
      localStorage.removeItem(this.mustChangePasswordKey);
    }
    this.router.navigate(['/login']);
  }

  setToken(token: string): void {
    this.accessToken.set(token);
    this.saveToStorage(this.tokenKey, token);
    this.syncClaimsFromToken(token);
  }

  getRememberedEmail(): string | null {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(this.emailKey)
      : null;
  }

  setRememberedEmail(email: string, remember: boolean): void {
    if (typeof localStorage === 'undefined') return;
    if (remember) {
      localStorage.setItem(this.emailKey, email);
    } else {
      localStorage.removeItem(this.emailKey);
    }
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken.set(accessToken);
    this.refreshTokenValue.set(refreshToken);
    this.saveToStorage(this.tokenKey, accessToken);
    this.saveToStorage(this.refreshKey, refreshToken);
    this.syncClaimsFromToken(accessToken);
  }

  private syncClaimsFromToken(token: string): void {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return;
      const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
      if (typeof atob !== 'function') return;
      const json = atob(base64);
      if (!json) return;
      const payload = JSON.parse(json);
      if (payload.permissions) {
        const perms = Array.isArray(payload.permissions) ? payload.permissions : [payload.permissions];
        this.permissions.set(perms);
        this.saveJsonToStorage(this.permissionsKey, perms);
      }
      if (payload.roles) {
        const roles = Array.isArray(payload.roles) ? payload.roles : [payload.roles];
        this.roles.set(roles);
        this.saveJsonToStorage(this.rolesKey, roles);
      }
    } catch {
      // Ignore token parse failure
    }
  }

  private loadFromStorage(key: string): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }

  private saveToStorage(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  private loadJsonFromStorage(key: string): string[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveJsonToStorage(key: string, value: string[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  setDemoPersona(value: boolean): void {
    this.isDemoPersona.set(value);
    if (typeof localStorage !== 'undefined') {
      if (value) {
        localStorage.setItem(this.demoPersonaKey, 'true');
      } else {
        localStorage.removeItem(this.demoPersonaKey);
      }
    }
  }

  private loadDemoPersonaFromStorage(): boolean {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(this.demoPersonaKey) === 'true';
  }

  private setMustChangePassword(value: boolean): void {
    this.mustChangePassword.set(value);
    if (typeof localStorage !== 'undefined') {
      if (value) {
        localStorage.setItem(this.mustChangePasswordKey, 'true');
      } else {
        localStorage.removeItem(this.mustChangePasswordKey);
      }
    }
  }

  private loadMustChangePassword(): boolean {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(this.mustChangePasswordKey) === 'true';
  }

  private normalizeRoles(roles: string[] | string): string[] {
    if (Array.isArray(roles)) {
      return roles;
    }
    return roles.split(',').map((role) => role.trim()).filter(Boolean);
  }

  private normalizePermissions(permissions: string[] | string): string[] {
    if (Array.isArray(permissions)) {
      return permissions;
    }
    return permissions.split(',').map((permission) => permission.trim()).filter(Boolean);
  }
}