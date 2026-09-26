import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApartmentResponse {
  id: string;
  tenantId: string;
  block: string;
  unit: string;
  active: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface CreateApartmentRequest {
  block: string;
  unit: string;
}

export interface UpdateApartmentRequest {
  block: string;
  unit: string;
  active: boolean;
}

export function formatApartmentLabel(apartment: ApartmentResponse): string {
  return `${apartment.block}-${apartment.unit}`;
}

@Injectable({ providedIn: 'root' })
export class ApartmentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/apartments';

  list(search?: string, skip = 0, take = 200): Observable<ApartmentResponse[]> {
    let params = new HttpParams().set('skip', skip.toString()).set('take', take.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<ApartmentResponse[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<ApartmentResponse> {
    return this.http.get<ApartmentResponse>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateApartmentRequest): Observable<ApartmentResponse> {
    return this.http.post<ApartmentResponse>(this.baseUrl, request);
  }

  update(id: string, request: UpdateApartmentRequest): Observable<ApartmentResponse> {
    return this.http.put<ApartmentResponse>(`${this.baseUrl}/${id}`, request);
  }

  deactivate(id: string, block: string, unit: string): Observable<ApartmentResponse> {
    return this.update(id, { block, unit, active: false });
  }
}
