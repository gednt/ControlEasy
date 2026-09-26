import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResidentResponse {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  apartmentId: string | null;
  active: boolean;
  createdAtUtc: string;
}

export interface CreateResidentRequest {
  name: string;
  cpf: string;
  email?: string | null;
  phone?: string | null;
  apartmentId?: string | null;
}

export interface UpdateResidentRequest {
  name: string;
  cpf: string;
  email?: string | null;
  phone?: string | null;
  apartmentId?: string | null;
  active?: boolean;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

@Injectable({ providedIn: 'root' })
export class ResidentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/residents';

  list(search?: string, skip = 0, take = 50, apartmentId?: string): Observable<ResidentResponse[]> {
    let params = new HttpParams().set('skip', skip.toString()).set('take', take.toString());

    if (search) {
      params = params.set('search', search);
    }

    if (apartmentId) {
      params = params.set('apartmentId', apartmentId);
    }

    return this.http.get<ResidentResponse[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<ResidentResponse> {
    return this.http.get<ResidentResponse>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateResidentRequest): Observable<ResidentResponse> {
    return this.http.post<ResidentResponse>(this.baseUrl, request);
  }

  update(id: string, request: UpdateResidentRequest): Observable<ResidentResponse> {
    return this.http.put<ResidentResponse>(`${this.baseUrl}/${id}`, request);
  }

  deactivate(
    id: string,
    name: string,
    cpf: string,
    email: string | null,
    phone: string | null,
    apartmentId: string | null,
  ): Observable<ResidentResponse> {
    return this.http.put<ResidentResponse>(`${this.baseUrl}/${id}`, {
      name,
      cpf,
      email: email ?? null,
      phone: phone ?? null,
      apartmentId,
      active: false,
    });
  }
}
