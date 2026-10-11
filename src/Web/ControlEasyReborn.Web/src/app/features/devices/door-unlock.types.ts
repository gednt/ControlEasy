// Mirrors ControlEasyReborn.Modules.Devices.Application.Contracts.DoorUnlockRequest
// and DoorUnlockResponse byte-for-byte. Update both files together when the
// API contract changes (Phase 23 ships the API; Phase 24/26 surface it in
// the porteiro / administration pages).

export type DoorUnlockOutcome =
  | 'success'
  | 'device_offline'
  | 'auth_failed'
  | 'rate_limited'
  | 'unknown_tenant_flag'
  | 'unknown_device'
  | 'device_inactive';

export interface DoorUnlockRequest {
  nonce: string;
  timestampUtc: string;
  signature: string;
  bodyHash: string;
}

export interface DoorUnlockResponse {
  deviceId: string;
  outcome: DoorUnlockOutcome;
  occurredAtUtc: string;
  correlationId: string;
}

export interface DoorUnlockFailureResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
  failureCode?: string;
  correlationId?: string;
}

export const DOOR_UNLOCK_OUTCOMES: ReadonlyArray<DoorUnlockOutcome> = [
  'success',
  'device_offline',
  'auth_failed',
  'rate_limited',
  'unknown_tenant_flag',
  'unknown_device',
  'device_inactive',
];

export function isDoorUnlockOutcome(value: string): value is DoorUnlockOutcome {
  return (DOOR_UNLOCK_OUTCOMES as ReadonlyArray<string>).includes(value);
}

// Phase 24 — DOOR-05/06 device administration types.
// Mirrors the C# DTOs in
// src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/

export interface RedactedConnectionParams {
  redacted: true;
  last4: string;
}

export interface DeviceDetail {
  id: string;
  tenantId: string;
  deviceType: 'reader' | 'controller';
  vendor: string;
  connectionParams: RedactedConnectionParams;
  gatehouseId: string | null;
  gatehouseName: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  removedAtUtc: string | null;
  createdByProfileId: string;
}

export interface DeviceListItem {
  id: string;
  deviceType: 'reader' | 'controller';
  vendor: string;
  gatehouseId: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface RegisterDeviceRequest {
  deviceType: 'reader' | 'controller';
  vendor: string;
  gatehouseId?: string | null;
  connectionParams: Record<string, unknown>;
}

export interface EditDeviceRequest {
  vendor?: string;
  gatehouseId?: string | null;
  connectionParams?: Record<string, unknown>;
}

export interface SetDeviceActivationRequest {
  isActive: boolean;
}

export interface ToggleDoorIntegrationRequest {
  doorIntegrationEnabled: boolean;
}

export interface TenantDoorIntegrationDto {
  tenantId: string;
  doorIntegrationEnabled: boolean;
  doorIntegrationChangedAtUtc: string | null;
  doorIntegrationChangedByProfileId: string | null;
}

// Phase 25 — reader-event ingestion (DOOR-08..11).
// Mirrors the C# DTOs in
// src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/
// and the DeviceEventResultCode enum in
// src/Modules/Devices/ControlEasyReborn.Modules.Devices.Domain/Enums/.

export type DeviceEventType =
  | 'card_read'
  | 'card_denied'
  | 'tamper'
  | 'door_forced'
  | 'reader_reconnected'
  | 'heartbeat';

export type DeviceEventOutcome =
  | 'created_visit'
  | 'advanced_visit'
  | 'matched_dweller'
  | 'denied_attempt'
  | 'replay_duplicate'
  | 'device_inactive'
  | 'tenant_flag_off'
  | 'sequence_conflict'
  | 'reader_reconnected';

export interface DeviceEventPayload {
  eventType: DeviceEventType;
  occurredAtUtc: string;
  sequenceNumber: number;
  externalEventId: string | null;
  opaqueToken?: string | null;
  payloadJson?: string | null;
}

export interface DeviceEventIngestionDto {
  outcome: DeviceEventOutcome;
  existingEventId: string | null;
  visitId: string | null;
  accessEventId: string | null;
  refusedScanAttemptId: string | null;
  occurredAtUtc: string;
  processedAtUtc: string;
}

export interface DeviceEventListItem {
  id: string;
  deviceId: string;
  eventType: DeviceEventType;
  occurredAtUtc: string;
  processedAtUtc: string;
  sequenceNumber: number;
  resultCode: DeviceEventOutcome;
  failureCode: string | null;
  visitId: string | null;
  accessEventId: string | null;
  refusedScanAttemptId: string | null;
}