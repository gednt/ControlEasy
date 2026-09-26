import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdministrationApiService,
  AuditLogResponse,
  CondominiumSettingsDto,
  AuditLogQueryParams,
} from './administration-api.service';
import { CeToggleComponent } from '../../design-system/components/toggle/toggle.component';
import { AuthService } from '../../core/services/auth.service';
import { type StaffMemberResponse } from '../../core/services/security-api.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';

@Component({
  selector: 'ce-administration-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, CeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <p class="eyebrow">Control room / retained record</p>
        <h1 class="page-title">Condominium & System Administration</h1>
        <p class="page-subtitle">Configure gatehouse operations, visitor policies, and inspect system-wide audit records.</p>
      </div>
      @if (activeTab() === 'settings') {
        <div class="header-actions">
          <button
            class="ce-button variant-primary"
            type="button"
            [disabled]="settingsForm.invalid || saving() || !settingsForm.dirty"
            (click)="onSaveSettings()"
          >
            @if (saving()) {
              Saving...
            } @else {
              Save settings
            }
          </button>
        </div>
      } @else {
        <div class="header-actions">
          <button class="ce-button variant-secondary" type="button" (click)="loadAuditLogs()">
            Refresh audit trail
          </button>
        </div>
      }
    </div>

    @if (statusMessage()) {
      <div class="status-banner" [class.error]="statusMessage()?.type === 'error'">
        <span>{{ statusMessage()?.text }}</span>
        <button class="dismiss-btn" (click)="statusMessage.set(null)">&times;</button>
      </div>
    }

    <div class="tabs" role="tablist" aria-label="Administration navigation">
      <button
        role="tab"
        class="tab"
        [class.active]="activeTab() === 'settings'"
        [attr.aria-selected]="activeTab() === 'settings'"
        (click)="setTab('settings')"
      >
        Condominium & Gatehouse Settings
      </button>
      <button
        role="tab"
        class="tab"
        [class.active]="activeTab() === 'audit'"
        [attr.aria-selected]="activeTab() === 'audit'"
        (click)="setTab('audit')"
      >
        System-Wide Security Audit
      </button>
      @if (isTenantAdmin()) {
        <button
          role="tab"
          class="tab"
          [class.active]="activeTab() === 'staff'"
          [attr.aria-selected]="activeTab() === 'staff'"
          (click)="setTab('staff')"
        >
          Staff & Passwords
        </button>
      }
    </div>

    @if (loading()) {
      <div class="loading-state">
        <p class="text-secondary">Loading administration data...</p>
      </div>
    } @else if (activeTab() === 'settings') {
      <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
        <div class="settings-grid">
          <!-- Card 1: Gatehouse Operations -->
          <section class="ce-card" aria-labelledby="heading-gatehouse">
            <header class="card-header">
              <h2 id="heading-gatehouse" class="card-title">Gatehouse Operations</h2>
              <p class="card-subtitle">Operational parameters for gatehouse attendants and shift rotations.</p>
            </header>
            <div class="card-body">
              <div class="form-group">
                <label for="visitDurationMinutes">Visit Duration Limit (minutes)</label>
                <input
                  id="visitDurationMinutes"
                  type="number"
                  class="ce-input"
                  formControlName="visitDurationMinutes"
                  min="15"
                  max="1440"
                />
                <span class="field-hint">Maximum default time a visitor pass remains active (15 to 1440 min).</span>
              </div>

              <div class="form-group">
                <label for="defaultShiftLengthHours">Attendant Shift Duration (hours)</label>
                <input
                  id="defaultShiftLengthHours"
                  type="number"
                  class="ce-input"
                  formControlName="defaultShiftLengthHours"
                  min="1"
                  max="24"
                />
                <span class="field-hint">Standard gatehouse shift rotation length.</span>
              </div>

              <div class="form-group">
                <label for="emergencyContactPhone">Emergency Contact Phone</label>
                <input
                  id="emergencyContactPhone"
                  type="text"
                  class="ce-input"
                  formControlName="emergencyContactPhone"
                  placeholder="e.g. +55 11 99999-0000"
                />
                <span class="field-hint">Direct line displayed on attendant workstations during alerts.</span>
              </div>

              <div class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-title">Require Shift Handover Notes</span>
                  <span class="toggle-desc">Attendants must enter a shift summary log before closing their shift.</span>
                </div>
                <ce-toggle
                  [checked]="settingsForm.get('requireShiftHandoverNotes')?.value ?? false"
                  (checkedChange)="onToggle('requireShiftHandoverNotes', $event)"
                />
              </div>
            </div>
          </section>

          <!-- Card 2: Visitor Access Rules -->
          <section class="ce-card" aria-labelledby="heading-visitor-rules">
            <header class="card-header">
              <h2 id="heading-visitor-rules" class="card-title">Visitor & Access Rules</h2>
              <p class="card-subtitle">Visiting hours, unit quotas, and automated pass lifecycle.</p>
            </header>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label for="allowedVisitorStartHour">Allowed Entry From</label>
                  <input
                    id="allowedVisitorStartHour"
                    type="time"
                    class="ce-input"
                    formControlName="allowedVisitorStartHour"
                  />
                </div>
                <div class="form-group">
                  <label for="allowedVisitorEndHour">Allowed Entry Until</label>
                  <input
                    id="allowedVisitorEndHour"
                    type="time"
                    class="ce-input"
                    formControlName="allowedVisitorEndHour"
                  />
                </div>
              </div>
              <span class="field-hint">Outside this window, attendant supervisor authorization is required.</span>

              <div class="form-group">
                <label for="maxActiveVisitorsPerUnit">Max Active Visitors Per Unit</label>
                <input
                  id="maxActiveVisitorsPerUnit"
                  type="number"
                  class="ce-input"
                  formControlName="maxActiveVisitorsPerUnit"
                  min="1"
                  max="100"
                />
                <span class="field-hint">Limit of simultaneous visiting parties allowed for a single apartment.</span>
              </div>

              <div class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-title">Auto-checkout at Midnight</span>
                  <span class="toggle-desc">Automatically mark unclosed daytime visitor passes as completed at 23:59.</span>
                </div>
                <ce-toggle
                  [checked]="settingsForm.get('autoCheckoutAtMidnight')?.value ?? false"
                  (checkedChange)="onToggle('autoCheckoutAtMidnight', $event)"
                />
              </div>
            </div>
          </section>

          <!-- Card 3: Photo & Consent Policies -->
          <section class="ce-card" aria-labelledby="heading-photo-policies">
            <header class="card-header">
              <h2 id="heading-photo-policies" class="card-title">Photo & Security Policy</h2>
              <p class="card-subtitle">Mandatory webcam/photo identification rules per subject category.</p>
            </header>
            <div class="card-body">
              <div class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-title">Mandatory Photo for Visitors</span>
                  <span class="toggle-desc">Gatehouse attendant must capture entrant photo prior to opening gate.</span>
                </div>
                <ce-toggle
                  [checked]="settingsForm.get('photoRequiredVisitors')?.value ?? false"
                  (checkedChange)="onToggle('photoRequiredVisitors', $event)"
                />
              </div>

              <div class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-title">Mandatory Photo for Service Providers</span>
                  <span class="toggle-desc">Enforce photo badge capture for contractors and maintenance teams.</span>
                </div>
                <ce-toggle
                  [checked]="settingsForm.get('photoRequiredProviders')?.value ?? false"
                  (checkedChange)="onToggle('photoRequiredProviders', $event)"
                />
              </div>

              <div class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-title">Mandatory Photo for Residents</span>
                  <span class="toggle-desc">Require facial identification records for registered dwellers.</span>
                </div>
                <ce-toggle
                  [checked]="settingsForm.get('photoRequiredResidents')?.value ?? false"
                  (checkedChange)="onToggle('photoRequiredResidents', $event)"
                />
              </div>

              <div class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-title">Allow Supervisor Override upon Refusal</span>
                  <span class="toggle-desc">Permit attendants to log an emergency or vouched override when photo consent is withheld.</span>
                </div>
                <ce-toggle
                  [checked]="settingsForm.get('allowOverrideOnRefusal')?.value ?? false"
                  (checkedChange)="onToggle('allowOverrideOnRefusal', $event)"
                />
              </div>
            </div>
          </section>

          <!-- Card 4: Overdue & Safety Alerts -->
          <section class="ce-card" aria-labelledby="heading-alerts">
            <header class="card-header">
              <h2 id="heading-alerts" class="card-title">Alerts & Notifications</h2>
              <p class="card-subtitle">Thresholds for gatehouse notifications and overdue entry escalation.</p>
            </header>
            <div class="card-body">
              <div class="form-group">
                <label for="overdueVisitAlertMinutes">Overdue Warning Threshold (minutes)</label>
                <input
                  id="overdueVisitAlertMinutes"
                  type="number"
                  class="ce-input"
                  formControlName="overdueVisitAlertMinutes"
                  min="0"
                  max="180"
                />
                <span class="field-hint">Time after visit expiration before flashing high-priority gatehouse warning.</span>
              </div>
            </div>
          </section>
        </div>

        <div class="sticky-action-bar">
          <div class="bar-info">
            @if (settingsForm.dirty) {
              <span class="dirty-badge">Unsaved changes</span>
            } @else {
              <span class="saved-badge">All settings up to date</span>
            }
          </div>
          <div class="bar-buttons">
            <button
              type="button"
              class="ce-button variant-ghost"
              [disabled]="!settingsForm.dirty || saving()"
              (click)="revertSettings()"
            >
              Revert
            </button>
            <button
              type="submit"
              class="ce-button variant-primary"
              [disabled]="settingsForm.invalid || saving() || !settingsForm.dirty"
            >
              @if (saving()) {
                Saving...
              } @else {
                Save changes
              }
            </button>
          </div>
        </div>
      </form>
    } @else if (activeTab() === 'audit') {
      <!-- Tab 2: System-Wide Audit Ledger -->
      <div class="audit-section">
        <div class="audit-toolbar">
          <div class="search-wrap">
            <input
              type="search"
              class="ce-input search-input"
              placeholder="Search action, actor, entity, details..."
              [value]="searchTerm()"
              (input)="onSearchInput($event)"
            />
          </div>

          <div class="filter-group">
            <label class="filter-label">
              <span>Category</span>
              <select class="ce-select" [value]="selectedCategory()" (change)="onCategoryChange($event)">
                <option value="">All Categories</option>
                <option value="Gatehouse">Gatehouse</option>
                <option value="Visits">Visits</option>
                <option value="Residents">Residents</option>
                <option value="Apartments">Apartments</option>
                <option value="Security">Security</option>
                <option value="Settings">Settings</option>
                <option value="System">System</option>
              </select>
            </label>

            <label class="filter-label">
              <span>Severity</span>
              <select class="ce-select" [value]="selectedSeverity()" (change)="onSeverityChange($event)">
                <option value="">All Severities</option>
                <option value="Info">Info</option>
                <option value="Warning">Warning</option>
                <option value="SecurityAlert">Security Alert</option>
              </select>
            </label>

            <label class="filter-label">
              <span>Timeframe</span>
              <select class="ce-select" [value]="selectedTimeframe()" (change)="onTimeframeChange($event)">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </label>

            <button class="ce-button variant-ghost btn-reset" (click)="resetAuditFilters()">
              Reset filters
            </button>
          </div>
        </div>

        @if (auditLoading()) {
          <section class="empty-record" aria-live="polite">
            <p class="eyebrow">Audit file / loading</p>
            <h2>Loading audit records</h2>
            <p>Retrieving the latest tenant-scoped audit trail.</p>
          </section>
        } @else if (auditLoadError()) {
          <section class="empty-record audit-load-error" aria-labelledby="audit-load-error-title" role="alert">
            <p class="eyebrow">Audit file / unavailable</p>
            <h2 id="audit-load-error-title">Unable to load audit records</h2>
            <p>{{ auditLoadError() }}</p>
            <button class="ce-button variant-primary" type="button" (click)="loadAuditLogs()">
              Retry loading audit trail
            </button>
          </section>
        } @else if (auditLogs().length) {
          <div class="ce-card table-card">
            <table class="ce-table" aria-label="System audit log table">
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Category</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Details</th>
                  <th scope="col" class="th-actions">Inspect</th>
                </tr>
              </thead>
              <tbody>
                @for (log of auditLogs(); track log.id) {
                  <tr>
                    <td class="cell-time">{{ log.createdAtUtc | date:'short' }}</td>
                    <td>
                      <span class="severity-badge" [class]="log.severity.toLowerCase()">
                        {{ log.severity === 'SecurityAlert' ? 'Alert' : log.severity }}
                      </span>
                    </td>
                    <td><span class="category-pill">{{ log.category }}</span></td>
                    <td><code class="action-code">{{ log.action }}</code></td>
                    <td>{{ log.performedByName || 'System' }}</td>
                    <td>{{ log.entityType }}</td>
                    <td class="cell-details" [title]="log.details ?? ''">{{ log.details || '—' }}</td>
                    <td class="cell-action">
                      <button class="inspect-btn" (click)="inspectEvent(log)">Inspect</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <section class="empty-record" aria-labelledby="empty-audit-title">
            <p class="eyebrow">Audit file / no entries matching filters</p>
            <h2 id="empty-audit-title">No audit records found</h2>
            <p>No system activity matched the selected criteria. Try adjusting your timeframe or category filter.</p>
            <button class="ce-button variant-primary" type="button" (click)="resetAuditFilters()">
              Reset all filters
            </button>
          </section>
        }
      </div>
    } @else if (activeTab() === 'staff' && isTenantAdmin()) {
      <div class="staff-section">
        @if (staffLoading()) {
          <section class="empty-record" aria-live="polite">
            <p class="eyebrow">Staff / loading</p>
            <h2>Loading staff</h2>
            <p>Retrieving the tenant's administrators and gatekeepers.</p>
          </section>
        } @else if (staffLoadError()) {
          <section class="empty-record audit-load-error" aria-labelledby="staff-load-error-title" role="alert">
            <p class="eyebrow">Staff / unavailable</p>
            <h2 id="staff-load-error-title">Unable to load staff</h2>
            <p>{{ staffLoadError() }}</p>
            <button class="ce-button variant-primary" type="button" (click)="loadStaff()">
              Retry loading staff
            </button>
          </section>
        } @else if (staff().length === 0) {
          <section class="empty-record" aria-labelledby="staff-empty-title">
            <p class="eyebrow">Staff / no entries</p>
            <h2 id="staff-empty-title">No staff found</h2>
            <p>This condominium does not have any administrators or gatekeepers to manage.</p>
          </section>
        } @else {
          <section class="ce-card table-card" aria-labelledby="staff-table-title">
            <header class="card-header">
              <h2 id="staff-table-title" class="card-title">Staff & Passwords</h2>
              <p class="card-subtitle">Reset a password to dispatch a temporary one by email. The recipient is forced to choose a new password at next login.</p>
            </header>
            <div class="card-body">
              <table class="ce-table" aria-label="Staff table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col" class="th-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of staff(); track member.userId) {
                    <tr>
                      <td>{{ member.displayName }}</td>
                      <td>{{ member.email }}</td>
                      <td><code class="action-code">{{ member.roles }}</code></td>
                      <td class="cell-action">
                        <button
                          type="button"
                          class="ce-button variant-secondary"
                          [disabled]="resettingUserId() === member.userId"
                          (click)="onResetPassword(member)"
                        >
                          @if (resettingUserId() === member.userId) {
                            Resetting…
                          } @else {
                            Reset password
                          }
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          @if (resetFeedback(); as feedback) {
            <div class="status-banner" [class.error]="feedback.state === 'Failed'">
              <span>{{ feedback.message }}</span>
              <button class="dismiss-btn" (click)="resetFeedback.set(null)">&times;</button>
            </div>
          }
        }
      </div>
    }

    <!-- Inspection Modal -->
    @if (inspectedEvent()) {
      <div class="ce-modal-backdrop" (click)="closeInspect()">
        <div class="ce-modal" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <div>
              <p class="eyebrow">Audit Inspection / {{ inspectedEvent()?.category }}</p>
              <h3>{{ inspectedEvent()?.action }}</h3>
            </div>
            <button class="close-icon" (click)="closeInspect()">&times;</button>
          </header>

          <div class="modal-body">
            <div class="meta-row">
              <div class="meta-item">
                <span class="meta-label">Severity</span>
                <span class="severity-badge" [class]="inspectedEvent()?.severity?.toLowerCase()">
                  {{ inspectedEvent()?.severity }}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Timestamp</span>
                <span class="meta-val">{{ inspectedEvent()?.createdAtUtc | date:'medium' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Actor</span>
                <span class="meta-val">{{ inspectedEvent()?.performedByName || 'System' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Entity</span>
                <span class="meta-val">{{ inspectedEvent()?.entityType }} ({{ inspectedEvent()?.entityId }})</span>
              </div>
            </div>

            <div class="details-box">
              <span class="meta-label">Summary Details</span>
              <p>{{ inspectedEvent()?.details || 'No summary text recorded.' }}</p>
            </div>

            @if (inspectedEvent()?.metadataJson) {
              <div class="metadata-box">
                <span class="meta-label">Event Payload (JSON Metadata)</span>
                <pre class="json-code"><code>{{ formatJson(inspectedEvent()?.metadataJson) }}</code></pre>
              </div>
            }
          </div>

          <footer class="modal-footer">
            <button class="ce-button variant-primary" (click)="closeInspect()">Close</button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: end; gap: var(--space-4, 16px); margin-bottom: var(--space-6, 24px); }
    .eyebrow { margin: 0 0 var(--space-2, 8px); color: var(--color-text-secondary, #6b7280); font: 700 var(--font-size-xs, 12px)/1 var(--font-family-mono, monospace); letter-spacing: .13em; text-transform: uppercase; }
    .page-title { font-family: var(--font-family-display, inherit); font-size: clamp(1.8rem, 2.8vw, 2.6rem); font-weight: 600; letter-spacing: -.03em; margin: 0; color: var(--color-text-primary, #111827); }
    .page-subtitle { color: var(--color-text-secondary, #6b7280); font-size: var(--font-size-sm, 14px); margin-top: 4px; }
    .header-actions { display: flex; gap: var(--space-2, 8px); }

    .status-banner { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3, 12px) var(--space-4, 16px); background: #ecfdf5; border-left: 4px solid #10b981; color: #065f46; font-size: var(--font-size-sm, 14px); margin-bottom: var(--space-4, 16px); border-radius: 4px; }
    .status-banner.error { background: #fef2f2; border-left-color: #ef4444; color: #991b1b; }
    .dismiss-btn { background: none; border: none; font-size: 1.25rem; line-height: 1; cursor: pointer; color: inherit; }

    .tabs { display: flex; gap: 0; margin-bottom: var(--space-5, 20px); border-bottom: 1px solid var(--color-border, #e5e7eb); }
    .tab { border: 0; border-bottom: 3px solid transparent; background: transparent; padding: var(--space-3, 12px) var(--space-4, 16px); cursor: pointer; font: 700 var(--font-size-xs, 12px)/1 var(--font-family-mono, monospace); letter-spacing: .07em; text-transform: uppercase; color: var(--color-text-secondary, #6b7280); }
    .tab.active { color: var(--color-primary, #0066cc); border-color: var(--color-primary, #0066cc); }

    .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr)); gap: var(--space-5, 20px); margin-bottom: 5rem; }
    .ce-card { background: var(--color-surface, #fff); border: 1px solid var(--color-border, #e5e7eb); border-top: 4px solid var(--color-primary, #0066cc); border-radius: 8px; box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.1)); overflow: hidden; }
    .card-header { padding: var(--space-4, 16px) var(--space-5, 20px); border-bottom: 1px solid var(--color-border, #e5e7eb); background: color-mix(in srgb, var(--color-surface, #fff) 96%, #000); }
    .card-title { margin: 0; font-size: 1.15rem; font-weight: 600; color: var(--color-text-primary, #111827); }
    .card-subtitle { margin: 4px 0 0; font-size: var(--font-size-xs, 12px); color: var(--color-text-secondary, #6b7280); }
    .card-body { padding: var(--space-5, 20px); display: flex; flex-direction: column; gap: var(--space-4, 16px); }

    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group label { font-size: var(--font-size-sm, 14px); font-weight: 500; color: var(--color-text-primary, #111827); }
    .field-hint { font-size: var(--font-size-xs, 12px); color: var(--color-text-secondary, #6b7280); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3, 12px); }

    .ce-input, .ce-select { width: 100%; padding: var(--space-2, 8px) var(--space-3, 12px); border: 1px solid var(--color-border, #e5e7eb); border-radius: 6px; font-family: inherit; font-size: var(--font-size-sm, 14px); background: var(--color-surface, #fff); color: var(--color-text-primary, #111827); }
    .ce-input:focus, .ce-select:focus { outline: 2px solid var(--color-primary, #0066cc); outline-offset: 1px; }

    .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3, 12px); padding-top: var(--space-2, 8px); border-top: 1px solid var(--color-border, #f3f4f6); }
    .toggle-info { display: flex; flex-direction: column; gap: 2px; }
    .toggle-title { font-size: var(--font-size-sm, 14px); font-weight: 500; color: var(--color-text-primary, #111827); }
    .toggle-desc { font-size: var(--font-size-xs, 12px); color: var(--color-text-secondary, #6b7280); }

    .sticky-action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--color-surface, #fff); border-top: 1px solid var(--color-border, #e5e7eb); padding: var(--space-3, 12px) var(--space-6, 24px); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 -4px 12px rgba(0,0,0,0.06); z-index: 40; }
    .dirty-badge { font-size: var(--font-size-xs, 12px); font-weight: 600; color: #b45309; background: #fef3c7; padding: 4px 10px; border-radius: 9999px; }
    .saved-badge { font-size: var(--font-size-xs, 12px); color: #059669; }
    .bar-buttons { display: flex; gap: var(--space-3, 12px); }

    .audit-toolbar { display: flex; flex-wrap: wrap; gap: var(--space-3, 12px); margin-bottom: var(--space-4, 16px); background: var(--color-surface, #fff); padding: var(--space-3, 12px); border: 1px solid var(--color-border, #e5e7eb); border-radius: 8px; align-items: center; }
    .staff-section { display: flex; flex-direction: column; gap: var(--space-4, 16px); }
    .search-wrap { flex: 1 1 18rem; }
    .search-input { width: 100%; }
    .filter-group { display: flex; flex-wrap: wrap; gap: var(--space-3, 12px); align-items: center; }
    .filter-label { display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs, 12px); font-weight: 500; color: var(--color-text-secondary, #6b7280); }
    .btn-reset { margin-left: auto; }

    .table-card { overflow-x: auto; }
    .ce-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm, 14px); text-align: left; }
    .ce-table th, .ce-table td { padding: var(--space-3, 12px) var(--space-4, 16px); border-bottom: 1px solid var(--color-border, #e5e7eb); }
    .ce-table thead { background: color-mix(in srgb, var(--color-surface, #fff) 94%, #000); font-family: var(--font-family-mono, monospace); text-transform: uppercase; letter-spacing: .06em; font-size: 0.72rem; color: var(--color-text-secondary, #6b7280); }
    .cell-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .action-code { font-family: var(--font-family-mono, monospace); font-size: 0.8rem; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    .category-pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; background: #e0f2fe; color: #0369a1; font-weight: 500; }
    .severity-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
    .severity-badge.securityalert, .severity-badge.alert { background: #fee2e2; color: #b91c1c; }
    .severity-badge.warning { background: #fef3c7; color: #b45309; }
    .severity-badge.info { background: #f3f4f6; color: #4b5563; }
    .cell-details { max-width: 18rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .inspect-btn { border: 1px solid var(--color-border, #e5e7eb); background: var(--color-surface, #fff); padding: 4px 10px; border-radius: 4px; font-size: var(--font-size-xs, 12px); cursor: pointer; }
    .inspect-btn:hover { background: #f9fafb; border-color: var(--color-primary, #0066cc); color: var(--color-primary, #0066cc); }

    .empty-record { max-width: 36rem; margin: 2rem auto; padding: var(--space-6, 24px); background: var(--color-surface, #fff); border-left: 4px solid var(--color-primary, #0066cc); box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.1)); border-radius: 8px; }
    .empty-record h2 { margin: 0 0 var(--space-2, 8px); font-size: 1.4rem; font-weight: 600; }
    .empty-record p:not(.eyebrow) { color: var(--color-text-secondary, #6b7280); margin-bottom: var(--space-4, 16px); }

    .ce-button { display: inline-flex; align-items: center; justify-content: center; height: 2.35rem; padding: 0 var(--space-4, 16px); border-radius: 6px; font-size: var(--font-size-sm, 14px); font-weight: 500; cursor: pointer; transition: all 120ms ease-in-out; border: 1px solid transparent; }
    .ce-button:disabled { opacity: 0.5; cursor: not-allowed; }
    .variant-primary { background: var(--color-primary, #0066cc); color: #fff; }
    .variant-primary:not(:disabled):hover { opacity: 0.92; }
    .variant-secondary { background: #f3f4f6; color: #111827; border-color: #d1d5db; }
    .variant-secondary:not(:disabled):hover { background: #e5e7eb; }
    .variant-ghost { background: transparent; color: var(--color-text-secondary, #4b5563); }
    .variant-ghost:not(:disabled):hover { background: #f3f4f6; }

    .ce-modal-backdrop { position: fixed; inset: 0; background: rgb(24 40 49 / 0.62); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .ce-modal { background-color: var(--color-surface, #fffdf7); background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgb(93 75 50 / 0.08) 31px, rgb(93 75 50 / 0.08) 32px); border: 1px solid var(--color-border, #c9c1b3); border-top: 4px solid var(--color-sidebar-bg, #182a33); border-radius: 0; width: min(44rem, 92vw); max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-lg, 0 20px 25px -5px rgb(24 40 49 / 0.28)); }
    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-4, 16px) var(--space-5, 20px); border-bottom: 1px solid var(--color-border, #c9c1b3); background: color-mix(in srgb, var(--color-surface, #fffdf7) 92%, var(--color-background, #e8e3d7)); }
    .modal-header .eyebrow { color: var(--color-warning, #7e5c22); }
    .modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 600; }
    .close-icon { background: none; border: none; font-size: 1.5rem; line-height: 1; cursor: pointer; color: var(--color-text-secondary, #52646b); }
    .close-icon:hover { background: var(--color-neutral-light, #ebe6dc); color: var(--color-text-primary, #182831); }
    .close-icon:focus-visible { outline: 2px solid var(--color-primary, #a84d3d); outline-offset: 2px; }
    .modal-body { padding: var(--space-5, 20px); overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4, 16px); }
    .meta-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: var(--space-3, 12px); background: var(--color-surface-elevated, #f6f1e8); border: 1px solid var(--color-border, #c9c1b3); padding: var(--space-3, 12px); border-radius: 0; }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: var(--font-size-xs, 12px); font-weight: 600; color: var(--color-text-secondary, #6b7280); text-transform: uppercase; letter-spacing: .05em; }
    .meta-val { font-size: var(--font-size-sm, 14px); color: var(--color-text-primary, #111827); word-break: break-all; }
    .details-box, .metadata-box { display: flex; flex-direction: column; gap: 4px; }
    .json-code { background: var(--color-sidebar-bg, #182a33); border: 1px solid var(--color-sidebar-border, #34474c); color: var(--color-sidebar-text, #d7ddd5); padding: var(--space-3, 12px); border-radius: 0; font-size: 0.8rem; overflow-x: auto; max-height: 14rem; margin: 0; }
    .modal-footer { padding: var(--space-3, 12px) var(--space-5, 20px); border-top: 1px solid var(--color-border, #c9c1b3); display: flex; justify-content: flex-end; background: var(--color-surface-elevated, #f6f1e8); }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .form-row { grid-template-columns: 1fr; }
      .audit-toolbar { flex-direction: column; align-items: stretch; }
      .filter-group { flex-direction: column; align-items: stretch; }
      .sticky-action-bar { padding: var(--space-2, 8px) var(--space-4, 16px); }
    }
  `],
})
export class AdministrationPage {
  private readonly api = inject(AdministrationApiService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isTenantAdmin = computed(() => this.authService.isTenantAdmin());

  activeTab = signal<'settings' | 'audit' | 'staff'>('settings');
  loading = signal(true);
  saving = signal(false);
  statusMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Settings State
  settings = signal<CondominiumSettingsDto | null>(null);
  settingsForm = this.fb.group({
    visitDurationMinutes: [120, [Validators.required, Validators.min(15), Validators.max(1440)]],
    requireShiftHandoverNotes: [true],
    defaultShiftLengthHours: [8, [Validators.required, Validators.min(1), Validators.max(24)]],
    emergencyContactPhone: [''],
    allowedVisitorStartHour: ['06:00', [Validators.required]],
    allowedVisitorEndHour: ['22:00', [Validators.required]],
    autoCheckoutAtMidnight: [true],
    maxActiveVisitorsPerUnit: [5, [Validators.required, Validators.min(1), Validators.max(100)]],
    photoRequiredVisitors: [true],
    photoRequiredProviders: [true],
    photoRequiredResidents: [false],
    allowOverrideOnRefusal: [true],
    overdueVisitAlertMinutes: [15, [Validators.required, Validators.min(0), Validators.max(180)]],
  });

  // Audit State
  auditLogs = signal<AuditLogResponse[]>([]);
  auditLoading = signal(false);
  auditLoadError = signal<string | null>(null);
  inspectedEvent = signal<AuditLogResponse | null>(null);
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('');
  selectedSeverity = signal<string>('');
  selectedTimeframe = signal<'all' | 'today' | '7d' | '30d'>('all');
  private auditRequestId = 0;

  // Staff & Passwords State
  staff = signal<StaffMemberResponse[]>([]);
  staffLoading = signal(false);
  staffLoadError = signal<string | null>(null);
  resettingUserId = signal<string | null>(null);
  resetFeedback = signal<{ userId: string; message: string; state: string } | null>(null);

  constructor() {
    this.loadAll();
  }

  setTab(tab: 'settings' | 'audit' | 'staff'): void {
    if (tab === 'staff' && !this.isTenantAdmin()) {
      tab = 'settings';
    }
    this.activeTab.set(tab);
    if (tab === 'audit' && this.auditLogs().length === 0) {
      this.loadAuditLogs();
    }
    if (tab === 'staff' && this.staff().length === 0 && !this.staffLoading()) {
      void this.loadStaff();
    }
  }

  loadAll(): void {
    this.loading.set(true);
    this.api.getSettings().subscribe({
      next: (s) => {
        this.settings.set(s);
        this.populateSettingsForm(s);
        this.loadAuditLogs(() => this.loading.set(false));
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  populateSettingsForm(s: CondominiumSettingsDto): void {
    this.settingsForm.reset({
      visitDurationMinutes: s.visitDurationMinutes,
      requireShiftHandoverNotes: s.requireShiftHandoverNotes,
      defaultShiftLengthHours: s.defaultShiftLengthHours,
      emergencyContactPhone: s.emergencyContactPhone || '',
      allowedVisitorStartHour: s.allowedVisitorStartHour,
      allowedVisitorEndHour: s.allowedVisitorEndHour,
      autoCheckoutAtMidnight: s.autoCheckoutAtMidnight,
      maxActiveVisitorsPerUnit: s.maxActiveVisitorsPerUnit,
      photoRequiredVisitors: s.photoRequiredVisitors,
      photoRequiredProviders: s.photoRequiredProviders,
      photoRequiredResidents: s.photoRequiredResidents,
      allowOverrideOnRefusal: s.allowOverrideOnRefusal,
      overdueVisitAlertMinutes: s.overdueVisitAlertMinutes,
    });
  }

  onToggle(field: string, checked: boolean): void {
    const control = this.settingsForm.get(field);
    if (control) {
      control.setValue(checked);
      control.markAsDirty();
    }
  }

  onSaveSettings(): void {
    if (this.settingsForm.invalid) return;
    this.saving.set(true);
    this.statusMessage.set(null);

    const v = this.settingsForm.value;
    this.api.updateSettings({
      visitDurationMinutes: Number(v.visitDurationMinutes),
      requireShiftHandoverNotes: Boolean(v.requireShiftHandoverNotes),
      defaultShiftLengthHours: Number(v.defaultShiftLengthHours),
      emergencyContactPhone: v.emergencyContactPhone || null,
      allowedVisitorStartHour: String(v.allowedVisitorStartHour),
      allowedVisitorEndHour: String(v.allowedVisitorEndHour),
      autoCheckoutAtMidnight: Boolean(v.autoCheckoutAtMidnight),
      maxActiveVisitorsPerUnit: Number(v.maxActiveVisitorsPerUnit),
      photoRequiredVisitors: Boolean(v.photoRequiredVisitors),
      photoRequiredProviders: Boolean(v.photoRequiredProviders),
      photoRequiredResidents: Boolean(v.photoRequiredResidents),
      allowOverrideOnRefusal: Boolean(v.allowOverrideOnRefusal),
      overdueVisitAlertMinutes: Number(v.overdueVisitAlertMinutes),
    }).subscribe({
      next: (updated) => {
        this.settings.set(updated);
        this.populateSettingsForm(updated);
        this.saving.set(false);
        this.statusMessage.set({ text: 'Condominium & gatehouse settings updated successfully.', type: 'success' });
        // Refresh audit logs in background to capture the settings update event
        this.loadAuditLogs();
      },
      error: () => {
        this.saving.set(false);
        this.statusMessage.set({ text: 'Failed to update settings. Please check your inputs.', type: 'error' });
      },
    });
  }

  revertSettings(): void {
    const s = this.settings();
    if (s) {
      this.populateSettingsForm(s);
      this.statusMessage.set(null);
    }
  }

  loadAuditLogs(callback?: () => void): void {
    const requestId = ++this.auditRequestId;
    this.auditLoading.set(true);
    this.auditLoadError.set(null);
    const query: AuditLogQueryParams = {
      skip: 0,
      take: 100,
    };

    if (this.selectedCategory()) query.category = this.selectedCategory();
    if (this.selectedSeverity()) query.severity = this.selectedSeverity();
    if (this.searchTerm()) query.searchTerm = this.searchTerm();

    const tf = this.selectedTimeframe();
    if (tf === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      query.fromUtc = start.toISOString();
    } else if (tf === '7d') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      query.fromUtc = start.toISOString();
    } else if (tf === '30d') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      query.fromUtc = start.toISOString();
    }

    this.api.listAuditLogs(query).subscribe({
      next: (logs) => {
        if (requestId !== this.auditRequestId) {
          callback?.();
          return;
        }

        this.auditLogs.set(logs);
        this.auditLoading.set(false);
        callback?.();
      },
      error: (error: unknown) => {
        if (requestId !== this.auditRequestId) {
          callback?.();
          return;
        }

        this.auditLogs.set([]);
        this.auditLoading.set(false);
        this.auditLoadError.set(this.getAuditLoadErrorMessage(error));
        callback?.();
      },
    });
  }

  private getAuditLoadErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const response = error as { error?: { title?: unknown } };
      if (typeof response.error?.title === 'string' && response.error.title.trim()) {
        return `Unable to load audit records: ${response.error.title.trim()}. Please retry.`;
      }
    }

    return 'Unable to load audit records. Please retry.';
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.loadAuditLogs();
  }

  onCategoryChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedCategory.set(val);
    this.loadAuditLogs();
  }

  onSeverityChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedSeverity.set(val);
    this.loadAuditLogs();
  }

  onTimeframeChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as 'all' | 'today' | '7d' | '30d';
    this.selectedTimeframe.set(val);
    this.loadAuditLogs();
  }

  resetAuditFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set('');
    this.selectedSeverity.set('');
    this.selectedTimeframe.set('all');
    this.loadAuditLogs();
  }

  inspectEvent(event: AuditLogResponse): void {
    this.inspectedEvent.set(event);
  }

  closeInspect(): void {
    this.inspectedEvent.set(null);
  }

  formatJson(raw: string | null | undefined): string {
    if (!raw) return '';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  async loadStaff(): Promise<void> {
    this.staffLoading.set(true);
    this.staffLoadError.set(null);
    try {
      const staff = await firstValueFrom(this.authService.listStaff());
      this.staff.set(staff);
    } catch (err) {
      this.staff.set([]);
      this.staffLoadError.set(getApiErrorMessage(err, 'Failed to load staff.'));
    } finally {
      this.staffLoading.set(false);
    }
  }

  onResetPassword(member: StaffMemberResponse): void {
    const displayName = member.displayName || member.email;
    const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(`Reset the password for ${displayName}? A temporary password will be emailed to them.`)
      : true;
    if (!confirmed) return;

    this.resettingUserId.set(member.userId);
    this.resetFeedback.set(null);
    this.authService.resetUserPassword(member.userId).subscribe({
      next: (res) => {
        this.resettingUserId.set(null);
        const state = res.deliveryState;
        let message = `Temporary password dispatched by email to ${displayName}.`;
        if (state === 'Failed') {
          message = `Email delivery failed for ${displayName}. The temporary password was not dispatched; the user's existing password still works.`;
        } else if (state === 'Pending') {
          message = `Temporary password scheduled for delivery to ${displayName}.`;
        }
        this.resetFeedback.set({ userId: member.userId, message, state });
      },
      error: (err) => {
        this.resettingUserId.set(null);
        this.resetFeedback.set({
          userId: member.userId,
          message: getApiErrorMessage(err, `Failed to reset password for ${displayName}.`),
          state: 'Failed',
        });
      },
    });
  }
}
