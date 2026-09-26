import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Discriminator for the entity a photo is attached to.
 * Mirrors the categories enforced by the entry-log / consent policy.
 *
 * Mirrors the tenant-scoped categories persisted by the Photos API.
 */
export type PhotoEntityType = 'resident' | 'visitor' | 'vehicle' | 'service-provider';

export interface PhotoResponse {
  id: string;
  tenantId: string;
  filePath: string;
  thumbnailPath: string | null;
  mimeType: string;
  sizeBytes: number;
  capturedAtUtc: string | null;
  createdAtUtc: string;
  deletedAtUtc: string | null;
  entityType?: PhotoEntityType | null;
  entityId?: string | null;
}

export interface PhotoUploadTarget {
  entityType: PhotoEntityType;
  entityId: string;
  capturedAtUtc?: string;
}

/**
 * Thin handwritten service for the Photos module (Phase 11 endpoints).
 *
 * Endpoints used:
 *   POST   /api/v1/photos        — multipart upload (field "file")
 *   GET    /api/v1/photos/{id}   — source blob (photos.read)
 *   DELETE /api/v1/photos/{id}   — soft-delete (photos.delete)
 *
 * Not yet provided by the backend:
 *   GET    /api/v1/photos/{id}/thumbnail  — display uses the source blob
 *                                            with `object-fit: cover` instead
 */
@Injectable({ providedIn: 'root' })
export class PhotosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/photos';

  upload(blob: Blob, fileName: string, target: PhotoUploadTarget): Observable<PhotoResponse> {
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('entityType', target.entityType);
    formData.append('entityId', target.entityId);
    if (target.capturedAtUtc) formData.append('capturedAtUtc', target.capturedAtUtc);
    return this.http.post<PhotoResponse>(this.baseUrl, formData);
  }

  /** Upload with progress events (used by the capture modal progress strip). */
  uploadWithProgress(blob: Blob, fileName: string, target: PhotoUploadTarget): Observable<HttpEvent<PhotoResponse>> {
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('entityType', target.entityType);
    formData.append('entityId', target.entityId);
    if (target.capturedAtUtc) formData.append('capturedAtUtc', target.capturedAtUtc);
    const req = new HttpRequest('POST', this.baseUrl, formData, { reportProgress: true });
    return this.http.request<PhotoResponse>(req);
  }

  get(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}`, { responseType: 'blob' });
  }

  /**
   * Returns a Promise that resolves with the raw Blob. Convenience wrapper for
   * callers that need an `await` instead of subscribing.
   */
  getAsBlob(id: string): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      this.get(id).subscribe({ next: resolve, error: reject });
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Returns the photos attached to an entity in the current tenant.
   */
  list(
    _skip = 0,
    _take = 50,
    _filter?: { entityType?: PhotoEntityType; entityId?: string },
  ): Observable<PhotoResponse[]> {
    let params = new HttpParams().set('skip', _skip.toString()).set('take', _take.toString());
    if (_filter?.entityType) params = params.set('entityType', _filter.entityType);
    if (_filter?.entityId) params = params.set('entityId', _filter.entityId);
    return this.http.get<PhotoResponse[]>(this.baseUrl, { params });
  }
}
