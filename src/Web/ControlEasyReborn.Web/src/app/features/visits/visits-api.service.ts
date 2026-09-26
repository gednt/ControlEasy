import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VisitResponse {
  id: string;
  tenantId: string;
  visitorName: string;
  visitorDocument: string;
  visitorPhone: string | null;
  apartmentId: string | null;
  purpose: string | null;
  status: string;
  checkedInAtUtc: string | null;
  checkedOutAtUtc: string | null;
  createdAtUtc: string;
}

export interface CreateVisitRequest {
  visitorName: string;
  visitorDocument: string;
  visitorPhone?: string | null;
  apartmentId?: string | null;
  purpose?: string | null;
  checkInNow?: boolean;
}

@Injectable({ providedIn: 'root' })
export class VisitsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/visits';

  list(status?: string, skip = 0, take = 50): Observable<VisitResponse[]> {
    let params = new HttpParams().set('skip', skip.toString()).set('take', take.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<VisitResponse[]>(this.baseUrl, { params });
  }

  create(request: CreateVisitRequest): Observable<VisitResponse> {
    return this.http.post<VisitResponse>(this.baseUrl, request);
  }

  checkIn(id: string): Observable<VisitResponse> {
    return this.http.post<VisitResponse>(`${this.baseUrl}/${id}/checkin`, {});
  }

  checkOut(id: string): Observable<VisitResponse> {
    return this.http.post<VisitResponse>(`${this.baseUrl}/${id}/checkout`, {});
  }
}
