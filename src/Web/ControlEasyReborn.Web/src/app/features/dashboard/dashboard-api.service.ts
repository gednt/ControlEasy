import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardStatsResponse {
  totalResidents: number;
  activeResidents: number;
  totalVehicles: number;
  activeVehicles: number;
  totalApartments: number;
  occupiedApartments: number;
  openVisits: number;
  todayVisits: number;
  recentVisits: RecentVisit[];
}

export interface RecentVisit {
  id: string;
  visitorName: string;
  purpose: string | null;
  status: string;
  apartmentLabel: string | null;
  createdAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/dashboard/stats';

  getStats(): Observable<DashboardStatsResponse> {
    return this.http.get<DashboardStatsResponse>(this.baseUrl);
  }
}
