// Mirrors ControlEasyReborn.Modules.Devices.Application.Contracts.DoorUnlockRequest
// and DoorUnlockResponse byte-for-byte. Update both files together when the
// API contract changes (Phase 23 ships the API; Phase 24/26 surface it in
// the porteiro / administration pages).

// Re-exported for the device simulator feature (Phase 27). The generated
// module is the source of truth; the indirection lets consumers import the
// alias from this barrel (the file they already use for the other device
// DTOs) instead of the generated-models path. `export type` is required by
// the project's `isolatedModules: true` setting.
import type { SimulatorFailureMode } from '../../api/models/simulator-failure-mode';
export type { SimulatorFailureMode };

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

// Phase 26 — device-health dashboard (DOOR-12 + DOOR-13).
// Mirrors ControlEasyReborn.Modules.Devices.Application.Contracts.DeviceHealthDto
// (the wire shape served by GET /api/v1/devices/health).

export type DeviceStatus = 'Online' | 'Offline' | 'Degraded';

export interface DeviceHealthDto {
  deviceId: string;
  vendor: string;
  deviceType: string;
  gatehouseId: string | null;
  gatehouseName: string | null;
  status: DeviceStatus;
  statusLabel: string;
  lastHeartbeatAtUtc: string | null;
  errorCount: number;
  eventsSinceLastSuccess: number;
  errorRatePercent: number;
  offlineAfterSeconds: number;
  errorRateThresholdPercent: number;
  isOfflineExceeded: boolean;
}

// Phase 27 (DOOR-15) — device simulator inspector surface (UI only).
// Mirrors the v2.3 backend inspector endpoints shipped in Phase 23/25.
// No backend changes in this phase; the types are inferred from the C#
// DTOs in src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application
// /Abstractions/IDoorSimulatorState.cs and the request bodies in
// SimulatorInspectorEndpoints.cs. Update both files when the API contract
// changes (the OpenAPI generation is the source of truth for path / method
// shape, but the body types are hand-mirrored because the generated
// service returns Observable<void> for these endpoints).

export function simulatorFailureModeLabel(mode: SimulatorFailureMode): string {
  switch (mode) {
    case 0:
      return 'None';
    case 1:
      return 'Always AuthFailed';
    case 2:
      return 'Always DeviceOffline';
    case 3:
      return 'Fails-Then-Recovers';
    default:
      return 'None';
  }
}

// Tuple form for use in template literals and array iteration where
// the index is statically 0..3. Prefer `simulatorFailureModeLabel(mode)`
// for single-value rendering — this is a sibling API for select-option
// rendering.
export const SIMULATOR_FAILURE_MODE_LABELS: readonly [string, string, string, string] = [
  'None',
  'Always AuthFailed',
  'Always DeviceOffline',
  'Fails-Then-Recovers',
];

export interface SimulatedAttempt {
  tenantId: string;
  deviceId: string;
  actorProfileId: string;
  nonce: string;
  timestampUtc: string;
  outcome: string;
  correlationId: string;
  occurredAtUtc: string;
}

export interface EnqueueOfflineResult {
  queued: number;
}

export interface SimulatorQueueItem {
  // Mirrors ControlEasyReborn.Modules.Devices.Application.Contracts.DeviceEventPayload.
  eventType: string;
  occurredAtUtc: string;
  sequenceNumber: number;
  externalEventId: string | null;
  opaqueToken: string | null;
  payloadJson: string | null;
}