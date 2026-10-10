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