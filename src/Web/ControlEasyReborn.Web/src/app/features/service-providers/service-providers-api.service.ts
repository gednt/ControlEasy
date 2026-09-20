import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ServiceProviderResponse {
  id: string;
  tenantId: string;
  name: string;
  document: string;
  phone: string | null;
  email: string | null;
  serviceType: string | null;
  company: string | null;
  active: boolean;
  createdAtUtc: string;
}

export interface CreateServiceProviderRequest {
  name: string;
  document: string;
  phone?: string | null;
  email?: string | null;
  serviceType?: string | null;
  company?: string | null;
}

export interface UpdateServiceProviderRequest {
  name: string;
  document: string;
  phone?: string | null;
  email?: string | null;
  serviceType?: string | null;
  company?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ServiceProvidersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/service-providers';

  list(search?: string, skip = 0, take = 50): Observable<ServiceProviderResponse[]> {
    let params = new HttpParams().set('skip', skip.toString()).set('take', take.toString());
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<ServiceProviderResponse[]>(this.baseUrl, { params });
  }

  create(request: CreateServiceProviderRequest): Observable<ServiceProviderResponse> {
    return this.http.post<ServiceProviderResponse>(this.baseUrl, request);
  }

  update(id: string, request: UpdateServiceProviderRequest): Observable<ServiceProviderResponse> {
    return this.http.put<ServiceProviderResponse>(`${this.baseUrl}/${id}`, request);
  }

  deactivate(id: string): Observable<ServiceProviderResponse> {
    return this.http.post<ServiceProviderResponse>(`${this.baseUrl}/${id}/deactivate`, null);
  }
}
