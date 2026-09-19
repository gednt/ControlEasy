import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AccessCredentialSummary,
  AccessEventSummary,
  IssueCredentialRequest,
  IssueCredentialResponse,
  LookupResponse,
  ManualAccessRequest,
  ManualAccessResponse,
  ManualLookupCriterion,
  RefusedScanSummary,
  ReplaceCredentialResponse,
  ScanResult,
} from './access-control.types';

@Injectable({ providedIn: 'root' })
export class GatewayControlService {
  private readonly http = inject(HttpClient);

  listCredentials(subjectType?: string, subjectId?: string, status?: string): Observable<AccessCredentialSummary[]> {
    const params: Record<string, string> = {};
    if (subjectType) params['subjectType'] = subjectType;
    if (subjectId) params['subjectId'] = subjectId;
    if (status) params['status'] = status;
    return this.http.get<AccessCredentialSummary[]>('/api/v1/access-credentials', { params });
  }

  issueCredential(payload: IssueCredentialRequest): Observable<IssueCredentialResponse> {
    return this.http.post<IssueCredentialResponse>('/api/v1/access-credentials', payload);
  }

  revokeCredential(id: string, reasonCode?: string, reasonText?: string): Observable<void> {
    return this.http.post<void>(`/api/v1/access-credentials/${id}/revoke`, { reasonCode, reasonText });
  }

  replaceCredential(id: string): Observable<ReplaceCredentialResponse> {
    return this.http.post<ReplaceCredentialResponse>(`/api/v1/access-credentials/${id}/replace`, {});
  }

  recordScan(payload: {
    qrPayload: string;
    direction: 'entrance' | 'exit';
    scanAttemptId: string;
    gatehouseId?: string | null;
    confirmDuplicate?: boolean;
  }): Observable<ScanResult> {
    return this.http.post<ScanResult>('/api/v1/access-events/scans', payload);
  }

  searchSubject(criterion: ManualLookupCriterion): Observable<LookupResponse> {
    return this.http.post<LookupResponse>('/api/v1/access-subjects/search', {
      criterion: criterion.type,
      value: criterion.value,
      unit: criterion.unit,
    });
  }

  recordManual(payload: ManualAccessRequest): Observable<ManualAccessResponse> {
    return this.http.post<ManualAccessResponse>('/api/v1/access-events/manual', {
      lookupAuditId: payload.lookupAuditId,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      direction: payload.direction,
      gatehouseId: payload.gatehouseId ?? null,
    });
  }

  listEvents(): Observable<AccessEventSummary[]> {
    return this.http.get<AccessEventSummary[]>('/api/v1/access-events');
  }

  listRefusedAttempts(): Observable<RefusedScanSummary[]> {
    return this.http.get<RefusedScanSummary[]>('/api/v1/access-events/refused-attempts');
  }
}
