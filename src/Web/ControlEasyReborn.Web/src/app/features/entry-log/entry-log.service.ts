import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Phase 13 entry-state discriminator. Includes the Phase 11 defensive state
 * (`entered_without_consent`) used when a visitor declines consent.
 */
export type EntryState =
  | 'entered_with_consent'
  | 'entered_override'
  | 'gatehouse_only'
  | 'entered_without_consent'
  | 'exited';

/** Subject categories used by the entry-log endpoint.
 * Note: backend `EntryLogRequestValidator` accepts underscore forms. */
export type SubjectType = 'dweller' | 'visitor' | 'service_provider' | 'vehicle';

/** Hardcoded override reasons per ROADMAP — no free-text. */
export type OverrideReason = 'emergency' | 'vouched';

/**
 * Backend returns Guid ids; we serialize as strings on the wire to match the
 * existing handwritten service pattern (see PhotosApiService).
 */
export interface EntryLogResponse {
  id: string;
  tenantId: string;
  entryState: EntryState;
  overrideReason?: OverrideReason | undefined;
  photoId?: string | undefined;
  subjectType: SubjectType;
  subjectName?: string | undefined;
  subjectDocument?: string | undefined;
  performedByProfileId?: string | undefined;
  recordedAt: string;
}

export interface AuditFilters {
  entryState?: EntryState | undefined;
  subjectType?: SubjectType | undefined;
  fromUtc?: string | undefined;
  toUtc?: string | undefined;
  skip: number;
  take: number;
}

/**
 * Read-only handwritten service for the entry-log endpoints over the
 * append-only ConsentAuditLog (privacy-consent audit trail).
 *
 * Endpoints used:
 *   GET  /api/v1/entry-log            — list entries with optional filters
 *   GET  /api/v1/entry-log/export     — CSV download of current filter
 *
 * The legacy POST write path was retired: walk-in registration uses
 * POST /api/v1/visits (checkInNow) and operational entry events are recorded
 * by the AccessControl module (POST /api/v1/access-events/*).
 *
 * Phase 13 deviation: backend does NOT return X-Total-Count. Use entries.length
 * for pagination display. If/when the backend adds the header, swap to read
 * `res.headers.get('X-Total-Count')` and add a `total` field.
 */
@Injectable({ providedIn: 'root' })
export class EntryLogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/entry-log';

  list(filters: AuditFilters): Observable<EntryLogResponse[]> {
    let params = new HttpParams().set('skip', filters.skip.toString()).set('take', filters.take.toString());
    if (filters.entryState) {
      params = params.set('entryState', filters.entryState);
    }
    if (filters.subjectType) {
      params = params.set('subjectType', filters.subjectType);
    }
    if (filters.fromUtc) {
      params = params.set('fromUtc', filters.fromUtc);
    }
    if (filters.toUtc) {
      params = params.set('toUtc', filters.toUtc);
    }
    return this.http.get<EntryLogResponse[]>(this.baseUrl, { params });
  }

  export(filters: AuditFilters): Observable<Blob> {
    let params = new HttpParams();
    if (filters.entryState) {
      params = params.set('entryState', filters.entryState);
    }
    if (filters.subjectType) {
      params = params.set('subjectType', filters.subjectType);
    }
    if (filters.fromUtc) {
      params = params.set('fromUtc', filters.fromUtc);
    }
    if (filters.toUtc) {
      params = params.set('toUtc', filters.toUtc);
    }
    return this.http.get(`${this.baseUrl}/export`, {
      params,
      responseType: 'blob',
    });
  }
}
