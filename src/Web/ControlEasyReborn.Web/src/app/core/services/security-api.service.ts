import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  tenantId: string;
  profileId: string;
  roles: string[] | string;
  permissions: string[] | string;
  mustChangePassword: boolean;
  isDemoPersona: boolean;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

export interface TenantLookupResponse {
  tenantId: string;
  slug: string;
  displayName: string;
  userDisplayName: string;
}

export interface TenantSwitchRequest {
  tenantId: string;
}

export interface TenantSwitchResponse {
  token: string;
  refreshToken: string;
  tenantId: string;
  profileId: string;
  roles: string[];
  permissions: string[];
  isDemoPersona: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SessionTenantResponse {
  tenantId: string;
  slug: string;
  displayName: string;
  userDisplayName: string;
}

export interface SessionResponse {
  tenantId: string;
  tenantSlug: string;
  tenantDisplayName: string;
  userDisplayName: string;
  roles: string;
  isDemoPersona: boolean;
  switchableTenants: SessionTenantResponse[];
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetUserPasswordResponse {
  userId: string;
  mustChangePassword: boolean;
  deliveryState: string;
}

export interface StaffMemberResponse {
  userId: string;
  profileId: string | null;
  email: string;
  displayName: string;
  roles: string;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class SecurityApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/security';

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, request);
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.baseUrl}/auth/forgot-password`, { email });
  }

  resetUserPassword(userId: string): Observable<ResetUserPasswordResponse> {
    return this.http.post<ResetUserPasswordResponse>(`${this.baseUrl}/users/${userId}/reset-password`, {});
  }

  listStaff(): Observable<StaffMemberResponse[]> {
    return this.http.get<StaffMemberResponse[]>(`${this.baseUrl}/staff`);
  }

  refresh(refreshToken: string): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${this.baseUrl}/auth/refresh`, { refreshToken });
  }

  lookupTenants(email: string): Observable<TenantLookupResponse[]> {
    const params = new HttpParams().set('email', email);
    return this.http.get<TenantLookupResponse[]>(`${this.baseUrl}/tenants`, { params });
  }

  switchTenant(tenantId: string): Observable<TenantSwitchResponse> {
    return this.http.post<TenantSwitchResponse>(`${this.baseUrl}/tenant-switch`, { tenantId });
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/change-password`, request);
  }

  getSession(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(`${this.baseUrl}/session`);
  }
}