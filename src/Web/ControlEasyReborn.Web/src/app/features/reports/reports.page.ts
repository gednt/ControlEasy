import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CeBadgeComponent,
  CeButtonComponent,
  CeCardComponent,
  CeIconComponent,
  CeSpinnerComponent,
} from '../../design-system';
import { ReportsService } from '../../api/services/reports.service';
import { HistoryRowResponse } from '../../api/models/history-row-response';
import { VisitCountByDayResponse } from '../../api/models/visit-count-by-day-response';
import { ResidentsPerApartmentResponse } from '../../api/models/residents-per-apartment-response';
import { ApartmentsApiService, ApartmentResponse, formatApartmentLabel } from '../apartments/apartments-api.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export function formatTimestampWithMs(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const pad = (n: number, w = 2): string => n.toString().padStart(w, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}.${ms}`;
}

export function escapeCsvField(val?: string | number | null): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function toLocalDateString(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'ce-reports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CeBadgeComponent,
    CeButtonComponent,
    CeCardComponent,
    CeIconComponent,
    CeSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="reports-container">
      <header class="reports-header">
        <div class="header-info">
          <p class="eyebrow">Operations audit & reports</p>
          <h1 class="page-title">Reports & shift history</h1>
          <p class="lede">
            Unified chronological audit ledger spanning visits, security scans, refused attempts, and package deliveries.
          </p>
        </div>

        <div class="header-controls">
          <div class="preset-group" role="group" aria-label="Date range selector">
            <button
              type="button"
              class="preset-btn"
              [class.active]="datePreset() === 'today'"
              (click)="setPreset('today')"
              data-testid="preset-today"
            >
              Today
            </button>
            <button
              type="button"
              class="preset-btn"
              [class.active]="datePreset() === '7d'"
              (click)="setPreset('7d')"
              data-testid="preset-7d"
            >
              7 Days
            </button>
            <button
              type="button"
              class="preset-btn"
              [class.active]="datePreset() === '30d'"
              (click)="setPreset('30d')"
              data-testid="preset-30d"
            >
              30 Days
            </button>
            <button
              type="button"
              class="preset-btn"
              [class.active]="datePreset() === 'custom'"
              (click)="setPreset('custom')"
              data-testid="preset-custom"
            >
              Custom
            </button>
          </div>

          @if (datePreset() === 'custom') {
            <div class="custom-dates" data-testid="custom-date-inputs">
              <label class="date-label">
                <span>From:</span>
                <input
                  type="date"
                  class="ce-input date-input"
                  [ngModel]="customFrom()"
                  (ngModelChange)="onCustomFromChange($event)"
                  data-testid="input-from"
                />
              </label>
              <label class="date-label">
                <span>To:</span>
                <input
                  type="date"
                  class="ce-input date-input"
                  [ngModel]="customTo()"
                  (ngModelChange)="onCustomToChange($event)"
                  data-testid="input-to"
                />
              </label>
            </div>
          }

          <div class="action-buttons">
            <button
              type="button"
              class="ce-button variant-secondary size-sm"
              (click)="refresh()"
              data-testid="refresh-btn"
            >
              <ce-icon name="refresh" [size]="14" /> Refresh
            </button>
            <button
              type="button"
              class="ce-button variant-primary size-sm export-btn"
              (click)="exportCsv()"
              [disabled]="historyRows().length === 0"
              data-testid="export-csv-btn"
            >
              <ce-icon name="download" [size]="14" /> Export CSV
            </button>
          </div>
        </div>
      </header>

      <!-- Summaries row -->
      <section class="summaries-grid" aria-label="Key operational metrics">
        <div class="summary-card">
          <div class="summary-header">
            <div class="summary-icon"><ce-icon name="calendar" [size]="18" /></div>
            <div>
              <h2 class="summary-title">Daily visit volume</h2>
              <p class="summary-subtitle">Total arrivals in selected timeframe: <strong>{{ totalPeriodVisits() }}</strong></p>
            </div>
          </div>

          @if (loadingSummaries()) {
            <div class="card-loading"><ce-spinner tone="primary" size="sm" /></div>
          } @else {
            <div class="visit-counts-list">
              @for (day of visitCounts(); track day.date) {
                <div class="count-row">
                  <span class="count-date">{{ day.date | date: 'mediumDate' }}</span>
                  <div class="count-bar-container">
                    <div
                      class="count-bar"
                      [style.width.%]="calcCountPercent(day.count)"
                    ></div>
                  </div>
                  <strong class="count-val">{{ day.count }}</strong>
                </div>
              } @empty {
                <p class="empty-text">No visits recorded in this range.</p>
              }
            </div>
          }
        </div>

        <div class="summary-card">
          <div class="summary-header">
            <div class="summary-icon"><ce-icon name="building" [size]="18" /></div>
            <div>
              <h2 class="summary-title">Apartment occupancy</h2>
              <p class="summary-subtitle">Residents per registered unit</p>
            </div>
          </div>

          @if (loadingSummaries()) {
            <div class="card-loading"><ce-spinner tone="primary" size="sm" /></div>
          } @else {
            <div class="apt-counts-list">
              @for (item of topApartments(); track item.apartmentId) {
                <div class="apt-row">
                  <span class="apt-name">{{ getApartmentLabel(item.apartmentId) }}</span>
                  <span class="apt-badge">{{ item.count }} resident{{ item.count === 1 ? '' : 's' }}</span>
                </div>
              } @empty {
                <p class="empty-text">No apartment resident data.</p>
              }
            </div>
          }
        </div>
      </section>

      <!-- Unified Ledger Table Section -->
      <section class="ledger-section" aria-label="Unified historical ledger">
        <div class="ledger-toolbar">
          <div class="filter-controls">
            <div class="search-field">
              <ce-icon name="search" [size]="16" class="search-icon" />
              <input
                type="text"
                class="ce-input search-input"
                placeholder="Search by subject, package description, or purpose..."
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchChange($event)"
                data-testid="ledger-search-input"
              />
            </div>

            <select
              class="ce-select filter-select"
              [ngModel]="statusFilter()"
              (ngModelChange)="onStatusChange($event)"
              data-testid="status-filter-select"
            >
              <option value="">All statuses</option>
              <option value="CheckedIn">Checked In / On-site</option>
              <option value="Pending">Pending arrival</option>
              <option value="CheckedOut">Checked Out</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <input
              type="text"
              class="ce-input carrier-input"
              placeholder="Carrier code (e.g. SEDEX)"
              [ngModel]="carrierFilter()"
              (ngModelChange)="onCarrierChange($event)"
              data-testid="carrier-filter-input"
            />
          </div>

          <div class="table-meta">
            <span class="total-count-badge">
              <strong>{{ totalCount() }}</strong> ledger record{{ totalCount() === 1 ? '' : 's' }}
            </span>
          </div>
        </div>

        @if (historyError()) {
          <div class="form-error-banner" role="alert">{{ historyError() }}</div>
        }

        <div class="ce-card table-card">
          @if (loadingHistory()) {
            <div class="loading-state">
              <ce-spinner tone="primary" size="md" />
              <p>Fetching unified history records…</p>
            </div>
          } @else {
            <table class="ce-table" data-testid="reports-history-table">
              <thead>
                <tr>
                  <th>Occurred at</th>
                  <th>Kind</th>
                  <th>Subject</th>
                  <th>Destination</th>
                  <th>State</th>
                  <th>Notes & delivery details</th>
                </tr>
              </thead>
              <tbody>
                @for (row of historyRows(); track row.id) {
                  <tr>
                    <td>
                      <div class="timestamp-cell">
                        <strong>{{ row.occurredAt | date: 'shortDate' }}</strong>
                        <span class="sub-time">{{ row.occurredAt | date: 'mediumTime' }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="kind-badge" [class]="getKindClass(row.kind)">
                        {{ getKindLabel(row.kind) }}
                      </span>
                    </td>
                    <td>
                      <div class="subject-cell">
                        <strong>{{ row.subjectName || '—' }}</strong>
                        @if (row.subjectDocument) {
                          <span class="doc-text">{{ row.subjectDocument }}</span>
                        }
                        @if (row.subjectType) {
                          <small class="type-tag">{{ row.subjectType }}</small>
                        }
                      </div>
                    </td>
                    <td>{{ row.destinationLabel || getApartmentLabel(row.apartmentId) }}</td>
                    <td>
                      <span class="state-badge" [class]="getStateClass(row.nativeState)">
                        {{ row.nativeState || '—' }}
                      </span>
                    </td>
                    <td>
                      <div class="notes-cell">
                        @if (row.purpose) {
                          <span>{{ row.purpose }}</span>
                        }
                        @if (row.packageDescription) {
                          <div class="pkg-tag">
                            <ce-icon name="package" [size]="12" />
                            <span>{{ row.packageDescription }}</span>
                          </div>
                        }
                        @if (row.packageCarrierCode) {
                          <span class="carrier-tag">{{ row.packageCarrierCode }}</span>
                        }
                        @if (!row.purpose && !row.packageDescription && !row.packageCarrierCode) {
                          <span class="empty-dash">—</span>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty-cell">
                      <span>—</span>
                      <p>No historical records matching the selected parameters.</p>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (totalPages() > 1) {
              <footer class="pagination-footer">
                <span class="page-info">
                  Page <strong>{{ page() }}</strong> of <strong>{{ totalPages() }}</strong>
                </span>
                <div class="page-actions">
                  <button
                    type="button"
                    class="ce-button variant-ghost size-sm"
                    [disabled]="page() <= 1"
                    (click)="changePage(page() - 1)"
                    data-testid="page-prev-btn"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    class="ce-button variant-ghost size-sm"
                    [disabled]="page() >= totalPages()"
                    (click)="changePage(page() + 1)"
                    data-testid="page-next-btn"
                  >
                    Next
                  </button>
                </div>
              </footer>
            }
          }
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .reports-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        color: var(--color-text-primary);
      }

      .reports-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding-bottom: var(--space-4);
        border-bottom: 1px solid var(--color-border);
      }

      .header-info {
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

      .page-title {
        margin: 0;
        font-size: var(--font-size-2xl);
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .lede {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        max-width: 800px;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
        justify-content: space-between;
      }

      .preset-group {
        display: inline-flex;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted, #f8fafc);
        overflow: hidden;
      }

      .preset-btn {
        padding: var(--space-2) var(--space-3);
        background: transparent;
        border: none;
        font-size: var(--font-size-sm);
        font-weight: 600;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        font-family: inherit;
      }

      .preset-btn:not(:last-child) {
        border-right: 1px solid var(--color-border);
      }

      .preset-btn:hover {
        background: rgba(0, 0, 0, 0.04);
        color: var(--color-text-primary);
      }

      .preset-btn.active {
        background: var(--color-primary, #2563eb);
        color: #fff;
      }

      .custom-dates {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .date-label {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--font-size-xs);
        font-weight: 600;
      }

      .date-input {
        padding: var(--space-1) var(--space-2);
        font-size: var(--font-size-sm);
      }

      .action-buttons {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .export-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .summaries-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: var(--space-4);
      }

      .summary-card {
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .summary-header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .summary-icon {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        background: var(--color-surface-muted, #f1f5f9);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-primary, #2563eb);
      }

      .summary-title {
        margin: 0;
        font-size: var(--font-size-md);
        font-weight: 700;
      }

      .summary-subtitle {
        margin: 2px 0 0;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .visit-counts-list,
      .apt-counts-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        max-height: 180px;
        overflow-y: auto;
      }

      .count-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-xs);
      }

      .count-date {
        min-width: 90px;
        color: var(--color-text-secondary);
      }

      .count-bar-container {
        flex: 1;
        height: 8px;
        background: var(--color-surface-muted, #f1f5f9);
        border-radius: 9999px;
        overflow: hidden;
      }

      .count-bar {
        height: 100%;
        background: var(--color-primary, #2563eb);
        border-radius: 9999px;
        transition: width 0.3s ease;
      }

      .count-val {
        min-width: 24px;
        text-align: right;
      }

      .apt-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-1) 0;
        border-bottom: 1px solid var(--color-border);
        font-size: var(--font-size-xs);
      }

      .apt-badge {
        padding: 2px 8px;
        border-radius: 9999px;
        background: var(--color-surface-muted, #f1f5f9);
        color: var(--color-text-secondary);
        font-weight: 600;
      }

      .empty-text {
        margin: 0;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        font-style: italic;
      }

      .card-loading {
        display: flex;
        justify-content: center;
        padding: var(--space-4);
      }

      .ledger-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .ledger-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }

      .filter-controls {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .search-field {
        position: relative;
        display: flex;
        align-items: center;
        min-width: 260px;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        color: var(--color-text-secondary);
        pointer-events: none;
      }

      .search-input {
        padding-left: 32px;
      }

      .filter-select,
      .carrier-input {
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-family: inherit;
      }

      .carrier-input {
        max-width: 180px;
      }

      .total-count-badge {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .table-card {
        overflow-x: auto;
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
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
        background: var(--color-surface-muted, #f8fafc);
      }

      .ce-table td {
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        vertical-align: top;
      }

      .timestamp-cell {
        display: flex;
        flex-direction: column;
      }

      .sub-time {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
      }

      .kind-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .kind-visit {
        background: rgba(37, 99, 235, 0.12);
        color: rgb(37, 99, 235);
      }

      .kind-event {
        background: rgba(100, 116, 139, 0.12);
        color: rgb(71, 85, 105);
      }

      .kind-package {
        background: rgba(147, 51, 234, 0.12);
        color: rgb(147, 51, 234);
      }

      .kind-refused {
        background: rgba(239, 68, 68, 0.12);
        color: rgb(220, 38, 38);
      }

      .kind-legacy {
        background: rgba(245, 158, 11, 0.12);
        color: rgb(180, 83, 9);
      }

      .subject-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .doc-text {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        font-family: monospace;
      }

      .type-tag {
        font-size: 0.7rem;
        text-transform: capitalize;
        color: var(--color-text-secondary);
      }

      .state-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .state-checkedin {
        background: rgba(34, 197, 94, 0.15);
        color: rgb(22, 163, 74);
      }

      .state-pending {
        background: rgba(234, 179, 8, 0.15);
        color: rgb(161, 98, 7);
      }

      .state-checkedout {
        background: rgba(100, 116, 139, 0.15);
        color: rgb(71, 85, 105);
      }

      .state-refused {
        background: rgba(239, 68, 68, 0.15);
        color: rgb(220, 38, 38);
      }

      .state-default {
        background: var(--color-surface-muted, #f1f5f9);
        color: var(--color-text-secondary);
      }

      .notes-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.8rem;
      }

      .pkg-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: rgb(109, 40, 217);
      }

      .carrier-tag {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(109, 40, 217, 0.1);
        color: rgb(109, 40, 217);
        font-weight: 600;
        font-size: 0.72rem;
        width: fit-content;
      }

      .empty-dash {
        color: var(--color-text-secondary);
      }

      .empty-cell {
        text-align: center;
        padding: var(--space-6) !important;
        color: var(--color-text-secondary);
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-8);
        color: var(--color-text-secondary);
      }

      .pagination-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--color-border);
      }

      .page-info {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .page-actions {
        display: flex;
        gap: var(--space-2);
      }

      .form-error-banner {
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-danger-light, #fee2e2);
        color: var(--color-danger, #b91c1c);
        font-size: var(--font-size-sm);
      }

      .ce-input {
        box-sizing: border-box;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-family: inherit;
      }
    `,
  ],
})
export class ReportsPage implements OnInit {
  private readonly reportsApi = inject(ReportsService);
  private readonly apartmentsApi = inject(ApartmentsApiService);

  readonly datePreset = signal<DateRangePreset>('today');
  readonly customFrom = signal<string>(toLocalDateString(new Date()));
  readonly customTo = signal<string>(toLocalDateString(new Date()));

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly carrierFilter = signal('');

  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly totalCount = signal(0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  readonly loadingHistory = signal(false);
  readonly historyRows = signal<HistoryRowResponse[]>([]);
  readonly historyError = signal<string | null>(null);

  readonly loadingSummaries = signal(false);
  readonly visitCounts = signal<VisitCountByDayResponse[]>([]);
  readonly residentsPerApartment = signal<ResidentsPerApartmentResponse[]>([]);

  private apartmentsMap = signal<Map<string, ApartmentResponse>>(new Map());

  readonly totalPeriodVisits = computed(() =>
    this.visitCounts().reduce((acc, cur) => acc + (cur.count ?? 0), 0),
  );

  readonly topApartments = computed(() => {
    return [...this.residentsPerApartment()]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 10);
  });

  private maxDayCount = computed(() =>
    Math.max(1, ...this.visitCounts().map((v) => v.count ?? 0)),
  );

  ngOnInit(): void {
    this.loadApartments();
    this.loadAll();
  }

  setPreset(preset: DateRangePreset): void {
    this.datePreset.set(preset);
    this.page.set(1);
    this.loadAll();
  }

  onCustomFromChange(val: string): void {
    this.customFrom.set(val);
    this.page.set(1);
    this.loadAll();
  }

  onCustomToChange(val: string): void {
    this.customTo.set(val);
    this.page.set(1);
    this.loadAll();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.page.set(1);
    this.loadHistory();
  }

  onStatusChange(status: string): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadHistory();
  }

  onCarrierChange(code: string): void {
    this.carrierFilter.set(code);
    this.page.set(1);
    this.loadHistory();
  }

  changePage(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages()) return;
    this.page.set(newPage);
    this.loadHistory();
  }

  refresh(): void {
    this.loadAll();
  }

  calcCountPercent(count?: number): number {
    if (!count) return 0;
    return Math.min(100, Math.round((count / this.maxDayCount()) * 100));
  }

  getKindLabel(kind?: string | null): string {
    switch (kind) {
      case 'visit':
        return 'Visit';
      case 'package-drop':
        return 'Package';
      case 'refused-scan':
        return 'Refusal';
      case 'security-event':
        return 'Security';
      case 'legacy-entry-log':
        return 'Legacy Entry';
      default:
        return kind || 'Event';
    }
  }

  getKindClass(kind?: string | null): string {
    switch (kind) {
      case 'visit':
        return 'kind-visit';
      case 'package-drop':
        return 'kind-package';
      case 'refused-scan':
        return 'kind-refused';
      case 'security-event':
        return 'kind-event';
      case 'legacy-entry-log':
        return 'kind-legacy';
      default:
        return 'kind-event';
    }
  }

  getStateClass(state?: string | null): string {
    switch (state) {
      case 'CheckedIn':
        return 'state-checkedin';
      case 'Pending':
        return 'state-pending';
      case 'CheckedOut':
        return 'state-checkedout';
      case 'Refused':
        return 'state-refused';
      default:
        return 'state-default';
    }
  }

  getApartmentLabel(apartmentId?: string | null): string {
    if (!apartmentId) return '—';
    const ap = this.apartmentsMap().get(apartmentId);
    return ap ? formatApartmentLabel(ap) : 'Apartment';
  }

  exportCsv(): void {
    const rows = this.historyRows();
    if (rows.length === 0) return;

    const headers = [
      'OccurredAt',
      'Kind',
      'Source',
      'NativeState',
      'SubjectType',
      'SubjectName',
      'SubjectDocument',
      'Destination',
      'Purpose',
      'PackageDescription',
      'PackageCarrierCode',
    ];

    const lines = [headers.map((h) => `"${h}"`).join(',')];

    for (const r of rows) {
      const destination = r.destinationLabel || this.getApartmentLabel(r.apartmentId);
      const values = [
        formatTimestampWithMs(r.occurredAt),
        r.kind ?? '',
        r.source ?? '',
        r.nativeState ?? '',
        r.subjectType ?? '',
        r.subjectName ?? '',
        r.subjectDocument ?? '',
        destination,
        r.purpose ?? '',
        r.packageDescription ?? '',
        r.packageCarrierCode ?? '',
      ];
      lines.push(values.map(escapeCsvField).join(','));
    }

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `reports-history-${filenameDate}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private getDateBounds(): { from?: string; to?: string } {
    const now = new Date();
    const preset = this.datePreset();

    if (preset === 'today') {
      const todayStr = toLocalDateString(now);
      return { from: todayStr, to: todayStr };
    }

    if (preset === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: toLocalDateString(past), to: toLocalDateString(now) };
    }

    if (preset === '30d') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: toLocalDateString(past), to: toLocalDateString(now) };
    }

    // Custom
    const from = this.customFrom();
    const to = this.customTo();
    const res: { from?: string; to?: string } = {};
    if (from) res.from = from;
    if (to) res.to = to;
    return res;
  }

  private loadAll(): void {
    this.loadSummaries();
    this.loadHistory();
  }

  private loadSummaries(): void {
    const bounds = this.getDateBounds();
    this.loadingSummaries.set(true);

    const countsParams: { from?: string; to?: string } = {};
    if (bounds.from) countsParams.from = bounds.from;
    if (bounds.to) countsParams.to = bounds.to;

    this.reportsApi
      .apiV1ReportsVisitCountsByDayGet(countsParams)
      .subscribe({
        next: (counts) => {
          this.visitCounts.set(counts);
          this.loadingSummaries.set(false);
        },
        error: () => {
          this.loadingSummaries.set(false);
        },
      });

    this.reportsApi.apiV1ReportsResidentsPerApartmentGet().subscribe({
      next: (res) => {
        this.residentsPerApartment.set(res);
      },
      error: () => {
        /* non-blocking */
      },
    });
  }

  private loadHistory(): void {
    const bounds = this.getDateBounds();
    this.loadingHistory.set(true);
    this.historyError.set(null);

    const params: {
      page: number;
      pageSize: number;
      from?: string;
      to?: string;
      q?: string;
      status?: string;
      carrierCode?: string;
      apartmentId?: string;
    } = {
      page: this.page(),
      pageSize: this.pageSize(),
    };

    if (bounds.from) params.from = bounds.from;
    if (bounds.to) params.to = bounds.to;
    const q = this.searchQuery().trim();
    if (q) params.q = q;
    const status = this.statusFilter();
    if (status) params.status = status;
    const carrier = this.carrierFilter().trim();
    if (carrier) params.carrierCode = carrier;

    this.reportsApi.apiV1ReportsHistoryGet$Response(params).subscribe({
      next: (res) => {
        this.historyRows.set(res.body ?? []);
        this.loadingHistory.set(false);

        const totalHeader = res.headers.get('X-Total-Count');
        if (totalHeader) {
          const parsed = parseInt(totalHeader, 10);
          if (!isNaN(parsed)) {
            this.totalCount.set(parsed);
          } else {
            this.totalCount.set(res.body?.length ?? 0);
          }
        } else {
          this.totalCount.set(res.body?.length ?? 0);
        }
      },
      error: (err) => {
        this.loadingHistory.set(false);
        this.historyError.set(getApiErrorMessage(err, 'Failed to load report history'));
      },
    });
  }

  private loadApartments(): void {
    this.apartmentsApi.list(undefined, 0, 300).subscribe({
      next: (list) => {
        const map = new Map<string, ApartmentResponse>();
        for (const ap of list) {
          map.set(ap.id, ap);
        }
        this.apartmentsMap.set(map);
      },
      error: () => {
        /* non-blocking */
      },
    });
  }
}
