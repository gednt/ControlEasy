import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditLogResponse {
  id: string;
  tenantId: string;
  category: string;
  action: string;
  entityType: string;
  entityId: string;
  severity: 'Info' | 'Warning' | 'SecurityAlert' | string;
  performedByUserId?: string;
  performedByName: string | null;
  details: string | null;
  metadataJson: string | null;
  createdAtUtc: string;
}

export interface CondominiumSettingsDto {
  id: string;
  tenantId: string;
  visitDurationMinutes: number;
  requireShiftHandoverNotes: boolean;
  defaultShiftLengthHours: number;
  emergencyContactPhone: string | null;
  allowedVisitorStartHour: string;
  allowedVisitorEndHour: string;
  autoCheckoutAtMidnight: boolean;
  maxActiveVisitorsPerUnit: number;
  photoRequiredVisitors: boolean;
  photoRequiredProviders: boolean;
  photoRequiredResidents: boolean;
  allowOverrideOnRefusal: boolean;
  overdueVisitAlertMinutes: number;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface UpdateCondominiumSettingsDto {
  visitDurationMinutes: number;
  requireShiftHandoverNotes: boolean;
  defaultShiftLengthHours: number;
  emergencyContactPhone?: string | null;
  allowedVisitorStartHour: string;
  allowedVisitorEndHour: string;
  autoCheckoutAtMidnight: boolean;
  maxActiveVisitorsPerUnit: number;
  photoRequiredVisitors: boolean;
  photoRequiredProviders: boolean;
  photoRequiredResidents: boolean;
  allowOverrideOnRefusal: boolean;
  overdueVisitAlertMinutes: number;
}

export interface AuditLogQueryParams {
  category?: string;
  severity?: string;
  entityType?: string;
  action?: string;
  fromUtc?: string;
  toUtc?: string;
  searchTerm?: string;
  skip?: number;
  take?: number;
}

export interface ConfigurationResponse {
  id: string;
  tenantId: string;
  key: string;
  value: string;
  description: string | null;
  createdAtUtc: string;
}

export interface CreateConfigurationRequest {
  key: string;
  value: string;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdministrationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/administration';

  getSettings(): Observable<CondominiumSettingsDto> {
    return this.http.get<CondominiumSettingsDto>(`${this.baseUrl}/settings`);
  }

  updateSettings(dto: UpdateCondominiumSettingsDto): Observable<CondominiumSettingsDto> {
    return this.http.put<CondominiumSettingsDto>(`${this.baseUrl}/settings`, dto);
  }

  listAuditLogs(query?: AuditLogQueryParams): Observable<AuditLogResponse[]> {
    let params = new HttpParams();
    if (query?.skip !== undefined) params = params.set('skip', query.skip.toString());
    if (query?.take !== undefined) params = params.set('take', query.take.toString());
    if (query?.category) params = params.set('category', query.category);
    if (query?.severity) params = params.set('severity', query.severity);
    if (query?.entityType) params = params.set('entityType', query.entityType);
    if (query?.action) params = params.set('action', query.action);
    if (query?.fromUtc) params = params.set('fromUtc', query.fromUtc);
    if (query?.toUtc) params = params.set('toUtc', query.toUtc);
    if (query?.searchTerm) params = params.set('searchTerm', query.searchTerm);

    return this.http.get<AuditLogResponse[]>(`${this.baseUrl}/audit-logs`, { params });
  }

  getAuditLogById(id: string): Observable<AuditLogResponse> {
    return this.http.get<AuditLogResponse>(`${this.baseUrl}/audit-logs/${id}`);
  }

  listConfigurations(skip = 0, take = 50): Observable<ConfigurationResponse[]> {
    const params = new HttpParams().set('skip', skip.toString()).set('take', take.toString());
    return this.http.get<ConfigurationResponse[]>(`${this.baseUrl}/configurations`, { params });
  }

  createConfiguration(request: CreateConfigurationRequest): Observable<ConfigurationResponse> {
    return this.http.post<ConfigurationResponse>(`${this.baseUrl}/configurations`, request);
  }
}
