export type SubjectKind = 'resident' | 'vehicle' | 'visitor';

export interface AccessCredentialSummary {
  id: string;
  tenantId?: string;
  subjectType: SubjectKind;
  subjectId: string;
  method: 'qr';
  status: 'active' | 'replaced' | 'revoked' | 'expired' | 'inactive';
  validFromUtc: string;
  expiresAtUtc: string | null;
  createdAtUtc: string;
  oneTimeQrPayload?: string | null;
}

export interface IssueCredentialRequest {
  subjectType: SubjectKind;
  subjectId: string;
  validFromUtc?: string;
  expiresAtUtc?: string | null;
}

export interface IssueCredentialResponse {
  id: string;
  qrPayload: string;
  oneTimeDisplay: boolean;
}

export interface ReplaceCredentialResponse {
  newCredentialId: string;
  qrPayload: string;
  oneTimeDisplay: boolean;
}

export interface AccessEventSummary {
  id: string;
  subjectType: SubjectKind;
  subjectId: string;
  direction: 'entrance' | 'exit';
  accessMethod: 'qr' | 'manual_lookup';
  occurredAtUtc: string;
  performedByProfileId: string;
  destinationApartmentId: string;
  destinationBlock: string;
  destinationUnit: string;
}

export interface RefusedScanSummary {
  id: string;
  scanAttemptId: string;
  failureCode: string;
  occurredAtUtc: string;
  performedByProfileId: string;
}

export interface ScanResult {
  decision: 'recorded' | 'duplicate_confirmation_required' | 'policy_action_required' | 'refused' | 'unavailable';
  accessEventId: string;
  subjectType: SubjectKind;
  subjectId: string;
  credentialId: string | null;
  lookupAuditId: string | null;
  accessMethod: 'qr' | 'manual_lookup';
  direction: 'entrance' | 'exit';
  policyOutcome: 'permit' | 'requires_action' | 'refused';
  destinationApartmentId: string;
  destinationBlock: string;
  destinationUnit: string;
}

export interface ScanRefusal {
  failureCode:
    | 'invalid_credential'
    | 'credential_inactive'
    | 'subject_inactive'
    | 'destination_required'
    | 'destination_inactive'
    | 'not_authorized'
    | 'policy_action_required'
    | 'duplicate_confirmation_required'
    | 'vehicle_inactive'
    | 'search_too_broad'
    | 'manual_event_orphan_lookup_id';
  decision: ScanResult['decision'];
}

export type ManualLookupType = 'cpf' | 'identity_document' | 'name' | 'apartment' | 'block';

export interface ManualLookupCriterion {
  type: ManualLookupType;
  value: string;
  unit: string | null;
}

export interface ManualLookupRequest {
  criterion: ManualLookupCriterion;
}

export interface ManualLookupResult {
  subjectType: SubjectKind;
  subjectId: string;
  apartmentId?: string | null;
  apartmentBlock?: string | null;
  apartmentUnit?: string | null;
  displayName?: string | null;
  documentMasked?: string | null;
  plate?: string | null;
}

export interface LookupResponse {
  lookupAuditId: string;
  criterion: string;
  resultCountBand: string;
  items: ManualLookupResult[];
}

export interface ManualAccessRequest {
  lookupAuditId: string;
  subjectType: SubjectKind;
  subjectId: string;
  direction: 'entrance' | 'exit';
  gatehouseId?: string | null;
}

export interface ManualAccessResponse {
  decision?: ScanResult['decision'];
  accessEventId: string;
  lookupAuditId: string;
  subjectType: SubjectKind;
  subjectId: string;
  accessMethod: 'manual_lookup';
  direction: 'entrance' | 'exit';
  policyOutcome?: string;
  destinationApartmentId: string;
  destinationBlock: string;
  destinationUnit: string;
}
