import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DoorUnlockRequest,
  DoorUnlockResponse,
} from './door-unlock.types';

// Thin Angular wrapper around the Devices API. Phase 23 ships the service
// shell only — no UI consumes it yet. Phase 24 (admin) and Phase 26 (porteiro)
// wire this into the administration page and the porteiro unlock panel.
//
// The canonical signature scheme is documented in
// .planning/phases/23-device-foundation-simulator-harness/23-CONTEXT.md
// under "Security machinery (DOOR-02)":
//   canonical = POST\n{deviceId}\n{timestampIso8601Utc}\n{nonceBase64Url}\n{bodyHashHexLower}
//   signature = Base64Url(HMAC_SHA256(perTenantKey, canonical))
// The signature is computed in the Angular caller (Porteiro device) — this
// service just transmits the bytes.
@Injectable({ providedIn: 'root' })
export class DevicesApiService {
  private readonly http = inject(HttpClient);

  unlock(deviceId: string, request: DoorUnlockRequest): Observable<DoorUnlockResponse> {
    return this.http.post<DoorUnlockResponse>(`/api/v1/devices/${deviceId}/unlock`, request);
  }

  list(): Observable<unknown[]> {
    return this.http.get<unknown[]>('/api/v1/devices');
  }

  get(deviceId: string): Observable<unknown> {
    return this.http.get<unknown>(`/api/v1/devices/${deviceId}`);
  }
}