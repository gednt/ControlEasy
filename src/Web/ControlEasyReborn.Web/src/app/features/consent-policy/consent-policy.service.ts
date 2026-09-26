import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/** Consent-policy subject categories (singular plural form mirrors backend route). */
export type SubjectCategory = 'dwellers' | 'visitors' | 'service-providers' | 'vehicles';

export interface ConsentPolicyResponse {
  id: string;
  tenantId: string;
  subjectCategory: SubjectCategory;
  photoRequired: boolean;
  dwellTimeLimitMinutes?: number | undefined;
  updatedByProfileId?: string | undefined;
  createdAtUtc: string;
  updatedAtUtc?: string | undefined;
}

export interface UpdateConsentPolicyRequest {
  subjectCategory: SubjectCategory;
  photoRequired: boolean;
  dwellTimeLimitMinutes?: number | undefined;
}

/**
 * Handwritten service for the Phase 11/13 consent-policy endpoints.
 *
 * Endpoints used:
 *   GET /api/v1/consent-policy/{subjectCategory} — single category
 *   PUT /api/v1/consent-policy                   — upsert single category
 *
 * Phase 13 deviation: backend only exposes GET by category, no list endpoint.
 * `getAll()` calls the per-category endpoint 4× in parallel and filters 404s.
 * When the backend grows `GET /api/v1/consent-policy`, swap to a single call.
 */
@Injectable({ providedIn: 'root' })
export class ConsentPolicyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/consent-policy';

  private readonly allCategories: SubjectCategory[] = ['dwellers', 'visitors', 'service-providers', 'vehicles'];

  getByCategory(category: SubjectCategory): Observable<ConsentPolicyResponse | null> {
    return this.http.get<ConsentPolicyResponse>(`${this.baseUrl}/${category}`).pipe(catchError(() => of(null)));
  }

  /**
   * Returns every configured consent policy. Missing categories (404) are
   * filtered out — a tenant without a policy row for `vehicles` simply
   * doesn't have a policy for that category yet.
   */
  getAll(): Observable<ConsentPolicyResponse[]> {
    const requests = this.allCategories.map((cat) => this.getByCategory(cat));
    return forkJoin(requests).pipe(map((results) => results.filter((r): r is ConsentPolicyResponse => r !== null)));
  }

  update(request: UpdateConsentPolicyRequest): Observable<ConsentPolicyResponse> {
    return this.http.put<ConsentPolicyResponse>(this.baseUrl, request);
  }

  /**
   * Bulk update helper — fires N parallel PUTs and returns the merged results.
   * When the backend grows a `PUT /api/v1/consent-policy/bulk` endpoint, swap
   * the implementation here without changing call-sites.
   */
  updateAll(policies: UpdateConsentPolicyRequest[]): Observable<ConsentPolicyResponse[]> {
    if (policies.length === 0) {
      return of([]);
    }
    const requests = policies.map((p) => this.update(p));
    return forkJoin(requests);
  }
}
