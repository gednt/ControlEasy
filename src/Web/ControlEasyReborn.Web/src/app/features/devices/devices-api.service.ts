import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DoorUnlockRequest,
  DoorUnlockResponse,
  DeviceDetail,
  DeviceListItem,
  RegisterDeviceRequest,
  EditDeviceRequest,
  SetDeviceActivationRequest,
  ToggleDoorIntegrationRequest,
  TenantDoorIntegrationDto,
} from './door-unlock.types';

// Thin Angular wrapper around the Devices API. Phase 23 ships the service
// shell with unlock/list/get; Phase 24 adds the admin endpoints
// (toggleDoorIntegration, register, update, setActivation, remove) so the
// /administration page can manage devices.
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

  list(): Observable<DeviceListItem[]> {
    return this.http.get<DeviceListItem[]>('/api/v1/devices');
  }

  get(deviceId: string): Observable<DeviceDetail> {
    return this.http.get<DeviceDetail>(`/api/v1/devices/${deviceId}`);
  }

  register(request: RegisterDeviceRequest): Observable<DeviceDetail> {
    return this.http.post<DeviceDetail>('/api/v1/devices', request);
  }

  update(deviceId: string, request: EditDeviceRequest): Observable<DeviceDetail> {
    return this.http.patch<DeviceDetail>(`/api/v1/devices/${deviceId}`, request);
  }

  setActivation(deviceId: string, isActive: boolean): Observable<DeviceDetail> {
    const body: SetDeviceActivationRequest = { isActive };
    return this.http.put<DeviceDetail>(`/api/v1/devices/${deviceId}/activation`, body);
  }

  remove(deviceId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/devices/${deviceId}`);
  }

  toggleDoorIntegration(enabled: boolean): Observable<TenantDoorIntegrationDto> {
    const body: ToggleDoorIntegrationRequest = { doorIntegrationEnabled: enabled };
    return this.http.put<TenantDoorIntegrationDto>(
      '/api/v1/tenants/current/door-integration',
      body
    );
  }
}