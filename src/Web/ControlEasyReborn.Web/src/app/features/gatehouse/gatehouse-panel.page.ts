import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CeBadgeComponent,
  CeButtonComponent,
  CeCardComponent,
  CeIconComponent,
  CeModalComponent,
  CeSpinnerComponent,
} from '../../design-system';
import { QrScanPage } from '../access-control/qr-scan.page';
import { ManualLookupPage } from '../access-control/manual-lookup.page';
import { VisitsApiService, VisitResponse } from '../visits/visits-api.service';
import { GatewayControlService } from '../access-control/gateway-control.service';
import { ManualLookupResult } from '../access-control/access-control.types';
import { ApartmentPickerComponent } from '../../shared/apartment-picker/apartment-picker.component';
import { formatApartmentLabel, ApartmentsApiService, ApartmentResponse } from '../apartments/apartments-api.service';
import { QrPassModalComponent } from '../access-control/components/qr-pass-modal.component';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { ToastService } from '../../design-system/components/toast/toast.component';
import { DeviceHealthService, DeviceStatusTransition } from '../devices/device-health.service';
import { GatehouseContextService } from '../access-control/gatehouse-context.service';
import { AuthService } from '../../core/services/auth.service';

export type GatehouseTab = 'qr' | 'manual' | 'walkin' | 'visits';

