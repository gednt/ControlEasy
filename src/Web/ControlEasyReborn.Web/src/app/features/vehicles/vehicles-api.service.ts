import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VehicleResponse {
  id: string;
  tenantId: string;
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  apartmentId: string | null;
  ownerResidentId?: string | null;
  ownerName: string | null;
  vehicleType: string;
  active: boolean;
  createdAtUtc: string;
}

export interface CreateVehicleRequest {
  plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  apartmentId?: string | null;
  ownerResidentId?: string | null;
  ownerName?: string | null;
  vehicleType?: string | null;
}

export interface UpdateVehicleRequest {
  plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  apartmentId?: string | null;
  ownerResidentId?: string | null;
  ownerName?: string | null;
  vehicleType?: string | null;
}

@Injectable({ providedIn: 'root' })
export class VehiclesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/vehicles';

  list(search?: string, skip = 0, take = 50): Observable<VehicleResponse[]> {
    let params = new HttpParams()
      .set('skip', skip.toString())
      .set('take', take.toString());
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<VehicleResponse[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<VehicleResponse> {
    return this.http.get<VehicleResponse>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateVehicleRequest): Observable<VehicleResponse> {
    return this.http.post<VehicleResponse>(this.baseUrl, request);
  }

  update(id: string, request: UpdateVehicleRequest): Observable<VehicleResponse> {
    return this.http.put<VehicleResponse>(`${this.baseUrl}/${id}`, request);
  }
}
