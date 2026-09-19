import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GatewayControlService } from './gateway-control.service';
import { AuthService } from '../../core/services/auth.service';
import { AccessCredentialSummary, IssueCredentialRequest, SubjectKind } from './access-control.types';
import { ApartmentsApiService, ApartmentResponse } from '../apartments/apartments-api.service';
import { ResidentsApiService, ResidentResponse } from '../residents/residents-api.service';
import { VehiclesApiService, VehicleResponse, CreateVehicleRequest } from '../vehicles/vehicles-api.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { CeButtonComponent, CeIconComponent, CeModalComponent } from '../../design-system';
import { ToastService } from '../../design-system/components/toast/toast.component';
import { QrPassModalComponent } from './components/qr-pass-modal.component';

type CredentialStatusFilter = 'all' | 'active' | 'revoked' | 'replaced' | 'expired';

@Component({
  selector: 'ce-access-credentials-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CeButtonComponent,
    CeIconComponent,
    CeModalComponent,
    QrPassModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Access credentials</h1>
        <p class="page-subtitle">Manage and issue QR access passes for visitors, residents, and vehicles.</p>
      </div>
      @if (canIssue()) {
        <button class="ce-button variant-primary size-md" (click)="openIssueModal()">+ Issue credential</button>
      }
    </div>

    <div class="filter-tabs">
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'all'"
        (click)="setStatusFilter('all')"
      >
        All
      </button>
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'active'"
        (click)="setStatusFilter('active')"
      >
        Active
      </button>
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'replaced'"
        (click)="setStatusFilter('replaced')"
      >
        Replaced
      </button>
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'revoked'"
        (click)="setStatusFilter('revoked')"
      >
        Revoked
      </button>
    </div>

    @if (pageError()) {
      <div class="page-error" role="alert">{{ pageError() }}</div>
    }

    @if (loading()) {
      <p class="text-secondary">Loading credentials...</p>
    } @else {
      <div class="ce-card">
        <table class="ce-table" aria-label="Credentials table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Subject / Owner</th>
              <th>Apartment</th>
              <th>Method</th>
              <th>Status</th>
              <th>Valid from</th>
              <th>Expires at</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (cred of filteredCredentials(); track cred.id) {
              <tr>
                <td>
                  <span class="subject-tag" [class]="'tag-' + cred.subjectType">
                    {{ subjectTypeLabel(cred.subjectType) }}
                  </span>
                </td>
                <td>
                  <div class="subject-cell">
                    @if (cred.subjectType === 'resident') {
                      <div class="subject-identity">
                        <ce-icon name="user" [size]="15" class="text-indigo" />
                        <strong class="subject-name">{{ getSubjectDisplayName(cred) }}</strong>
                      </div>
                    } @else if (cred.subjectType === 'vehicle') {
                      <div class="subject-identity">
                        <ce-icon name="car" [size]="15" class="text-emerald" />
                        <strong class="subject-name font-mono">{{ getSubjectDisplayName(cred) }}</strong>
                      </div>
                    } @else {
                      <div class="subject-identity">
                        <ce-icon name="user-check" [size]="15" class="text-secondary" />
                        <span class="subject-name">Visitor</span>
                      </div>
                    }
                    <code class="uuid-label text-xs" [title]="cred.subjectId">{{ truncateId(cred.subjectId) }}</code>
                  </div>
                </td>
                <td>
                  @if (getSubjectApartment(cred)) {
                    <span class="apt-badge">
                      <ce-icon name="home" [size]="13" />
                      <span>{{ getSubjectApartment(cred) }}</span>
                    </span>
                  } @else {
                    <span class="text-muted text-xs">—</span>
                  }
                </td>
                <td>
                  <span class="method-tag">{{ cred.method | uppercase }}</span>
                </td>
                <td>
                  <span class="ce-badge" [class]="'badge-' + cred.status">
                    {{ cred.status }}
                  </span>
                </td>
                <td>{{ cred.validFromUtc | date: 'short' }}</td>
                <td>{{ cred.expiresAtUtc ? (cred.expiresAtUtc | date: 'short') : 'Permanent' }}</td>
                <td>
                  <div class="action-cell">
                    @if (cred.status === 'active') {
                      @if (canReplace()) {
                        <button
                          type="button"
                          class="ce-button variant-secondary size-sm"
                          [disabled]="actionInFlight() === cred.id"
                          (click)="onReplace(cred)"
                        >
                          Replace
                        </button>
                      }
                      @if (canRevoke()) {
                        <button
                          type="button"
                          class="ce-button variant-danger size-sm"
                          [disabled]="actionInFlight() === cred.id"
                          (click)="onRevoke(cred)"
                        >
                          Revoke
                        </button>
                      }
                    } @else {
                      <span class="text-muted text-xs">—</span>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="text-secondary empty-cell">No credentials found for this filter.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- Issue Credential Modal -->
    <ce-modal
      [open]="issueModalOpen()"
      title="Issue new QR credential"
      size="lg"
      (openChange)="onIssueModalOpenChange($event)"
    >
      @if (issueError()) {
        <div class="form-error-banner" role="alert">{{ issueError() }}</div>
      }

      <form [formGroup]="issueForm" (ngSubmit)="submitIssue()" id="issue-credential-form" class="issue-form">
        <!-- Subject Type Buttons -->
        <div class="field">
          <span class="field-label">Select credential subject type</span>
          <div class="subject-type-selector">
            <button
              type="button"
              class="type-btn"
              [class.active]="issueForm.get('subjectType')?.value === 'resident'"
              (click)="setSubjectType('resident')"
            >
              <ce-icon name="user" [size]="18" />
              <span>Resident</span>
            </button>
            <button
              type="button"
              class="type-btn"
              [class.active]="issueForm.get('subjectType')?.value === 'vehicle'"
              (click)="setSubjectType('vehicle')"
            >
              <ce-icon name="car" [size]="18" />
              <span>Vehicle</span>
            </button>
            <button
              type="button"
              class="type-btn"
              [class.active]="issueForm.get('subjectType')?.value === 'visitor'"
              (click)="setSubjectType('visitor')"
            >
              <ce-icon name="user-check" [size]="18" />
              <span>Visitor</span>
            </button>
          </div>
        </div>

        <!-- RESIDENT SUBJECT VIEW -->
        @if (issueForm.get('subjectType')?.value === 'resident') {
          <div class="subject-flow-container">
            <label class="field">
              <span class="field-label">Select resident</span>
              <select class="ce-input" [value]="selectedResidentId()" (change)="onResidentSelect($event)">
                <option value="">-- Choose resident --</option>
                @for (r of residents(); track r.id) {
                  <option [value]="r.id">
                    {{ r.name }} {{ r.apartmentId ? '— Apt: ' + getApartmentLabel(r.apartmentId) : '— (No apartment linked)' }}
                  </option>
                }
              </select>
              <span class="field-hint">Choose an existing resident to link this pass.</span>
            </label>

            @if (selectedResident()) {
              <div class="explicit-summary-card resident-theme">
                <div class="summary-card-header">
                  <div class="summary-avatar-badge resident-avatar">
                    <ce-icon name="user" [size]="20" />
                  </div>
                  <div class="summary-header-text">
                    <h4 class="summary-subject-title">{{ selectedResident()!.name }}</h4>
                    <span class="summary-badge-type">Resident Access Pass</span>
                  </div>
                </div>

                <div class="summary-grid">
                  <div class="summary-cell highlight-cell">
                    <span class="cell-label">APARTMENT UNIT</span>
                    <div class="cell-value-group">
                      <ce-icon name="home" [size]="16" class="cell-icon text-indigo" />
                      <strong class="cell-main-val">
                        {{ residentApartmentLabel() }}
                      </strong>
                    </div>
                  </div>

                  <div class="summary-cell">
                    <span class="cell-label">RESIDENT CPF</span>
                    <span class="cell-sub-val font-mono">{{ selectedResident()!.cpf || '—' }}</span>
                  </div>

                  <div class="summary-cell full-width">
                    <span class="cell-label">SUBJECT IDENTIFIER (UUID)</span>
                    <code class="cell-uuid font-mono">{{ selectedResident()!.id }}</code>
                  </div>
                </div>

                @if (!selectedResident()!.apartmentId) {
                  <div class="unlinked-alert">
                    <ce-icon name="alert-triangle" [size]="16" />
                    <div class="unlinked-content">
                      <span>Resident has no apartment assigned. Assign destination apartment for this pass:</span>
                      <select
                        class="ce-input inline-apt-select"
                        [value]="selectedApartmentId()"
                        (change)="onApartmentSelect($event)"
                      >
                        <option value="">-- Select apartment --</option>
                        @for (apt of apartments(); track apt.id) {
                          <option [value]="apt.id">Block {{ apt.block }}, Unit {{ apt.unit }}</option>
                        }
                      </select>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- VEHICLE SUBJECT VIEW -->
        @if (issueForm.get('subjectType')?.value === 'vehicle') {
          <div class="subject-flow-container">
            <div class="mode-toggle-bar">
              <button
                type="button"
                class="mode-toggle-btn"
                [class.active]="vehicleMode() === 'select'"
                (click)="setVehicleMode('select')"
              >
                <ce-icon name="car" [size]="16" />
                <span>Registered vehicle ({{ vehicles().length }})</span>
              </button>
              <button
                type="button"
                class="mode-toggle-btn"
                [class.active]="vehicleMode() === 'new'"
                (click)="setVehicleMode('new')"
              >
                <ce-icon name="plus" [size]="16" />
                <span>+ Register new vehicle</span>
              </button>
            </div>

            @if (vehicleMode() === 'select') {
              @if (vehicles().length === 0) {
                <div class="empty-vehicles-banner">
                  <ce-icon name="info" [size]="20" />
                  <div class="empty-vehicles-text">
                    <p class="font-medium">No registered vehicles found in the condominium.</p>
                    <p class="text-xs text-secondary">Register a vehicle with its owner and apartment below.</p>
                  </div>
                  <button type="button" class="ce-button variant-primary size-sm" (click)="setVehicleMode('new')">
                    + Register vehicle
                  </button>
                </div>
              } @else {
                <label class="field">
                  <span class="field-label">Select registered vehicle</span>
                  <select class="ce-input" [value]="selectedVehicleId()" (change)="onVehicleSelect($event)">
                    <option value="">-- Choose vehicle --</option>
                    @for (v of vehicles(); track v.id) {
                      <option [value]="v.id">
                        {{ v.plate }} — {{ v.brand || '' }} {{ v.model || '' }} ({{ getVehicleOwnerAndAptLabel(v) }})
                      </option>
                    }
                  </select>
                </label>

                @if (selectedVehicle()) {
                  <div class="explicit-summary-card vehicle-theme">
                    <div class="summary-card-header">
                      <div class="summary-avatar-badge vehicle-avatar">
                        <ce-icon name="car" [size]="20" />
                      </div>
                      <div class="summary-header-text">
                        <h4 class="summary-subject-title font-mono">{{ selectedVehicle()!.plate }}</h4>
                        <span class="summary-badge-type">
                          {{ selectedVehicle()!.brand || '' }} {{ selectedVehicle()!.model || 'Vehicle' }}
                          {{ selectedVehicle()!.color ? '• ' + selectedVehicle()!.color : '' }}
                        </span>
                      </div>
                    </div>

                    <div class="summary-grid">
                      <div class="summary-cell highlight-cell">
                        <span class="cell-label">VEHICLE APARTMENT</span>
                        <div class="cell-value-group">
                          <ce-icon name="home" [size]="16" class="cell-icon text-emerald" />
                          <strong class="cell-main-val">
                            {{ vehicleApartmentLabel() }}
                          </strong>
                        </div>
                      </div>

                      <div class="summary-cell">
                        <span class="cell-label">VEHICLE OWNER</span>
                        <div class="cell-value-group">
                          <ce-icon name="user" [size]="14" class="cell-icon text-secondary" />
                          <strong class="cell-main-val">
                            {{ vehicleOwnerDisplay() }}
                          </strong>
                        </div>
                      </div>

                      <div class="summary-cell full-width">
                        <span class="cell-label">VEHICLE RECORD ID</span>
                        <code class="cell-uuid font-mono">{{ selectedVehicle()!.id }}</code>
                      </div>
                    </div>
                  </div>
                }
              }
            } @else {
              <!-- Register New Vehicle Inline Form -->
              <div [formGroup]="newVehicleForm" class="new-vehicle-box">
                <h4 class="subform-title">
                  <ce-icon name="car" [size]="18" />
                  <span>Register vehicle & assign owner</span>
                </h4>

                <div class="form-row-2col">
                  <label class="field">
                    <span class="field-label">License plate <span class="text-danger">*</span></span>
                    <input
                      class="ce-input font-mono uppercase"
                      formControlName="plate"
                      placeholder="e.g. BRA2E19 or ABC-1234"
                      (input)="onPlateInput($event)"
                      maxlength="8"
                    />
                  </label>

                  <label class="field">
                    <span class="field-label">Brand & Model</span>
                    <input class="ce-input" formControlName="model" placeholder="e.g. Toyota Corolla" />
                  </label>
                </div>

                <div class="form-row-2col">
                  <label class="field">
                    <span class="field-label">Color</span>
                    <input class="ce-input" formControlName="color" placeholder="e.g. Silver, Black, White" />
                  </label>

                  <label class="field">
                    <span class="field-label">Vehicle Owner (Resident)</span>
                    <select
                      class="ce-input"
                      formControlName="ownerResidentId"
                      (change)="onNewVehicleResidentChange($any($event.target).value)"
                    >
                      <option value="">-- Select resident owner --</option>
                      @for (r of residents(); track r.id) {
                        <option [value]="r.id">
                          {{ r.name }} {{ r.apartmentId ? '(' + getApartmentLabel(r.apartmentId) + ')' : '' }}
                        </option>
                      }
                    </select>
                  </label>
                </div>

                <div class="form-row-2col">
                  <label class="field">
                    <span class="field-label">Owner Name (Manual override)</span>
                    <input class="ce-input" formControlName="ownerName" placeholder="Owner display name" />
                  </label>

                  <label class="field">
                    <span class="field-label">Vehicle Apartment <span class="text-danger">*</span></span>
                    <select class="ce-input" formControlName="apartmentId">
                      <option value="">-- Choose apartment unit --</option>
                      @for (apt of apartments(); track apt.id) {
                        <option [value]="apt.id">Block {{ apt.block }}, Unit {{ apt.unit }}</option>
                      }
                    </select>
                    <span class="field-hint">Auto-filled when selecting a resident, or choose manually.</span>
                  </label>
                </div>

                <!-- Live Preview Card for New Vehicle -->
                <div class="explicit-summary-card vehicle-theme">
                  <div class="summary-card-header">
                    <div class="summary-avatar-badge vehicle-avatar">
                      <ce-icon name="car" [size]="20" />
                    </div>
                    <div class="summary-header-text">
                      <h4 class="summary-subject-title font-mono">
                        {{ newVehicleForm.get('plate')?.value ? (newVehicleForm.get('plate')?.value | uppercase) : 'PLATE PENDING' }}
                      </h4>
                      <span class="summary-badge-type">
                        {{ newVehicleForm.get('model')?.value || 'New Vehicle' }}
                        {{ newVehicleForm.get('color')?.value ? '• ' + newVehicleForm.get('color')?.value : '' }}
                      </span>
                    </div>
                  </div>

                  <div class="summary-grid">
                    <div class="summary-cell highlight-cell">
                      <span class="cell-label">VEHICLE APARTMENT</span>
                      <div class="cell-value-group">
                        <ce-icon name="home" [size]="16" class="cell-icon text-emerald" />
                        <strong class="cell-main-val">
                          {{ vehicleApartmentLabel() }}
                        </strong>
                      </div>
                    </div>

                    <div class="summary-cell">
                      <span class="cell-label">VEHICLE OWNER</span>
                      <div class="cell-value-group">
                        <ce-icon name="user" [size]="14" class="cell-icon text-secondary" />
                        <strong class="cell-main-val">
                          {{ vehicleOwnerDisplay() }}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }

        <!-- VISITOR SUBJECT VIEW -->
        @if (issueForm.get('subjectType')?.value === 'visitor') {
          <div class="subject-flow-container">
            <div class="form-row-2col">
              <label class="field">
                <span class="field-label">Visitor Name / Note</span>
                <input
                  class="ce-input"
                  [value]="visitorName()"
                  (input)="visitorName.set($any($event.target).value)"
                  placeholder="e.g. John Doe, Delivery, Contractor"
                />
              </label>

              <label class="field">
                <span class="field-label">Destination Apartment</span>
                <select
                  class="ce-input"
                  [value]="selectedApartmentId()"
                  (change)="onApartmentSelect($event)"
                >
                  <option value="">-- Choose destination apartment --</option>
                  @for (apt of apartments(); track apt.id) {
                    <option [value]="apt.id">Block {{ apt.block }}, Unit {{ apt.unit }}</option>
                  }
                </select>
                <span class="field-hint">Specify which apartment the visitor is granted access to.</span>
              </label>
            </div>

            <div class="explicit-summary-card visitor-theme">
              <div class="summary-card-header">
                <div class="summary-avatar-badge visitor-avatar">
                  <ce-icon name="user-check" [size]="20" />
                </div>
                <div class="summary-header-text">
                  <h4 class="summary-subject-title">{{ visitorName() || 'Guest Visitor' }}</h4>
                  <span class="summary-badge-type">Visitor QR Pass</span>
                </div>
              </div>

              <div class="summary-grid">
                <div class="summary-cell highlight-cell">
                  <span class="cell-label">DESTINATION APARTMENT</span>
                  <div class="cell-value-group">
                    <ce-icon name="home" [size]="16" class="cell-icon text-amber" />
                    <strong class="cell-main-val">
                      {{ getApartmentLabel(selectedApartmentId()) || 'General Condominium Access' }}
                    </strong>
                  </div>
                </div>

                <div class="summary-cell">
                  <span class="cell-label">VISITOR TYPE</span>
                  <span class="cell-sub-val">Temporary Access</span>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Expiration Presets & Input -->
        <div class="field">
          <div class="expiry-header">
            <span class="field-label">Pass validity / Expiration</span>
            <div class="presets-row">
              <button type="button" class="preset-chip" (click)="setExpiryPreset('today')">Today (23:59)</button>
              <button type="button" class="preset-chip" (click)="setExpiryPreset('24h')">24 Hours</button>
              <button type="button" class="preset-chip" (click)="setExpiryPreset('7d')">7 Days</button>
              <button type="button" class="preset-chip" (click)="setExpiryPreset('permanent')">Permanent</button>
            </div>
          </div>
          <input class="ce-input" type="datetime-local" formControlName="expiresAtUtc" />
          <span class="field-hint">Leave empty for no automatic expiration.</span>
        </div>

        <!-- Technical Identifier (UUID) details -->
        <details class="technical-details">
          <summary class="technical-summary">
            <ce-icon name="settings" [size]="14" />
            <span>Advanced: Technical Subject ID (UUID)</span>
          </summary>
          <div class="field mt-2">
            <div class="input-with-button">
              <input
                id="credential-subject-id"
                class="ce-input font-mono"
                formControlName="subjectId"
                placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                autocomplete="off"
              />
              <button
                type="button"
                class="ce-button variant-secondary size-sm input-action-btn"
                (click)="regenerateSubjectId()"
                title="Generate another random UUID"
                id="generate-uuid-btn"
              >
                <ce-icon name="refresh" [size]="16" />
                <span>New UUID</span>
              </button>
            </div>
          </div>
        </details>
      </form>

      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" type="button" (click)="closeIssueModal()">Cancel</ce-button>
        <ce-button
          variant="primary"
          size="sm"
          type="button"
          (click)="submitIssue()"
          [disabled]="isSubmitDisabled()"
        >
          {{ issuing() ? 'Generating…' : 'Generate QR pass' }}
        </ce-button>
      </div>
    </ce-modal>

    <!-- QR Pass Display Modal -->
    <ce-qr-pass-modal
      [open]="qrPassModalOpen()"
      [qrPayload]="activeQrPayload()"
      [subjectName]="activeSubjectName()"
      [subjectType]="activeSubjectType()"
      [destination]="activeDestination()"
      [expiresAt]="activeExpiresAt()"
      (closed)="closeQrPassModal()"
    />
  `,
  styles: [
    `
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-4, 16px);
      }
      .page-title {
        font-size: var(--font-size-2xl, 1.5rem);
        margin: 0;
      }
      .page-subtitle {
        color: var(--color-text-secondary, #64748b);
        font-size: var(--font-size-sm, 0.875rem);
      }
      .filter-tabs {
        display: flex;
        gap: var(--space-2, 8px);
        margin-bottom: var(--space-4, 16px);
      }
      .filter-tab {
        border: 1px solid var(--color-border, #cbd5e1);
        background: var(--color-surface, #ffffff);
        border-radius: var(--radius-lg, 8px);
        padding: var(--space-2, 8px) var(--space-4, 16px);
        cursor: pointer;
        font-family: inherit;
        font-size: var(--font-size-sm, 0.875rem);
        transition: all 0.15s ease;
      }
      .filter-tab.active {
        background: var(--color-primary, #2c5cdc);
        color: var(--color-text-on-primary, #ffffff);
        border-color: var(--color-primary, #2c5cdc);
      }
      .page-error {
        margin-bottom: var(--space-4, 16px);
        padding: var(--space-3, 12px);
        border-radius: var(--radius-lg, 8px);
        background: var(--color-danger-light, #fee2e2);
        color: var(--color-danger, #b91c1c);
        font-size: var(--font-size-sm, 0.875rem);
      }
      .ce-card {
        background: var(--color-surface, #ffffff);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: var(--radius-xl, 12px);
        overflow: hidden;
      }
      .ce-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm, 0.875rem);
      }
      .ce-table th,
      .ce-table td {
        padding: var(--space-3, 12px) var(--space-4, 16px);
        border-bottom: 1px solid var(--color-border, #e2e8f0);
        text-align: left;
        vertical-align: middle;
      }
      .ce-table thead {
        background: var(--color-neutral-light, #f8fafc);
      }
      .empty-cell {
        text-align: center;
        padding: var(--space-6, 24px) !important;
      }
      .subject-tag {
        font-weight: 600;
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
      }
      .tag-resident {
        background: #e0e7ff;
        color: #3730a3;
      }
      .tag-visitor {
        background: #fef3c7;
        color: #92400e;
      }
      .tag-vehicle {
        background: #d1fae5;
        color: #065f46;
      }
      .subject-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .subject-identity {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .subject-name {
        color: var(--color-text-primary, #0f172a);
        font-size: 0.875rem;
      }
      .apt-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #f1f5f9;
        color: #1e293b;
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.8rem;
        border: 1px solid #e2e8f0;
      }
      .method-tag {
        font-weight: 700;
        font-size: 0.75rem;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .uuid-label {
        font-family: monospace;
        font-size: 0.75rem;
        color: var(--color-text-secondary, #64748b);
      }
      .ce-badge {
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: capitalize;
      }
      .badge-active {
        background: #dcfce7;
        color: #15803d;
      }
      .badge-replaced {
        background: #e2e8f0;
        color: #475569;
      }
      .badge-revoked {
        background: #fee2e2;
        color: #b91c1c;
      }
      .badge-expired {
        background: #fef2f2;
        color: #991b1b;
      }
      .action-cell {
        display: flex;
        gap: var(--space-2, 8px);
      }
      .ce-button.variant-danger {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
      }
      .issue-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
      }
      .subject-type-selector {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .type-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 8px;
        border: 2px solid var(--color-border, #cbd5e1);
        border-radius: var(--radius-lg, 10px);
        background: var(--color-surface, #ffffff);
        color: var(--color-text-secondary, #475569);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .type-btn:hover {
        border-color: #94a3b8;
        background: #f8fafc;
      }
      .type-btn.active {
        border-color: var(--color-primary, #2c5cdc);
        background: #eff6ff;
        color: var(--color-primary, #2c5cdc);
        box-shadow: 0 0 0 1px var(--color-primary, #2c5cdc);
      }
      .subject-flow-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
      }
      .field-label {
        font-weight: 600;
        font-size: 0.85rem;
      }
      .field-hint {
        color: var(--color-text-secondary, #64748b);
        font-size: 0.75rem;
      }
      .ce-input {
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 1px solid var(--color-border, #cbd5e1);
        border-radius: var(--radius-md, 6px);
        font-family: inherit;
        font-size: 0.875rem;
        width: 100%;
        box-sizing: border-box;
      }
      .ce-input:focus {
        outline: none;
        border-color: var(--color-primary, #2c5cdc);
        box-shadow: 0 0 0 2px rgba(44, 92, 220, 0.15);
      }
      .uppercase {
        text-transform: uppercase;
      }
      .input-with-button {
        display: flex;
        gap: var(--space-2, 8px);
        align-items: center;
      }
      .input-with-button .ce-input {
        flex: 1;
        font-family: monospace;
      }
      .input-action-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1, 4px);
        white-space: nowrap;
        height: 38px;
        padding: 0 var(--space-3, 12px);
      }
      .form-error-banner {
        margin-bottom: var(--space-3, 12px);
        padding: var(--space-3, 12px);
        border-radius: var(--radius-lg, 8px);
        color: var(--color-danger, #b91c1c);
        background: var(--color-danger-light, #fee2e2);
      }

      /* Explicit Summary Card */
      .explicit-summary-card {
        border-radius: var(--radius-xl, 12px);
        padding: var(--space-4, 16px);
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
        transition: all 0.2s ease;
      }
      .resident-theme {
        background: linear-gradient(135deg, #f8faff 0%, #eef2ff 100%);
        border: 1px solid #c7d2fe;
      }
      .vehicle-theme {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border: 1px solid #bbf7d0;
      }
      .visitor-theme {
        background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        border: 1px solid #fde68a;
      }
      .summary-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .summary-avatar-badge {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .resident-avatar {
        background: #e0e7ff;
        color: #3730a3;
      }
      .vehicle-avatar {
        background: #d1fae5;
        color: #065f46;
      }
      .visitor-avatar {
        background: #fef3c7;
        color: #92400e;
      }
      .summary-header-text {
        display: flex;
        flex-direction: column;
      }
      .summary-subject-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
      }
      .summary-badge-type {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        background: rgba(255, 255, 255, 0.7);
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.05);
      }
      .summary-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .summary-cell.full-width {
        grid-column: 1 / -1;
      }
      .highlight-cell .cell-main-val {
        color: #0f172a;
        font-size: 0.95rem;
      }
      .cell-label {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #64748b;
      }
      .cell-value-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .cell-main-val {
        font-size: 0.875rem;
      }
      .cell-sub-val {
        font-size: 0.85rem;
        color: #334155;
      }
      .cell-uuid {
        font-size: 0.75rem;
        color: #64748b;
        word-break: break-all;
      }
      .unlinked-alert {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 0.8rem;
        color: #92400e;
      }
      .unlinked-content {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }
      .inline-apt-select {
        background: #ffffff;
      }

      /* Vehicle Mode Toggles */
      .mode-toggle-bar {
        display: flex;
        gap: 8px;
      }
      .mode-toggle-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        color: #475569;
        transition: all 0.15s ease;
      }
      .mode-toggle-btn.active {
        background: #ecfdf5;
        border-color: #10b981;
        color: #065f46;
      }
      .empty-vehicles-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        padding: 12px 16px;
        border-radius: 8px;
        gap: 12px;
      }
      .empty-vehicles-text {
        flex: 1;
      }
      .new-vehicle-box {
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 14px;
        border-radius: 10px;
      }
      .subform-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 0.9rem;
        color: #1e293b;
      }
      .form-row-2col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      /* Expiry Presets */
      .expiry-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      .presets-row {
        display: flex;
        gap: 6px;
      }
      .preset-chip {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 9999px;
        padding: 2px 8px;
        font-size: 0.72rem;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .preset-chip:hover {
        background: #e2e8f0;
        color: #0f172a;
      }

      /* Technical Details */
      .technical-details {
        border-top: 1px solid #e2e8f0;
        padding-top: 10px;
      }
      .technical-summary {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        color: #64748b;
        font-size: 0.75rem;
        font-weight: 600;
        user-select: none;
      }
      .technical-summary:hover {
        color: #334155;
      }
      .mt-2 {
        margin-top: 8px;
      }
      .text-indigo {
        color: #4f46e5;
      }
      .text-emerald {
        color: #059669;
      }
      .text-amber {
        color: #d97706;
      }
      .text-danger {
        color: #dc2626;
      }
    `,
  ],
})
export class AccessCredentialsPage implements OnInit {
  private readonly api = inject(GatewayControlService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly http = inject(HttpClient);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  private readonly residentsApi = inject(ResidentsApiService);
  private readonly vehiclesApi = inject(VehiclesApiService);

  readonly credentials = signal<AccessCredentialSummary[]>([]);
  readonly loading = signal(false);
  readonly pageError = signal<string | null>(null);
  readonly statusFilter = signal<CredentialStatusFilter>('all');
  readonly actionInFlight = signal<string | null>(null);

  // Reference data signals
  readonly apartments = signal<ApartmentResponse[]>([]);
  readonly residents = signal<ResidentResponse[]>([]);
  readonly vehicles = signal<VehicleResponse[]>([]);

  // Selection & Mode signals
  readonly selectedResidentId = signal<string>('');
  readonly selectedVehicleId = signal<string>('');
  readonly selectedApartmentId = signal<string>('');
  readonly vehicleMode = signal<'select' | 'new'>('select');
  readonly visitorName = signal<string>('');

  // Issue modal state
  readonly issueModalOpen = signal(false);
  readonly issuing = signal(false);
  readonly issueError = signal<string | null>(null);

  readonly issueForm = this.fb.group({
    subjectType: ['visitor' as SubjectKind, Validators.required],
    subjectId: [this.generateRandomUuid(), [Validators.required, Validators.pattern(/^[0-9a-fA-F-]{36}$/)]],
    expiresAtUtc: [''],
  });

  readonly newVehicleForm = this.fb.group({
    plate: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]{7,8}$/)]],
    brand: [''],
    model: [''],
    color: [''],
    ownerResidentId: [''],
    ownerName: [''],
    apartmentId: ['', Validators.required],
  });

  // QR pass display state
  readonly qrPassModalOpen = signal(false);
  readonly activeQrPayload = signal<string | null>(null);
  readonly activeSubjectName = signal('');
  readonly activeSubjectType = signal('Visitor');
  readonly activeDestination = signal('');
  readonly activeExpiresAt = signal<string | null>(null);

  // Computed lookup maps
  readonly apartmentMap = computed(() => {
    const map = new Map<string, ApartmentResponse>();
    for (const apt of this.apartments()) {
      map.set(apt.id, apt);
    }
    return map;
  });

  readonly residentMap = computed(() => {
    const map = new Map<string, ResidentResponse>();
    for (const r of this.residents()) {
      map.set(r.id, r);
    }
    return map;
  });

  readonly vehicleMap = computed(() => {
    const map = new Map<string, VehicleResponse>();
    for (const v of this.vehicles()) {
      map.set(v.id, v);
    }
    return map;
  });

  readonly selectedResident = computed(() => {
    const id = this.selectedResidentId();
    if (!id) return null;
    return this.residentMap().get(id) ?? null;
  });

  readonly selectedVehicle = computed(() => {
    const id = this.selectedVehicleId();
    if (!id) return null;
    return this.vehicleMap().get(id) ?? null;
  });

  readonly residentApartmentLabel = computed(() => {
    const res = this.selectedResident();
    if (!res) return 'Unassigned';
    if (res.apartmentId) {
      return this.getApartmentLabel(res.apartmentId);
    }
    if (this.selectedApartmentId()) {
      return this.getApartmentLabel(this.selectedApartmentId());
    }
    return 'No apartment linked';
  });

  readonly vehicleApartmentLabel = computed(() => {
    if (this.vehicleMode() === 'new') {
      const aptId = this.newVehicleForm.get('apartmentId')?.value;
      return this.getApartmentLabel(aptId) || 'Select an apartment';
    }
    const v = this.selectedVehicle();
    if (!v) return 'Unassigned';
    if (v.apartmentId) {
      return this.getApartmentLabel(v.apartmentId);
    }
    if (v.ownerResidentId) {
      const res = this.residentMap().get(v.ownerResidentId);
      if (res?.apartmentId) {
        return this.getApartmentLabel(res.apartmentId);
      }
    }
    return 'No apartment linked';
  });

  readonly vehicleOwnerDisplay = computed(() => {
    if (this.vehicleMode() === 'new') {
      const resId = this.newVehicleForm.get('ownerResidentId')?.value;
      if (resId) {
        const res = this.residentMap().get(resId);
        if (res) return res.name;
      }
      return this.newVehicleForm.get('ownerName')?.value || 'Not specified';
    }
    const v = this.selectedVehicle();
    if (!v) return 'Not specified';
    if (v.ownerName) return v.ownerName;
    if (v.ownerResidentId) {
      const res = this.residentMap().get(v.ownerResidentId);
      if (res) return res.name;
    }
    return 'Condominium registered';
  });

  readonly filteredCredentials = computed(() => {
    const list = this.credentials();
    const filter = this.statusFilter();
    if (filter === 'all') return list;
    return list.filter((c) => c.status === filter);
  });

  ngOnInit(): void {
    this.load();
    this.loadReferenceData();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.listCredentials().subscribe({
      next: (data) => {
        this.loading.set(false);
        this.credentials.set(data);
      },
      error: (err) => {
        this.loading.set(false);
        this.pageError.set(getApiErrorMessage(err, 'Failed to load credentials.'));
      },
    });
  }

  loadReferenceData(): void {
    this.apartmentsApi.list('', 0, 500).subscribe({
      next: (apts) => this.apartments.set(apts ?? []),
      error: () => {},
    });
    this.loadResidents();
    this.vehiclesApi.list('', 0, 200).subscribe({
      next: (veh) => this.vehicles.set(veh ?? []),
      error: () => {},
    });
  }

  loadResidents(): void {
    this.http.get<ResidentResponse[]>('/api/v1/residents').subscribe({
      next: (data) => this.residents.set(data ?? []),
      error: () => this.residents.set([]),
    });
  }

  setStatusFilter(filter: CredentialStatusFilter): void {
    this.statusFilter.set(filter);
  }

  subjectTypeLabel(type: SubjectKind): string {
    switch (type) {
      case 'resident':
        return 'Resident';
      case 'visitor':
        return 'Visitor';
      case 'vehicle':
        return 'Vehicle';
      default:
        return type;
    }
  }

  truncateId(id: string): string {
    if (!id || id.length <= 8) return id;
    return `${id.substring(0, 8)}...`;
  }

  getApartmentLabel(id: string | null | undefined): string {
    if (!id) return '';
    const apt = this.apartmentMap().get(id);
    return apt ? `Block ${apt.block}, Unit ${apt.unit}` : '';
  }

  getVehicleOwnerAndAptLabel(v: VehicleResponse): string {
    const owner = v.ownerName || (v.ownerResidentId ? this.residentMap().get(v.ownerResidentId)?.name : null) || 'Owner';
    const apt = this.getApartmentLabel(v.apartmentId) || (v.ownerResidentId ? this.getApartmentLabel(this.residentMap().get(v.ownerResidentId)?.apartmentId) : '');
    return apt ? `${owner} • ${apt}` : owner;
  }

  getSubjectDisplayName(cred: AccessCredentialSummary): string {
    if (cred.subjectType === 'resident') {
      const res = this.residentMap().get(cred.subjectId);
      return res ? res.name : this.truncateId(cred.subjectId);
    }
    if (cred.subjectType === 'vehicle') {
      const veh = this.vehicleMap().get(cred.subjectId);
      if (!veh) return this.truncateId(cred.subjectId);
      const owner = veh.ownerName || (veh.ownerResidentId ? this.residentMap().get(veh.ownerResidentId)?.name : null);
      return owner ? `${veh.plate} (${owner})` : veh.plate;
    }
    return 'Visitor';
  }

  getSubjectApartment(cred: AccessCredentialSummary): string {
    if (cred.subjectType === 'resident') {
      const res = this.residentMap().get(cred.subjectId);
      return res?.apartmentId ? this.getApartmentLabel(res.apartmentId) : '';
    }
    if (cred.subjectType === 'vehicle') {
      const veh = this.vehicleMap().get(cred.subjectId);
      if (!veh) return '';
      const aptFromVeh = veh.apartmentId ? this.getApartmentLabel(veh.apartmentId) : '';
      if (aptFromVeh) return aptFromVeh;
      if (veh.ownerResidentId) {
        const res = this.residentMap().get(veh.ownerResidentId);
        return res?.apartmentId ? this.getApartmentLabel(res.apartmentId) : '';
      }
      return '';
    }
    return '';
  }

  canIssue(): boolean {
    return this.auth.hasPermission('Access.Control.Issue');
  }

  canReplace(): boolean {
    return this.auth.hasPermission('Access.Control.Replace');
  }

  canRevoke(): boolean {
    return this.auth.hasPermission('Access.Control.Revoke');
  }

  setSubjectType(type: SubjectKind): void {
    this.issueForm.patchValue({ subjectType: type });
    this.onSubjectTypeChange();
  }

  onSubjectTypeChange(): void {
    const type = this.issueForm.get('subjectType')?.value;
    this.issueError.set(null);

    if (type === 'resident') {
      if (this.residents().length === 0) {
        this.loadResidents();
      }
      if (this.selectedResidentId()) {
        this.issueForm.patchValue({ subjectId: this.selectedResidentId() });
      } else if (this.residents().length > 0) {
        const firstRes = this.residents()[0];
        if (firstRes) {
          this.selectedResidentId.set(firstRes.id);
          this.issueForm.patchValue({ subjectId: firstRes.id });
        }
      }
    } else if (type === 'vehicle') {
      if (this.vehicles().length > 0) {
        this.vehicleMode.set('select');
        if (!this.selectedVehicleId()) {
          const firstVeh = this.vehicles()[0];
          if (firstVeh) {
            this.selectedVehicleId.set(firstVeh.id);
            this.issueForm.patchValue({ subjectId: firstVeh.id });
          }
        }
      } else {
        this.vehicleMode.set('new');
        this.regenerateSubjectId();
      }
    } else {
      this.selectedResidentId.set('');
      this.selectedVehicleId.set('');
      this.regenerateSubjectId();
    }
  }

  onResidentSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedResidentId.set(id);
    if (id) {
      this.issueForm.patchValue({ subjectId: id });
    } else {
      this.regenerateSubjectId();
    }
  }

  onVehicleSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedVehicleId.set(id);
    if (id) {
      this.issueForm.patchValue({ subjectId: id });
    } else {
      this.regenerateSubjectId();
    }
  }

  onApartmentSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedApartmentId.set(id);
  }

  setVehicleMode(mode: 'select' | 'new'): void {
    this.vehicleMode.set(mode);
    if (mode === 'new') {
      this.regenerateSubjectId();
    } else if (this.selectedVehicleId()) {
      this.issueForm.patchValue({ subjectId: this.selectedVehicleId() });
    }
  }

  onPlateInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.toUpperCase();
    this.newVehicleForm.patchValue({ plate: val }, { emitEvent: false });
  }

  onNewVehicleResidentChange(residentId: string): void {
    this.newVehicleForm.patchValue({ ownerResidentId: residentId });
    if (residentId) {
      const res = this.residentMap().get(residentId);
      if (res) {
        this.newVehicleForm.patchValue({ ownerName: res.name });
        if (res.apartmentId) {
          this.newVehicleForm.patchValue({ apartmentId: res.apartmentId });
        }
      }
    }
  }

  setExpiryPreset(preset: 'today' | '24h' | '7d' | 'permanent'): void {
    if (preset === 'permanent') {
      this.issueForm.patchValue({ expiresAtUtc: '' });
      return;
    }
    const now = new Date();
    if (preset === 'today') {
      now.setHours(23, 59, 0, 0);
    } else if (preset === '24h') {
      now.setHours(now.getHours() + 24);
    } else if (preset === '7d') {
      now.setDate(now.getDate() + 7);
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    this.issueForm.patchValue({ expiresAtUtc: localStr });
  }

  regenerateSubjectId(): void {
    this.issueForm.patchValue({ subjectId: this.generateRandomUuid() });
  }

  generateRandomUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  openIssueModal(prefill?: { subjectType: SubjectKind; subjectId: string }): void {
    if (prefill) {
      this.issueForm.patchValue({
        subjectType: prefill.subjectType,
        subjectId: prefill.subjectId,
      });
      if (prefill.subjectType === 'resident') {
        this.selectedResidentId.set(prefill.subjectId);
        if (this.residents().length === 0) {
          this.loadResidents();
        }
      } else if (prefill.subjectType === 'vehicle') {
        this.selectedVehicleId.set(prefill.subjectId);
        this.vehicleMode.set('select');
      }
    } else {
      this.issueForm.reset({
        subjectType: 'visitor',
        subjectId: this.generateRandomUuid(),
        expiresAtUtc: '',
      });
      this.selectedResidentId.set('');
      this.selectedVehicleId.set('');
      this.vehicleMode.set(this.vehicles().length > 0 ? 'select' : 'new');
      this.selectedApartmentId.set('');
      this.visitorName.set('');
      this.newVehicleForm.reset({
        plate: '',
        brand: '',
        model: '',
        color: '',
        ownerResidentId: '',
        ownerName: '',
        apartmentId: '',
      });
    }
    this.issueError.set(null);
    this.issueModalOpen.set(true);
  }

  onIssueModalOpenChange(open: boolean): void {
    if (!open) this.closeIssueModal();
  }

  closeIssueModal(): void {
    this.issueModalOpen.set(false);
    this.issuing.set(false);
    this.issueError.set(null);
  }

  isSubmitDisabled(): boolean {
    if (this.issuing()) return true;
    const type = this.issueForm.get('subjectType')?.value;
    if (type === 'vehicle' && this.vehicleMode() === 'new') {
      return this.newVehicleForm.invalid;
    }
    return this.issueForm.invalid;
  }

  submitIssue(): void {
    if (this.isSubmitDisabled()) return;

    const val = this.issueForm.getRawValue();
    const subjectType = val.subjectType as SubjectKind;

    // Handle inline vehicle creation if in 'new' mode
    if (subjectType === 'vehicle' && this.vehicleMode() === 'new') {
      this.issuing.set(true);
      this.issueError.set(null);

      const nVal = this.newVehicleForm.getRawValue();
      const createReq: CreateVehicleRequest = {
        plate: nVal.plate!.trim().toUpperCase(),
        brand: nVal.brand?.trim() || null,
        model: nVal.model?.trim() || null,
        color: nVal.color?.trim() || null,
        apartmentId: nVal.apartmentId || null,
        ownerName: nVal.ownerName?.trim() || null,
        vehicleType: 'car',
      };

      this.vehiclesApi.create(createReq).subscribe({
        next: (createdVehicle) => {
          this.vehicles.update((list) => [...list, createdVehicle]);
          this.selectedVehicleId.set(createdVehicle.id);
          this.issueForm.patchValue({ subjectId: createdVehicle.id });

          const aptLabel = this.getApartmentLabel(createdVehicle.apartmentId);
          const displayName = `${createdVehicle.plate}${createdVehicle.ownerName ? ' • ' + createdVehicle.ownerName : ''}`;

          this.executeIssue(
            'vehicle',
            createdVehicle.id,
            val.expiresAtUtc,
            displayName,
            aptLabel
          );
        },
        error: (err) => {
          this.issuing.set(false);
          this.issueError.set(getApiErrorMessage(err, 'Failed to register vehicle.'));
        },
      });
      return;
    }

    // Standard credential issue
    let displayName = this.truncateId(val.subjectId!);
    let destination = '';

    if (subjectType === 'resident') {
      const res = this.selectedResident();
      if (res) {
        displayName = res.name;
        destination = this.getApartmentLabel(res.apartmentId);
      } else if (this.selectedApartmentId()) {
        destination = this.getApartmentLabel(this.selectedApartmentId());
      }
    } else if (subjectType === 'vehicle') {
      const veh = this.selectedVehicle();
      if (veh) {
        const owner = veh.ownerName || (veh.ownerResidentId ? this.residentMap().get(veh.ownerResidentId)?.name : null);
        displayName = `${veh.plate}${owner ? ' • ' + owner : ''}`;
        destination = this.getApartmentLabel(veh.apartmentId) || (veh.ownerResidentId ? this.getApartmentLabel(this.residentMap().get(veh.ownerResidentId)?.apartmentId) : '');
      }
    } else if (subjectType === 'visitor') {
      if (this.visitorName().trim()) {
        displayName = this.visitorName().trim();
      }
      if (this.selectedApartmentId()) {
        destination = this.getApartmentLabel(this.selectedApartmentId());
      }
    }

    this.issuing.set(true);
    this.issueError.set(null);
    this.executeIssue(subjectType, val.subjectId!, val.expiresAtUtc, displayName, destination);
  }

  private executeIssue(
    subjectType: SubjectKind,
    subjectId: string,
    expiresAtUtcStr: string | null | undefined,
    displayName: string,
    destination: string
  ): void {
    const req: IssueCredentialRequest = {
      subjectType,
      subjectId,
      expiresAtUtc: expiresAtUtcStr ? new Date(expiresAtUtcStr).toISOString() : null,
    };

    this.api.issueCredential(req).subscribe({
      next: (res) => {
        this.issuing.set(false);
        this.closeIssueModal();
        this.toast.info('QR credential issued successfully.');
        this.load();

        // Open QR pass display modal with full details
        this.activeQrPayload.set(res.qrPayload);
        this.activeSubjectName.set(displayName);
        this.activeSubjectType.set(this.subjectTypeLabel(subjectType));
        this.activeDestination.set(destination);
        this.activeExpiresAt.set(req.expiresAtUtc ?? null);
        this.qrPassModalOpen.set(true);
      },
      error: (err) => {
        this.issuing.set(false);
        this.issueError.set(getApiErrorMessage(err, 'Failed to issue credential.'));
      },
    });
  }

  onReplace(cred: AccessCredentialSummary): void {
    if (this.actionInFlight()) return;
    this.actionInFlight.set(cred.id);

    this.api.replaceCredential(cred.id).subscribe({
      next: (res) => {
        this.actionInFlight.set(null);
        this.toast.info('Credential replaced.');
        this.load();

        // Open QR pass display with replacement
        this.activeQrPayload.set(res.qrPayload);
        this.activeSubjectName.set(this.getSubjectDisplayName(cred));
        this.activeSubjectType.set(this.subjectTypeLabel(cred.subjectType));
        this.activeDestination.set(this.getSubjectApartment(cred));
        this.activeExpiresAt.set(cred.expiresAtUtc);
        this.qrPassModalOpen.set(true);
      },
      error: (err) => {
        this.actionInFlight.set(null);
        this.toast.error(getApiErrorMessage(err, 'Failed to replace credential.'));
      },
    });
  }

  onRevoke(cred: AccessCredentialSummary): void {
    if (this.actionInFlight()) return;
    if (!confirm('Are you sure you want to revoke this credential? Access will be immediately denied.')) return;

    this.actionInFlight.set(cred.id);
    this.api.revokeCredential(cred.id, 'operator_revocation', 'Revoked by operator').subscribe({
      next: () => {
        this.actionInFlight.set(null);
        this.toast.info('Credential revoked.');
        this.load();
      },
      error: (err) => {
        this.actionInFlight.set(null);
        this.toast.error(getApiErrorMessage(err, 'Failed to revoke credential.'));
      },
    });
  }

  closeQrPassModal(): void {
    this.qrPassModalOpen.set(false);
    this.activeQrPayload.set(null);
  }
}
