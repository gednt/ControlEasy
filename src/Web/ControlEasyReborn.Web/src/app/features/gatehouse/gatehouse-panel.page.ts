import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { ApartmentPickerComponent } from '../../shared/apartment-picker/apartment-picker.component';
import { formatApartmentLabel, ApartmentsApiService, ApartmentResponse } from '../apartments/apartments-api.service';
import { QrPassModalComponent } from '../access-control/components/qr-pass-modal.component';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { ToastService } from '../../design-system/components/toast/toast.component';

export type GatehouseTab = 'qr' | 'manual' | 'walkin' | 'visits';

@Component({
  selector: 'ce-gatehouse-panel-page',
  standalone: true,
  imports: [
    CommonModule,
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
      <header class="gatehouse-header">
        <div class="header-content">
          <p class="eyebrow">Operations desk / gatehouse control</p>
          <div class="title-row">
            <h1 class="page-title">Gatehouse operator panel</h1>
            <div class="header-badges">
              <span class="live-pill" aria-live="polite">
                <span class="pulse-dot"></span>
                <span>Gate active</span>
              </span>
              @if (openVisitsCount() > 0) {
                <span class="onsite-pill">
                  <strong>{{ openVisitsCount() }}</strong> on-site
                </span>
              }
            </div>
          </div>
          <p class="lede">
            Single operator workstation for credential scanning, manual resident lookup, immediate walk-in registration, and open visit management.
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
                    Register a visitor directly at the gate. Visitors registered here land immediately in <strong>Checked-In</strong> status.
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
                        Document: {{ s.visit.visitorDocument }} ·
                        Destination: {{ getApartmentLabel(s.visit.apartmentId) }} ·
                        Time: {{ s.visit.checkedInAtUtc | date: 'shortTime' }}
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
                    <button
                      type="button"
                      class="ce-button variant-primary size-sm"
                      (click)="dismissWalkinSuccess()"
                    >
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
  `,
  styles: [
    `
      .gatehouse-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        color: var(--color-text-primary);
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
        background: rgba(34, 197, 94, 0.12);
        color: rgb(22, 163, 74);
        border: 1px solid rgba(34, 197, 94, 0.25);
      }

      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgb(34, 197, 94);
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
        background: var(--color-surface-muted, #f1f5f9);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }

      .lede {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        max-width: 780px;
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
        background: var(--color-surface-muted, rgba(0, 0, 0, 0.03));
        border-radius: var(--radius-md) var(--radius-md) 0 0;
      }

      .tab-btn.active {
        color: var(--color-primary, #2563eb);
        border-bottom-color: var(--color-primary, #2563eb);
        background: transparent;
      }

      .tab-badge {
        display: inline-block;
        padding: 1px 7px;
        font-size: 0.72rem;
        font-weight: 700;
        border-radius: 9999px;
        background: var(--color-primary, #2563eb);
        color: #fff;
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
        color: var(--color-danger, #ef4444);
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
        border-color: var(--color-primary, #2563eb);
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
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
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: var(--radius-lg);
        color: var(--color-text-primary);
        flex-wrap: wrap;
      }

      .success-header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        color: rgb(21, 128, 61);
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
        background: var(--color-danger-light, #fee2e2);
        color: var(--color-danger, #b91c1c);
        font-size: var(--font-size-sm);
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
export class GatehousePanelPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly visitsApi = inject(VisitsApiService);
  private readonly gateway = inject(GatewayControlService);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  private readonly toast = inject(ToastService);

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

  private apartmentsMap = signal<Map<string, ApartmentResponse>>(new Map());

  readonly walkinForm = this.fb.group({
    visitorName: ['', [Validators.required, Validators.minLength(2)]],
    visitorDocument: ['', [Validators.required, Validators.minLength(3)]],
    visitorPhone: [''],
    apartmentId: [null as string | null, Validators.required],
    purpose: [''],
    generateQrPass: [true],
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
