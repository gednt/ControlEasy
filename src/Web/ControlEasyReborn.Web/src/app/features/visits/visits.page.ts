import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VisitsApiService, VisitResponse } from './visits-api.service';
import { ApartmentsApiService, formatApartmentLabel } from '../apartments/apartments-api.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { CeButtonComponent, CeModalComponent, CePhotoPanelComponent } from '../../design-system';
import { VisitCreateModalComponent } from './visit-create-modal.component';
import { GatewayControlService } from '../access-control/gateway-control.service';
import { QrPassModalComponent } from '../access-control/components/qr-pass-modal.component';
import { ToastService } from '../../design-system/components/toast/toast.component';

type StatusFilter = 'all' | 'Pending' | 'CheckedIn';

@Component({
  selector: 'ce-visits-page',
  standalone: true,
  imports: [
    CommonModule,
    CeButtonComponent,
    CeModalComponent,
    CePhotoPanelComponent,
    VisitCreateModalComponent,
    QrPassModalComponent,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Visits</h1>
        <p class="page-subtitle">{{ visits().length }} visit records</p>
      </div>
      <button class="ce-button variant-primary size-md" (click)="openCreate()">+ Add visit</button>
    </div>

    <div class="filter-tabs">
      <button class="filter-tab" [class.active]="statusFilter() === 'all'" (click)="setStatusFilter('all')">All</button>
      <button class="filter-tab" [class.active]="statusFilter() === 'Pending'" (click)="setStatusFilter('Pending')">
        Pending
      </button>
      <button class="filter-tab" [class.active]="statusFilter() === 'CheckedIn'" (click)="setStatusFilter('CheckedIn')">
        On-site
      </button>
    </div>

    @if (pageError()) {
      <div class="page-error">{{ pageError() }}</div>
    }

    @if (actionError()) {
      <div class="page-error">{{ actionError() }}</div>
    }

    @if (loading()) {
      <p class="text-secondary">Loading visits...</p>
    } @else {
      <div class="ce-card">
        <table class="ce-table">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Document</th>
              <th>Apartment</th>
              <th>Status</th>
              <th>Checked in</th>
              <th>Checked out</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (visit of visits(); track visit.id) {
              <tr>
                <td>{{ visit.visitorName }}</td>
                <td>{{ visit.visitorDocument }}</td>
                <td>{{ getApartmentLabel(visit.apartmentId) }}</td>
                <td>
                  <span class="ce-badge" [class]="getStatusBadgeClass(visit.status)">
                    {{ getStatusLabel(visit.status) }}
                  </span>
                </td>
                <td>{{ visit.checkedInAtUtc ? (visit.checkedInAtUtc | date: 'short') : '—' }}</td>
                <td>{{ visit.checkedOutAtUtc ? (visit.checkedOutAtUtc | date: 'short') : '—' }}</td>
                <td>
                  <button class="ce-button variant-ghost size-sm" (click)="openPhotos(visit)">Photos</button>
                  @if (visit.status === 'Pending') {
                    <button
                      class="ce-button variant-secondary size-sm"
                      [disabled]="actionInFlight() === visit.id"
                      (click)="onGenerateQrPass(visit)"
                      title="Issue and display QR Access Pass for this visit"
                    >
                      QR Pass
                    </button>
                    <button
                      class="ce-button variant-primary size-sm"
                      [disabled]="actionInFlight() === visit.id"
                      (click)="onCheckIn(visit)"
                    >
                      @if (actionInFlight() === visit.id) {
                        <span class="spinner"></span>
                      }
                      Check in
                    </button>
                  } @else if (visit.status === 'CheckedIn') {
                    <button
                      class="ce-button variant-secondary size-sm"
                      [disabled]="actionInFlight() === visit.id"
                      (click)="onCheckOut(visit)"
                    >
                      @if (actionInFlight() === visit.id) {
                        <span class="spinner"></span>
                      }
                      Check out
                    </button>
                  } @else {
                    <span class="text-secondary text-xs">—</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="text-secondary">No visits yet.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <ce-visit-create-modal [open]="createOpen()" (closed)="closeCreate()" (created)="onVisitCreated($event)" />

    <ce-qr-pass-modal
      [open]="qrPassModalOpen()"
      [qrPayload]="activeQrPayload()"
      [subjectName]="activeSubjectName()"
      [subjectType]="'Visitor'"
      [destination]="activeDestination()"
      (closed)="closeQrPassModal()"
    />

    <ce-modal
      [open]="photosModalOpen()"
      [title]="photosVisit() ? photosVisit()!.visitorName + ' — Photos' : 'Visit photos'"
      size="lg"
      (openChange)="onPhotosModalOpenChange($event)"
    >
      @if (photosModalOpen()) {
        <ce-photo-panel entityType="visitor" [entity]="photosEntity()" [canAdd]="true" [canDelete]="true" />
      }
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closePhotos()">Close</ce-button>
      </div>
    </ce-modal>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-4);
      }
      .page-title {
        font-size: var(--font-size-2xl);
        margin: 0;
      }
      .page-subtitle {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      .filter-tabs {
        display: flex;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
      }
      .filter-tab {
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        padding: var(--space-2) var(--space-4);
        cursor: pointer;
        font-family: inherit;
        font-size: var(--font-size-sm);
      }
      .filter-tab.active {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        border-color: var(--color-primary);
      }
      .page-error {
        margin-bottom: var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-lg);
        background: var(--color-danger-light);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
      }
      .ce-card {
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        overflow: hidden;
      }
      .ce-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
      }
      .ce-table th,
      .ce-table td {
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        text-align: left;
        vertical-align: middle;
      }
      .ce-table thead {
        background: var(--color-neutral-light);
      }
      .ce-badge {
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        border: 1px solid transparent;
      }
      .badge-pending {
        background: var(--color-neutral-light);
        color: var(--color-text-secondary);
      }
      .badge-onsite {
        background: var(--color-success-light);
        color: var(--color-success);
      }
      .badge-done {
        background: var(--color-neutral-light);
        color: var(--color-text-muted);
      }
      .badge-cancelled {
        background: var(--color-danger-light);
        color: var(--color-danger);
      }
      .ce-button {
        border: 0;
        border-radius: var(--radius-lg);
        padding: 0 var(--space-3);
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .ce-button.size-sm {
        height: 2rem;
        font-size: var(--font-size-sm);
      }
      .ce-button.size-md {
        height: 2.5rem;
        padding: 0 var(--space-4);
      }
      .variant-primary {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
      }
      .variant-secondary {
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
      }
      .variant-ghost {
        background: transparent;
      }
      .ce-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      .text-secondary {
        color: var(--color-text-secondary);
      }
      .text-xs {
        font-size: var(--font-size-xs);
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitsPage {
  private readonly api = inject(VisitsApiService);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  private readonly gateway = inject(GatewayControlService);
  private readonly toast = inject(ToastService);

  visits = signal<VisitResponse[]>([]);
  apartmentLabels = signal<Record<string, string>>({});
  loading = signal(true);
  createOpen = signal(false);
  statusFilter = signal<StatusFilter>('all');
  pageError = signal<string | null>(null);
  actionError = signal<string | null>(null);
  actionInFlight = signal<string | null>(null);
  photosModalOpen = signal(false);
  photosVisit = signal<VisitResponse | null>(null);

  // QR Pass modal state
  readonly qrPassModalOpen = signal(false);
  readonly activeQrPayload = signal<string | null>(null);
  readonly activeSubjectName = signal('');
  readonly activeDestination = signal('');

  readonly photosEntity = computed(() => {
    const v = this.photosVisit();
    return v ? { id: v.id, displayName: v.visitorName } : null;
  });

  constructor() {
    this.loadApartmentLabels();
    this.load();
  }

  loadApartmentLabels(): void {
    this.apartmentsApi.list(undefined, 0, 500).subscribe({
      next: (apartments) => {
        const labels: Record<string, string> = {};
        for (const apartment of apartments) {
          labels[apartment.id] = formatApartmentLabel(apartment);
        }
        this.apartmentLabels.set(labels);
      },
    });
  }

  getApartmentLabel(apartmentId: string | null): string {
    if (!apartmentId) return '—';
    return this.apartmentLabels()[apartmentId] ?? apartmentId.slice(0, 8);
  }

  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    const filter = this.statusFilter();
    const status = filter === 'all' ? undefined : filter;
    this.api.list(status).subscribe({
      next: (data) => {
        this.visits.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.pageError.set(getApiErrorMessage(err, 'Failed to load visits'));
        this.loading.set(false);
      },
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'Pending':
        return 'Pending';
      case 'CheckedIn':
        return 'On-site';
      case 'CheckedOut':
        return 'Checked out';
      case 'Cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Pending':
        return 'badge-pending';
      case 'CheckedIn':
        return 'badge-onsite';
      case 'CheckedOut':
        return 'badge-done';
      case 'Cancelled':
        return 'badge-cancelled';
      default:
        return 'badge-pending';
    }
  }

  openCreate(): void {
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  onCheckIn(visit: VisitResponse): void {
    this.actionInFlight.set(visit.id);
    this.actionError.set(null);
    this.api.checkIn(visit.id).subscribe({
      next: () => {
        this.actionInFlight.set(null);
        this.load();
      },
      error: (err) => {
        this.actionInFlight.set(null);
        this.actionError.set(getApiErrorMessage(err, 'Failed to check in visitor'));
      },
    });
  }

  onCheckOut(visit: VisitResponse): void {
    this.actionInFlight.set(visit.id);
    this.actionError.set(null);
    this.api.checkOut(visit.id).subscribe({
      next: () => {
        this.actionInFlight.set(null);
        this.load();
      },
      error: (err) => {
        this.actionInFlight.set(null);
        this.actionError.set(getApiErrorMessage(err, 'Failed to check out visitor'));
      },
    });
  }

  openPhotos(visit: VisitResponse): void {
    this.photosVisit.set(visit);
    this.photosModalOpen.set(true);
  }

  closePhotos(): void {
    this.photosModalOpen.set(false);
    this.photosVisit.set(null);
  }

  onPhotosModalOpenChange(open: boolean): void {
    if (!open) this.closePhotos();
  }

  onVisitCreated(event: { visit: VisitResponse; qrPayload?: string | null }): void {
    this.load();
    if (event.qrPayload) {
      this.activeQrPayload.set(event.qrPayload);
      this.activeSubjectName.set(event.visit.visitorName);
      this.activeDestination.set(this.getApartmentLabel(event.visit.apartmentId));
      this.qrPassModalOpen.set(true);
      this.toast.info('Visit created with QR Access Pass.');
    } else {
      this.toast.info('Visit created.');
    }
  }

  onGenerateQrPass(visit: VisitResponse): void {
    this.actionInFlight.set(visit.id);
    this.gateway
      .issueCredential({
        subjectType: 'visitor',
        subjectId: visit.id,
      })
      .subscribe({
        next: (res) => {
          this.actionInFlight.set(null);
          this.activeQrPayload.set(res.qrPayload);
          this.activeSubjectName.set(visit.visitorName);
          this.activeDestination.set(this.getApartmentLabel(visit.apartmentId));
          this.qrPassModalOpen.set(true);
        },
        error: (err) => {
          if (err?.status === 409) {
            this.gateway.listCredentials('visitor', visit.id, 'active').subscribe({
              next: (list) => {
                if (list.length > 0) {
                  this.gateway.replaceCredential(list[0]!.id).subscribe({
                    next: (res) => {
                      this.actionInFlight.set(null);
                      this.activeQrPayload.set(res.qrPayload);
                      this.activeSubjectName.set(visit.visitorName);
                      this.activeDestination.set(this.getApartmentLabel(visit.apartmentId));
                      this.qrPassModalOpen.set(true);
                    },
                    error: (replaceErr) => {
                      this.actionInFlight.set(null);
                      this.toast.error(getApiErrorMessage(replaceErr, 'Failed to regenerate QR pass'));
                    },
                  });
                } else {
                  this.actionInFlight.set(null);
                  this.toast.error(getApiErrorMessage(err, 'Failed to generate QR pass'));
                }
              },
              error: () => {
                this.actionInFlight.set(null);
                this.toast.error(getApiErrorMessage(err, 'Failed to generate QR pass'));
              },
            });
            return;
          }
          this.actionInFlight.set(null);
          this.toast.error(getApiErrorMessage(err, 'Failed to generate QR pass'));
        },
      });
  }

  closeQrPassModal(): void {
    this.qrPassModalOpen.set(false);
    this.activeQrPayload.set(null);
  }
}