@Component({
  selector: 'ce-gatehouse-panel-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CeBadgeComponent,
    CeButtonComponent,
    CeCardComponent,
    CeIconComponent,
    CeModalComponent,
    CeSpinnerComponent,
    QrScanPage,
    ManualLookupPage,
    ApartmentPickerComponent,
    QrPassModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gatehouse-container">
      <!-- Phase 26 (DOOR-14): offline-alert toast. Renders above the page header
           when DeviceHealthService emits an online -> offline transition. The
           toast appears for the FIRST device that transitions in a single
           poll cycle (UI-SPEC.md "Visual" - the dashboard is the place to
           see all offline devices, the toast is the gatehouse staff
           "something needs attention" signal). Dismissing only clears the
           local toast (the service retains the transition until the device
           recovers). -->
      @if (currentOfflineAlert(); as alert) {
        <div
          class="device-offline-toast"
          data-test="device-offline-toast"
          role="status"
          aria-live="polite"
        >
          <div class="ce-toast tone-warning">
            <span class="ce-toast-icon" aria-hidden="true">&#x26A0;</span>
            <span class="ce-toast-message">
              <strong>Device offline</strong> &mdash; {{ alert.device.vendor }} at
              {{ alert.device.gatehouseName ?? 'Gatehouse' }} hasn't checked in for
              {{ formatElapsed(alert.device.lastHeartbeatAtUtc) }}.
              <em>Entries should still be created manually until the device is online.</em>
            </span>
            <button
              type="button"
              class="ce-toast-close"
              aria-label="Dismiss"
              (click)="dismissOfflineAlert()"
              data-testid="device-offline-toast-dismiss"
            >&times;</button>
          </div>
        </div>
      }
      <header class="gatehouse-header">
        <div class="header-content">
          <p class="eyebrow">Operations desk / gatehouse control</p>
          <div class="title-row">
            <h1 class="page-title">Gatehouse operator panel</h1>
            <div class="header-badges">
              <ce-button
                variant="secondary"
                size="sm"
                aria-label="Gatehouse only — package drop without entry"
                (click)="openPackageDrop()"
                [disabled]="!gatehouseContext.canRecord()"
                data-testid="package-drop-btn"
              >
                <ce-icon name="package" [size]="16" />
                Package drop (no entry)
              </ce-button>
              <span class="live-pill" [class.is-inactive]="!gatehouseContext.canRecord()" aria-live="polite">
                <span class="pulse-dot"></span>
                <span>{{ gatehouseContext.canRecord() ? 'Gate active' : 'Gate inactive' }}</span>
              </span>
              @if (openVisitsCount() > 0) {
                <span class="onsite-pill">
                  <strong>{{ openVisitsCount() }}</strong> on-site
                </span>
              }
            </div>
          </div>
          <div class="operational-location" data-testid="active-gatehouse-context">
            <label for="active-gatehouse">Recording location</label>
            <select
              id="active-gatehouse"
              [ngModel]="gatehouseContext.selectedGatehouseId()"
              (ngModelChange)="gatehouseContext.select($event || null)"
              [disabled]="gatehouseContext.loading()"
              data-testid="active-gatehouse-select"
            >
              <option [ngValue]="null">Select gatehouse</option>
              @for (gatehouse of gatehouseContext.gatehouses(); track gatehouse.id) {
                <option [ngValue]="gatehouse.id">
                  {{ gatehouse.name }}@if (gatehouse.location) { — {{ gatehouse.location }} }
                </option>
              }
            </select>
            @if (gatehouseContext.loading()) {
              <span class="location-status" role="status">Loading locations…</span>
            } @else if (gatehouseContext.error()) {
              <span class="location-status is-error" role="alert">
                {{ gatehouseContext.error() }}
                <button type="button" class="location-retry" (click)="gatehouseContext.load()">Retry</button>
              </span>
            } @else if (gatehouseContext.gatehouses().length === 0) {
              <span class="location-status" role="status">
                No gatehouse is registered.
                @if (auth.isTenantAdmin()) {
                  <a routerLink="/administration" fragment="door-integration">Configure Door Integration</a>.
                } @else {
                  Ask an authorized administrator to configure Door Integration.
                }
              </span>
            } @else if (!gatehouseContext.selectedGatehouse()) {
              <span class="location-status" role="status">Select a location before recording access.</span>
            }
          </div>
          <p class="lede">
            Single operator workstation for credential scanning, manual resident lookup, immediate walk-in registration,
            and open visit management.
          </p>
        </div>
      </header>

      <nav class="gatehouse-tabs" role="tablist" aria-label="Gatehouse operator tabs">
        <button
          type="button"
          role="tab"
          class="tab-btn"
          [class.active]="activeTab() === 'qr'"
          [attr.aria-selected]="activeTab() === 'qr'"
          (click)="selectTab('qr')"
          data-testid="tab-qr"
        >
          <ce-icon name="camera" [size]="18" />
          <span>Scan QR</span>
        </button>

        <button
          type="button"
          role="tab"
          class="tab-btn"
          [class.active]="activeTab() === 'manual'"
          [attr.aria-selected]="activeTab() === 'manual'"
          (click)="selectTab('manual')"
          data-testid="tab-manual"
        >
          <ce-icon name="search" [size]="18" />
          <span>Manual lookup</span>
        </button>

        <button
          type="button"
          role="tab"
          class="tab-btn"
          [class.active]="activeTab() === 'walkin'"
          [attr.aria-selected]="activeTab() === 'walkin'"
          (click)="selectTab('walkin')"
          data-testid="tab-walkin"
        >
          <ce-icon name="user-check" [size]="18" />
          <span>Walk-in registration</span>
        </button>

        <button
          type="button"
          role="tab"
          class="tab-btn"
          [class.active]="activeTab() === 'visits'"
          [attr.aria-selected]="activeTab() === 'visits'"
          (click)="selectTab('visits')"
          data-testid="tab-visits"
        >
          <ce-icon name="calendar" [size]="18" />
          <span>Open visits</span>
          @if (openVisitsCount() > 0) {
            <span class="tab-badge">{{ openVisitsCount() }}</span>
          }
        </button>
      </nav>

      <main class="tab-content" [attr.aria-label]="activeTabLabel()">
        @switch (activeTab()) {
          @case ('qr') {
            <div class="panel-section" data-testid="panel-qr">
              <ce-qr-scan-page />
            </div>
          }

          @case ('manual') {
            <div class="panel-section" data-testid="panel-manual">
              <ce-manual-lookup-page />
            </div>
          }

          @case ('walkin') {
            <section class="panel-section walkin-section" data-testid="panel-walkin">
              <div class="section-intro">
                <div>
                  <h2 class="section-title">Walk-in visitor registration</h2>
                  <p class="section-subtitle">
                    Register a visitor directly at the gate. Visitors registered here land immediately in
                    <strong>Checked-In</strong> status.
                  </p>
                </div>
              </div>

              @if (walkinError()) {
                <div class="form-error-banner" role="alert">{{ walkinError() }}</div>
              }

              @if (walkinSuccess(); as s) {
                <div class="walkin-success-card" role="status">
                  <div class="success-header">
                    <ce-icon name="check-circle" [size]="24" />
                    <div>
                      <strong>{{ s.visit.visitorName }} checked in successfully!</strong>
                      <p>
                        Document: {{ s.visit.visitorDocument }} · Destination:
                        {{ getApartmentLabel(s.visit.apartmentId) }} · Time:
                        {{ s.visit.checkedInAtUtc | date: 'shortTime' }}
                      </p>
                    </div>
                  </div>
                  <div class="success-actions">
                    @if (s.qrPayload) {
                      <button
                        type="button"
                        class="ce-button variant-secondary size-sm"
                        (click)="viewQrPass(s.qrPayload)"
                      >
                        View QR pass
                      </button>
                    }
                    <button type="button" class="ce-button variant-primary size-sm" (click)="dismissWalkinSuccess()">
                      Register another visitor
                    </button>
                  </div>
                </div>
              }

              <div class="ce-card walkin-card">
                <form [formGroup]="walkinForm" (ngSubmit)="submitWalkin()" class="walkin-form">
                  <div class="form-grid">
                    <label class="field-label">
                      <span>Visitor full name <span class="required">*</span></span>
                      <input
                        type="text"
                        class="ce-input"
                        formControlName="visitorName"
                        placeholder="e.g. Maria Oliveira"
                        required
                        data-testid="walkin-name"
                      />
                    </label>

                    <label class="field-label">
                      <span>Document (CPF / RG) <span class="required">*</span></span>
                      <input
                        type="text"
                        class="ce-input"
                        formControlName="visitorDocument"
                        placeholder="e.g. 123.456.789-00"
                        required
                        data-testid="walkin-document"
                      />
                    </label>

                    <label class="field-label">
                      <span>Phone number (optional)</span>
                      <input
                        type="tel"
                        class="ce-input"
                        formControlName="visitorPhone"
                        placeholder="e.g. (11) 98765-4321"
                        data-testid="walkin-phone"
                      />
                    </label>

                    <div class="field-label">
                      <ce-apartment-picker
                        formControlName="apartmentId"
                        label="Destination apartment"
                        inputId="walkin-apartment"
                        placeholder="Select apartment destination..."
                      />
                    </div>

                    <label class="field-label full-width">
                      <span>Purpose / Notes (optional)</span>
                      <input
                        type="text"
                        class="ce-input"
                        formControlName="purpose"
                        placeholder="e.g. Family visit, food delivery, plumbing repair"
                        data-testid="walkin-purpose"
                      />
                    </label>
                  </div>

                  <div class="walkin-options">
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        formControlName="generateQrPass"
                        class="ce-checkbox"
                        data-testid="walkin-qr-check"
                      />
                      <span>Generate QR access pass for visitor badge</span>
                    </label>
                  </div>

                  <div class="form-actions">
                    <ce-button
                      variant="primary"
                      size="md"
                      type="submit"
                      [disabled]="walkinForm.invalid || walkinSubmitting()"
                      data-testid="walkin-submit-btn"
                    >
                      @if (walkinSubmitting()) {
                        <span class="spinner"></span> Checking in…
                      } @else {
                        Check in visitor now
                      }
                    </ce-button>
                  </div>
                </form>
              </div>
            </section>
          }

          @case ('visits') {
            <section class="panel-section" data-testid="panel-visits">
              <div class="section-intro">
                <div>
                  <h2 class="section-title">Active on-site visitors</h2>
                  <p class="section-subtitle">
                    Visitors currently checked into the condominium. Use quick check-out when the visitor departs.
                  </p>
                </div>
                <div class="section-actions">
                  <button type="button" class="ce-button variant-ghost size-sm" (click)="loadOpenVisits()">
                    <ce-icon name="refresh" [size]="14" /> Refresh list
                  </button>
                </div>
              </div>

              <div class="search-bar">
                <input
                  type="text"
                  class="ce-input search-input"
                  placeholder="Filter by visitor name or document..."
                  [value]="openVisitsSearch()"
                  (input)="onVisitsSearchInput($event)"
                  data-testid="open-visits-search"
                />
              </div>

              @if (visitsError()) {
                <div class="form-error-banner" role="alert">{{ visitsError() }}</div>
              }

              @if (loadingVisits()) {
                <div class="loading-state">
                  <ce-spinner tone="primary" size="md" />
                  <p>Loading on-site visitors…</p>
                </div>
              } @else {
                <div class="ce-card table-card">
                  <table class="ce-table">
                    <thead>
                      <tr>
                        <th>Visitor</th>
                        <th>Document</th>
                        <th>Destination</th>
                        <th>Purpose</th>
                        <th>Checked in</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (visit of filteredOpenVisits(); track visit.id) {
                        <tr>
                          <td>
                            <strong>{{ visit.visitorName }}</strong>
                          </td>
                          <td>{{ visit.visitorDocument }}</td>
                          <td>{{ getApartmentLabel(visit.apartmentId) }}</td>
                          <td>{{ visit.purpose ?? '—' }}</td>
                          <td>
                            <div class="time-cell">
                              <span>{{ visit.checkedInAtUtc | date: 'shortTime' }}</span>
                              <small class="time-relative">{{ formatElapsedTime(visit.checkedInAtUtc) }}</small>
                            </div>
                          </td>
                          <td>
                            <div class="action-cell">
                              <ce-button
                                variant="secondary"
                                size="sm"
                                [disabled]="actionInFlight() === visit.id"
                                (click)="checkOutVisit(visit)"
                                data-testid="checkout-btn"
                              >
                                @if (actionInFlight() === visit.id) {
                                  <span class="spinner"></span>
                                }
                                Check out
                              </ce-button>
                            </div>
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="6" class="empty-cell">
                            <span>—</span>
                            <p>No active on-site visitors found.</p>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>
          }
        }
      </main>
    </div>

    <ce-qr-pass-modal
      [open]="qrPassModalOpen()"
      [qrPayload]="qrPassModalPayload() ?? ''"
      [subjectName]="qrPassSubjectName()"
      (closed)="closeQrPassModal()"
    />

    <ce-modal [open]="packageDropOpen()" title="Register package drop" size="md" (closed)="closePackageDrop()">
      <form class="package-drop-form" [formGroup]="packageDropForm" (ngSubmit)="submitPackageDrop()">
        <p class="package-drop-intro">
          Record a package without registering a visitor or granting entry. Search for the recipient to set its
          destination.
        </p>

        <label class="field-label">
          <span>Recipient name <span class="required">*</span></span>
          <input
            type="search"
            class="ce-input"
            formControlName="recipientQuery"
            placeholder="Search resident name"
            data-testid="package-drop-recipient"
          />
        </label>
        <ce-button
          variant="secondary"
          size="sm"
          type="button"
          [disabled]="packageDropSearching() || packageDropForm.controls.recipientQuery.invalid"
          (click)="searchPackageRecipient()"
        >
          {{ packageDropSearching() ? 'Searching…' : 'Find recipient' }}
        </ce-button>

        @if (packageDropResults().length) {
          <div class="package-drop-results" role="listbox" aria-label="Package recipients">
            @for (recipient of packageDropResults(); track recipient.subjectId) {
              <button
                type="button"
                class="package-drop-recipient"
                [class.selected]="packageDropRecipient()?.subjectId === recipient.subjectId"
                (click)="selectPackageRecipient(recipient)"
              >
                <strong>{{ recipient.displayName }}</strong>
                <span>{{ recipient.apartmentBlock }} / {{ recipient.apartmentUnit }}</span>
              </button>
            }
          </div>
        }

        @if (packageDropRecipient(); as recipient) {
          <p class="package-drop-destination" data-testid="package-drop-destination">
            Deliver to <strong>{{ recipient.displayName }}</strong> — {{ recipient.apartmentBlock }} /
            {{ recipient.apartmentUnit }}
          </p>
        }

        @if (packageDropCondominium()) {
          <p class="package-drop-destination" data-testid="package-drop-destination">
            Deliver to <strong>reception / condominium</strong> (no specific apartment)
          </p>
        }

        @if (!packageDropRecipient() && !packageDropCondominium()) {
          <ce-button
            variant="ghost"
            size="sm"
            type="button"
            class="condominium-trigger"
            [disabled]="packageDropForm.invalid"
            (click)="selectPackageDropCondominium()"
            data-testid="package-drop-condominium-btn"
          >
            <ce-icon name="building" [size]="14" />
            Record reception / condominium drop
          </ce-button>
        }

        <label class="field-label">
          <span>Package description <span class="required">*</span></span>
          <input
            type="text"
            class="ce-input"
            formControlName="packageDescription"
            placeholder="e.g. Two boxes, envelope"
            data-testid="package-drop-description"
          />
        </label>

        <label class="field-label">
          <span>Carrier (optional)</span>
          <input
            type="text"
            class="ce-input"
            formControlName="packageCarrierCode"
            placeholder="e.g. Correios, DHL"
            data-testid="package-drop-carrier"
          />
        </label>

        @if (packageDropError()) {
          <p class="form-error-banner" role="alert">{{ packageDropError() }}</p>
        }

        <div class="form-actions">
          <ce-button variant="ghost" size="md" type="button" (click)="closePackageDrop()">Cancel</ce-button>
          <ce-button
            variant="primary"
            size="md"
            type="submit"
            [disabled]="
              packageDropForm.invalid ||
              (!packageDropRecipient() && !packageDropCondominium()) ||
              packageDropSubmitting() ||
              !gatehouseContext.canRecord()
            "
            data-testid="package-drop-submit"
          >
            {{ packageDropSubmitting() ? 'Recording…' : 'Record package drop' }}
          </ce-button>
        </div>
      </form>
    </ce-modal>
  `,
  styles: [
    `
      .gatehouse-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        color: var(--color-text-primary);
      }

      /* Phase 26 (DOOR-14) — offline-alert toast wrapper. Mirrors the
         ce-toast host styles (background + accent) so the inline toast
         visually matches the global toast service without a host element.
         The toast is dismissible via the .ce-toast-close button. */
      .device-offline-toast {
        margin-top: var(--space-2);
      }
      .device-offline-toast .ce-toast {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
        font-size: var(--font-size-sm);
        min-width: 18rem;
      }
      .device-offline-toast .ce-toast.tone-warning {
        background: var(--color-warning-light);
        color: var(--color-warning);
      }
      .device-offline-toast .ce-toast-message {
        flex: 1;
        line-height: var(--line-height-normal);
      }
      .device-offline-toast .ce-toast-icon {
        font-size: 1rem;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .device-offline-toast .ce-toast-close {
        background: transparent;
        border: 0;
        color: inherit;
        cursor: pointer;
        font-size: 1rem;
        padding: 0;
        line-height: 1;
        opacity: 0.7;
      }
      .device-offline-toast .ce-toast-close:hover {
        opacity: 1;
      }

      .gatehouse-header {
        padding: var(--space-2) 0 var(--space-3);
        border-bottom: 1px solid var(--color-border);
      }

      .header-content {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .eyebrow {
        margin: 0;
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
        color: var(--color-text-secondary);
      }

      .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }

      .page-title {
        margin: 0;
        font-size: var(--font-size-2xl);
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .header-badges {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .live-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: var(--font-size-xs);
        font-weight: 600;
        background: var(--color-success-light);
        color: var(--color-success);
        border: 1px solid color-mix(in oklch, var(--color-success) 35%, transparent);
      }

      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-success);
        animation: pulse-ring 2s infinite ease-in-out;
      }

      @keyframes pulse-ring {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.4;
          transform: scale(0.85);
        }
      }

      .onsite-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: var(--font-size-xs);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }

      .lede {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        max-width: 780px;
      }

      .operational-location {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        padding: var(--space-2) 0;
        border-top: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      .operational-location label {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-semibold);
      }
      .operational-location select {
        min-width: 220px;
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
      }
      .location-status a {
        color: var(--color-primary);
        text-decoration: underline;
      }
      .location-status.is-error {
        color: var(--color-danger);
      }
      .location-retry {
        border: 0;
        padding: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
      }
      .live-pill.is-inactive .pulse-dot {
        background: var(--color-text-muted);
        animation: none;
      }

      .gatehouse-tabs {
        display: flex;
        gap: var(--space-2);
        border-bottom: 2px solid var(--color-border);
        overflow-x: auto;
        padding-bottom: 2px;
      }

      .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        margin-bottom: -2px;
        transition: all 0.15s ease;
        font-family: inherit;
      }

      .tab-btn:hover {
        color: var(--color-text-primary);
        background: var(--color-surface-muted);
        border-radius: var(--radius-md) var(--radius-md) 0 0;
      }

      .tab-btn.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
        background: transparent;
      }

      .tab-badge {
        display: inline-block;
        padding: 1px 7px;
        font-size: 0.72rem;
        font-weight: 700;
        border-radius: 9999px;
        background: var(--color-primary);
        color: var(--color-text-on-primary);
      }

      .tab-content {
        margin-top: var(--space-2);
      }

      .panel-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .section-intro {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .section-title {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: 700;
      }

      .section-subtitle {
        margin: var(--space-1) 0 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .walkin-card {
        padding: var(--space-5);
        border-radius: var(--radius-lg);
      }

      .walkin-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-4);
      }

      .full-width {
        grid-column: 1 / -1;
      }

      .field-label {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--font-size-sm);
        font-weight: 500;
      }

      .required {
        color: var(--color-danger);
      }

      .ce-input {
        width: 100%;
        box-sizing: border-box;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-family: inherit;
        font-size: var(--font-size-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
      }

      .ce-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent);
      }

      .walkin-options {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) 0;
      }

      .checkbox-label {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-sm);
        cursor: pointer;
      }

      .ce-checkbox {
        width: 1.1rem;
        height: 1.1rem;
        cursor: pointer;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
      }

      .walkin-success-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--color-success-light);
        border: 1px solid color-mix(in oklch, var(--color-success) 35%, transparent);
        border-radius: var(--radius-lg);
        color: var(--color-text-primary);
        flex-wrap: wrap;
      }

      .success-header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        color: var(--color-success);
      }

      .success-header p {
        margin: 2px 0 0;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .success-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .form-error-banner {
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-danger-light);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
      }

      .package-drop-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .package-drop-intro,
      .package-drop-destination {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .package-drop-destination {
        padding: var(--space-3);
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }

      .package-drop-results {
        display: grid;
        max-height: 12rem;
        overflow-y: auto;
        border: 1px solid var(--color-border);
      }

      .package-drop-recipient {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 0;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .package-drop-recipient:last-child {
        border-bottom: 0;
      }

      .package-drop-recipient.selected,
      .package-drop-recipient:hover {
        background: var(--color-surface-muted);
      }

      .search-bar {
        display: flex;
        max-width: 400px;
      }

      .search-input {
        width: 100%;
      }

      .table-card {
        overflow-x: auto;
      }

      .ce-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
      }

      .ce-table th {
        text-align: left;
        padding: var(--space-3) var(--space-4);
        border-bottom: 2px solid var(--color-border);
        color: var(--color-text-secondary);
        font-weight: 600;
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .ce-table td {
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        vertical-align: middle;
      }

      .time-cell {
        display: flex;
        flex-direction: column;
      }

      .time-relative {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
      }

      .action-cell {
        display: flex;
        gap: var(--space-2);
      }

      .empty-cell {
        text-align: center;
        padding: var(--space-6) !important;
        color: var(--color-text-secondary);
      }

      .empty-cell p {
        margin: var(--space-1) 0 0;
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-8);
        color: var(--color-text-secondary);
      }

      .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class GatehousePanelPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly visitsApi = inject(VisitsApiService);
  private readonly gateway = inject(GatewayControlService);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  private readonly toast = inject(ToastService);
  // Phase 26 (DOOR-14) — singleton service; the gatehouse-panel is one of
  // two consumers (the other is /devices). The service is idempotent on
  // startPolling/stopPolling, so the page mount triggers polling and the
  // page destroy stops it. (The /devices page does the same when active.)
  private readonly deviceHealth = inject(DeviceHealthService);
  readonly gatehouseContext = inject(GatehouseContextService);
  readonly auth = inject(AuthService);

  readonly activeTab = signal<GatehouseTab>('qr');

  readonly openVisits = signal<VisitResponse[]>([]);
  readonly openVisitsCount = computed(() => this.openVisits().length);
  readonly loadingVisits = signal(false);
  readonly visitsError = signal<string | null>(null);
  readonly openVisitsSearch = signal('');
  readonly actionInFlight = signal<string | null>(null);

  readonly walkinSubmitting = signal(false);
  readonly walkinError = signal<string | null>(null);
  readonly walkinSuccess = signal<{ visit: VisitResponse; qrPayload?: string | null } | null>(null);

  readonly qrPassModalOpen = signal(false);
  readonly qrPassModalPayload = signal<string | null>(null);
  readonly qrPassSubjectName = signal<string>('');
  readonly packageDropOpen = signal(false);
  readonly packageDropSearching = signal(false);
  readonly packageDropSubmitting = signal(false);
  readonly packageDropError = signal<string | null>(null);
  readonly packageDropResults = signal<ManualLookupResult[]>([]);
  readonly packageDropRecipient = signal<ManualLookupResult | null>(null);
  readonly packageDropCondominium = signal(false);
  private packageDropLookupAuditId: string | null = null;

  // Phase 26 (DOOR-14) — current offline-alert transition (local toast
  // state). The DeviceHealthService retains the transition in its own
  // subject until the device recovers — this local signal only controls
  // whether the inline toast wrapper is visible (the user can dismiss it
  // without affecting the service).
  readonly currentOfflineAlert = signal<DeviceStatusTransition | null>(null);
  private deviceHealthSubscription: { unsubscribe: () => void } | null = null;

  private apartmentsMap = signal<Map<string, ApartmentResponse>>(new Map());

  readonly walkinForm = this.fb.group({
    visitorName: ['', [Validators.required, Validators.minLength(2)]],
    visitorDocument: ['', [Validators.required, Validators.minLength(3)]],
    visitorPhone: [''],
    apartmentId: [null as string | null, Validators.required],
    purpose: [''],
    generateQrPass: [true],
  });

  readonly packageDropForm = this.fb.nonNullable.group({
    recipientQuery: ['', [Validators.required, Validators.minLength(3)]],
    packageDescription: ['', [Validators.required, Validators.minLength(1)]],
    packageCarrierCode: [''],
  });

  readonly filteredOpenVisits = computed(() => {
    const list = this.openVisits();
    const query = this.openVisitsSearch().trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (v) =>
        v.visitorName.toLowerCase().includes(query) ||
        v.visitorDocument.toLowerCase().includes(query) ||
        (v.purpose && v.purpose.toLowerCase().includes(query)),
    );
  });

  ngOnInit(): void {
    // 1. Initial tab from route data if provided (e.g. /gatehouse/qr, /gatehouse/manual)
    const initialDataTab = this.route.snapshot.data['initialTab'] as GatehouseTab | undefined;
    if (initialDataTab && this.isValidTab(initialDataTab)) {
      this.activeTab.set(initialDataTab);
    }

    // 2. Query param ?tab=
    this.route.queryParamMap.subscribe((params) => {
      const tabParam = params.get('tab') as GatehouseTab | null;
      if (tabParam && this.isValidTab(tabParam)) {
        this.activeTab.set(tabParam);
      }
    });

    // 3. Preload apartments map and initial open visits count
    this.loadApartments();
    this.gatehouseContext.load();

    // 4. Phase 26 (DOOR-14) — subscribe to offline-alert transitions. The
    //    service is shared with the /devices dashboard; whoever started it
    //    last is responsible for stopping it (this page stops on destroy).
    //    On every online -> offline edge, set the local currentOfflineAlert
    //    signal so the inline toast wrapper appears.
    this.deviceHealthSubscription = this.deviceHealth.offlineAlerts$.subscribe((t) => {
      this.currentOfflineAlert.set(t);
    });
    this.deviceHealth.startPolling(30_000);
    this.loadOpenVisits();
  }

  selectTab(tab: GatehouseTab): void {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });

    if (tab === 'visits') {
      this.loadOpenVisits();
    }
  }

  activeTabLabel(): string {
    switch (this.activeTab()) {
      case 'qr':
        return 'QR Scan Console';
      case 'manual':
        return 'Manual Lookup Console';
      case 'walkin':
        return 'Walk-in Registration Form';
      case 'visits':
        return 'Open Visits Table';
    }
  }

  submitWalkin(): void {
    if (this.walkinForm.invalid || this.walkinSubmitting()) return;

    this.walkinSubmitting.set(true);
    this.walkinError.set(null);
    const value = this.walkinForm.getRawValue();

    this.visitsApi
      .create({
        visitorName: value.visitorName!.trim(),
        visitorDocument: value.visitorDocument!.trim(),
        visitorPhone: value.visitorPhone ? value.visitorPhone.trim() : null,
        apartmentId: value.apartmentId!,
        purpose: value.purpose ? value.purpose.trim() : null,
        checkInNow: true,
      })
      .subscribe({
        next: (visit) => {
          this.walkinSubmitting.set(false);
          this.loadOpenVisits();

          if (value.generateQrPass) {
            this.gateway
              .issueCredential({
                subjectType: 'visitor',
                subjectId: visit.id,
              })
              .subscribe({
                next: (cred) => {
                  this.walkinSuccess.set({ visit, qrPayload: cred.qrPayload });
                  this.walkinForm.reset({ generateQrPass: true });
                  this.toast.info(`Visitor ${visit.visitorName} registered and checked in.`);
                },
                error: () => {
                  this.walkinSuccess.set({ visit, qrPayload: null });
                  this.walkinForm.reset({ generateQrPass: true });
                  this.toast.info(`Visitor ${visit.visitorName} checked in.`);
                },
              });
          } else {
            this.walkinSuccess.set({ visit, qrPayload: null });
            this.walkinForm.reset({ generateQrPass: true });
            this.toast.info(`Visitor ${visit.visitorName} registered and checked in.`);
          }
        },
        error: (err) => {
          this.walkinSubmitting.set(false);
          this.walkinError.set(getApiErrorMessage(err, 'Failed to register walk-in visitor'));
        },
      });
  }

  dismissWalkinSuccess(): void {
    this.walkinSuccess.set(null);
  }

  viewQrPass(payload: string): void {
    const success = this.walkinSuccess();
    this.qrPassSubjectName.set(success?.visit.visitorName ?? 'Visitor');
    this.qrPassModalPayload.set(payload);
    this.qrPassModalOpen.set(true);
  }

  closeQrPassModal(): void {
    this.qrPassModalOpen.set(false);
    this.qrPassModalPayload.set(null);
  }

  openPackageDrop(): void {
    this.packageDropOpen.set(true);
  }

  closePackageDrop(): void {
    this.packageDropOpen.set(false);
    this.packageDropForm.reset();
    this.packageDropSearching.set(false);
    this.packageDropSubmitting.set(false);
    this.packageDropError.set(null);
    this.packageDropResults.set([]);
    this.packageDropRecipient.set(null);
    this.packageDropCondominium.set(false);
    this.packageDropLookupAuditId = null;
  }

  searchPackageRecipient(): void {
    const recipientQuery = this.packageDropForm.controls.recipientQuery.value.trim();
    if (recipientQuery.length < 3 || this.packageDropSearching()) return;

    this.packageDropSearching.set(true);
    this.packageDropError.set(null);
    this.packageDropResults.set([]);
    this.packageDropRecipient.set(null);
    this.packageDropCondominium.set(false);
    this.packageDropLookupAuditId = null;

    this.gateway.searchSubject({ type: 'name', value: recipientQuery, unit: null }).subscribe({
      next: (response) => {
        const eligibleRecipients = response.items.filter((item) => item.apartmentId);
        this.packageDropResults.set(eligibleRecipients);
        this.packageDropLookupAuditId = response.lookupAuditId;
        this.packageDropSearching.set(false);
        if (!eligibleRecipients.length) {
          this.packageDropError.set('No recipient with an active apartment was found.');
        }
      },
      error: (err) => {
        this.packageDropSearching.set(false);
        this.packageDropError.set(getApiErrorMessage(err, 'Failed to search for a recipient.'));
      },
    });
  }

  selectPackageRecipient(recipient: ManualLookupResult): void {
    if (!recipient.apartmentId) return;
    this.packageDropRecipient.set(recipient);
    this.packageDropCondominium.set(false);
    this.packageDropError.set(null);
  }

  selectPackageDropCondominium(): void {
    this.packageDropRecipient.set(null);
    this.packageDropError.set(null);
    if (this.packageDropLookupAuditId) {
      this.packageDropCondominium.set(true);
      return;
    }
    const recipientQuery = this.packageDropForm.controls.recipientQuery.value.trim();
    if (recipientQuery.length < 3) {
      this.packageDropError.set(
        'Type at least 3 characters to identify the subject before recording a condominium drop.',
      );
      return;
    }
    this.gateway.searchSubject({ type: 'name', value: recipientQuery, unit: null }).subscribe({
      next: (response) => {
        this.packageDropLookupAuditId = response.lookupAuditId;
        this.packageDropResults.set(response.items.filter((item) => item.apartmentId));
        this.packageDropCondominium.set(true);
      },
      error: (err) => {
        this.packageDropError.set(
          getApiErrorMessage(err, 'Failed to record a subject lookup for the condominium drop.'),
        );
      },
    });
  }

  submitPackageDrop(): void {
    const recipient = this.packageDropRecipient();
    const isCondominium = this.packageDropCondominium();
    const lookupAuditId = this.packageDropLookupAuditId;
    if (this.packageDropForm.invalid || this.packageDropSubmitting() || !this.gatehouseContext.canRecord()) return;
    if (!isCondominium && !recipient?.apartmentId) return;
    if (!lookupAuditId) {
      this.packageDropError.set('A subject search is required before recording a package drop.');
      return;
    }

    const value = this.packageDropForm.getRawValue();
    this.packageDropSubmitting.set(true);
    this.packageDropError.set(null);
    this.gateway
      .recordPackageDrop({
        lookupAuditId,
        destinationApartmentId: isCondominium ? null : (recipient!.apartmentId ?? null),
        packageDescription: value.packageDescription.trim(),
        packageCarrierCode: value.packageCarrierCode.trim() || null,
        gatehouseId: this.gatehouseContext.selectedGatehouseId()!,
      })
      .subscribe({
        next: () => {
          this.toast.success(
            isCondominium
              ? 'Package drop recorded for reception / condominium.'
              : `Package drop recorded for ${recipient!.apartmentBlock} / ${recipient!.apartmentUnit}.`,
          );
          this.closePackageDrop();
        },
        error: (err) => {
          this.packageDropSubmitting.set(false);
          this.packageDropError.set(getApiErrorMessage(err, 'Failed to record package drop.'));
        },
      });
  }

  loadOpenVisits(): void {
    this.loadingVisits.set(true);
    this.visitsError.set(null);
    this.visitsApi.list('CheckedIn', 0, 100).subscribe({
      next: (list) => {
        this.openVisits.set(list);
        this.loadingVisits.set(false);
      },
      error: (err) => {
        this.loadingVisits.set(false);
        this.visitsError.set(getApiErrorMessage(err, 'Failed to load open visits'));
      },
    });
  }

  checkOutVisit(visit: VisitResponse): void {
    if (this.actionInFlight()) return;
    this.actionInFlight.set(visit.id);
    this.visitsApi.checkOut(visit.id).subscribe({
      next: () => {
        this.actionInFlight.set(null);
        this.toast.info(`Visitor ${visit.visitorName} checked out.`);
        this.loadOpenVisits();
      },
      error: (err) => {
        this.actionInFlight.set(null);
        this.toast.error(getApiErrorMessage(err, 'Failed to check out visitor'));
      },
    });
  }

  onVisitsSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.openVisitsSearch.set(target.value);
  }

  getApartmentLabel(apartmentId?: string | null): string {
    if (!apartmentId) return 'Gatehouse / General';
    const ap = this.apartmentsMap().get(apartmentId);
    return ap ? formatApartmentLabel(ap) : 'Apartment';
  }

  // Phase 26 (DOOR-14) — dismiss the local toast without clearing the
  // service's transition history. The DeviceHealthService still tracks the
  // offline device; the next poll that flips the device back to online
  // (or another device transitions to offline) fires a new alert.
  dismissOfflineAlert(): void {
    this.currentOfflineAlert.set(null);
  }

  // Phase 26 — format "X minutes" / "X hours" relative-time string for the
  // offline toast. Reuses the device->reportingElapsedInterval behaviour
  // already used by the gatehouse-panel's open-visits table.
  formatElapsed(iso: string | null): string {
    if (!iso) return 'a moment';
    const ms = Math.max(0, Date.now() - new Date(iso).getTime());
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return 'a moment';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  }

  ngOnDestroy(): void {
    // Stop polling AND unsubscribe the alert stream. Whoever started the
    // service last is responsible for stopping it — this page mounts the
    // service (so /devices' polling was already idempotent startPolling),
    // so this destroy stops it.
    this.deviceHealthSubscription?.unsubscribe();
    this.deviceHealthSubscription = null;
    this.deviceHealth.stopPolling();
    this.currentOfflineAlert.set(null);
  }

  formatElapsedTime(dateStr?: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffMin = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m on-site`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}m on-site`;
  }

  private loadApartments(): void {
    this.apartmentsApi.list(undefined, 0, 200).subscribe({
      next: (res) => {
        const map = new Map<string, ApartmentResponse>();
        for (const ap of res) {
          map.set(ap.id, ap);
        }
        this.apartmentsMap.set(map);
      },
      error: () => {
        /* non-blocking */
      },
    });
  }

  private isValidTab(tab: string): tab is GatehouseTab {
    return tab === 'qr' || tab === 'manual' || tab === 'walkin' || tab === 'visits';
  }
}
