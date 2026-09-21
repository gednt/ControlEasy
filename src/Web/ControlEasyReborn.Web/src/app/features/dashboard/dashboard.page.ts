import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CeButtonComponent, CeEntryWorkflowComponent, CeIconComponent, CeSpinnerComponent } from '../../design-system';
import { DashboardApiService, DashboardStatsResponse, RecentVisit } from './dashboard-api.service';
import { AuthService } from '../../core/services/auth.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { VisitCreateModalComponent } from '../visits/visit-create-modal.component';

@Component({
  selector: 'ce-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CeButtonComponent,
    CeEntryWorkflowComponent,
    CeIconComponent,
    CeSpinnerComponent,
    VisitCreateModalComponent,
  ],
  template: `
    <header class="ledger-heading">
      <div>
        <p class="eyebrow">Operations desk / live record</p>
        <h1>Shift ledger</h1>
        <p class="lede">One working record for arrivals, residents, and the handover that follows the shift.</p>
      </div>
      <div class="heading-actions">
        <button type="button" class="refresh-record" (click)="refresh()">
          <ce-icon name="refresh" [size]="15" /> Refresh record
        </button>
        @if (canUseGatehouse()) {
          <a routerLink="/gatehouse" [queryParams]="{ tab: 'walkin' }" class="refresh-record" data-testid="dashboard-add-visit-btn">
            <ce-icon name="plus" [size]="15" /> Add visit
          </a>
          <a routerLink="/gatehouse" [queryParams]="{ tab: 'qr' }" class="entry-stamp" data-testid="dashboard-record-access-btn">
            <ce-icon name="plus" [size]="18" /> Record access
          </a>
        }
      </div>
    </header>

    <ce-entry-workflow
      [open]="entryWorkflowOpen()"
      [closeOnEntry]="true"
      (closed)="entryWorkflowOpen.set(false)"
      (entryLogged)="onEntryLogged()"
    />

    <ce-visit-create-modal
      [open]="visitCreateOpen()"
      (closed)="visitCreateOpen.set(false)"
      (created)="onVisitCreated()"
    />

    @if (pageError()) {
      <div class="page-error" role="alert">{{ pageError() }}</div>
    }

    @if (loading()) {
      <div class="loading-state">
        <ce-spinner tone="primary" size="lg" />
        <p>Opening the shift record…</p>
      </div>
    } @else {
      @if (stats(); as current) {
        <div class="ledger-layout">
          <main class="work-ledger" aria-label="Current work ledger">
            <div class="ledger-strip">
              <span>Live register</span>
              <span>{{ current.todayVisits }} entries today</span>
              <span>Updated now</span>
            </div>

            <section class="ledger-totals" aria-label="Operational totals">
              <a routerLink="/visits"
                ><strong>{{ current.openVisits }}</strong
                ><span>Open visits</span></a
              >
              <a routerLink="/residents"
                ><strong>{{ current.activeResidents }}</strong
                ><span>Active residents</span></a
              >
              <a routerLink="/vehicles"
                ><strong>{{ current.activeVehicles }}</strong
                ><span>Vehicles cleared</span></a
              >
              <a routerLink="/apartments"
                ><strong>{{ current.occupiedApartments }}</strong
                ><span>Occupied homes</span></a
              >
            </section>

            <section class="arrival-record" aria-labelledby="arrival-title">
              <div class="record-heading">
                <div>
                  <p class="eyebrow">Queue / current handover</p>
                  <h2 id="arrival-title">Arrival record</h2>
                </div>
                <a routerLink="/visits" class="record-link">Open visit register <span aria-hidden="true">→</span></a>
              </div>

              <div class="column-labels" aria-hidden="true">
                <span>Visitor & purpose</span><span>Destination</span><span>Record state</span><span>Logged</span>
              </div>
              <div class="arrival-list" [class.handoff-updated]="handoffUpdated()">
                @for (visit of current.recentVisits; track visit.id; let first = $first) {
                  <article class="arrival-row" [class.latest-entry]="first && handoffUpdated()">
                    <div class="visitor-cell">
                      <strong>{{ visit.visitorName }}</strong
                      ><span>{{ visit.purpose ?? 'No purpose recorded' }}</span>
                    </div>
                    <div class="destination-cell">{{ visit.apartmentLabel ?? 'Destination pending' }}</div>
                    <div>
                      <span class="record-stamp" [class]="getStatusBadgeClass(visit.status)">{{
                        getStatusLabel(visit.status)
                      }}</span>
                    </div>
                    <time [attr.datetime]="visit.createdAtUtc">{{ visit.createdAtUtc | date: 'shortTime' }}</time>
                  </article>
                } @empty {
                  <div class="empty-ledger">
                    <span>—</span>
                    <p>No arrival has been recorded in this view yet.</p>
                  </div>
                }
              </div>
            </section>
          </main>

          <aside class="handover-panel" aria-label="Resident lookup and shift handover">
            <section class="lookup-record">
              <p class="eyebrow">Directory</p>
              <h2>Find a resident or apartment</h2>
              <p>Open the verified resident record before approving a visitor, vehicle, or service provider.</p>
              <a routerLink="/residents" class="lookup-link"
                ><ce-icon name="search" [size]="17" /> Search resident records</a
              >
              <a routerLink="/apartments" class="lookup-link"
                ><ce-icon name="building" [size]="17" /> Browse apartment register</a
              >
            </section>

            <section class="handover-record" aria-labelledby="handover-title">
              <div class="handover-heading">
                <p class="eyebrow">Chronology</p>
                <span class="archive-mark">Shift file</span>
              </div>
              <h2 id="handover-title">Handover notes</h2>
              @if (handoffUpdated()) {
                <p class="fresh-note">Latest entry added to this handover.</p>
              }
              <ol>
                <li>
                  <span class="timeline-dot"></span>
                  <div>
                    <strong>{{ current.openVisits }} visit{{ current.openVisits === 1 ? '' : 's' }} remain open</strong
                    ><small>Review before close of shift</small>
                  </div>
                </li>
                <li>
                  <span class="timeline-dot"></span>
                  <div>
                    <strong
                      >{{ current.todayVisits }} entry{{ current.todayVisits === 1 ? '' : 's' }} logged today</strong
                    ><small>Source: arrival register</small>
                  </div>
                </li>
                <li>
                  <span class="timeline-dot"></span>
                  <div>
                    <strong>{{ current.totalApartments }} apartment records</strong
                    ><small>{{ current.occupiedApartments }} currently occupied</small>
                  </div>
                </li>
              </ol>
              <a routerLink="/reports" class="handover-link">Review reports and history →</a>
            </section>
          </aside>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--color-text-primary);
      }
      .ledger-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: var(--space-6);
        padding: var(--space-3) 0 var(--space-6);
      }
      .eyebrow {
        margin: 0 0 var(--space-2);
        color: var(--color-text-secondary);
        font: 700 var(--font-size-xs)/1 var(--font-family-mono);
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      h1,
      h2,
      p {
        margin-top: 0;
      }
      h1 {
        font-family: var(--font-family-display);
        font-size: clamp(2.05rem, 3.4vw, 3.35rem);
        font-weight: 500;
        letter-spacing: -0.04em;
        margin-bottom: var(--space-2);
      }
      h2 {
        font-family: var(--font-family-display);
        font-size: var(--font-size-2xl);
        font-weight: 500;
        letter-spacing: -0.025em;
        margin-bottom: var(--space-2);
      }
      .lede {
        max-width: 42rem;
        margin-bottom: 0;
        color: var(--color-text-secondary);
      }
      .heading-actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .refresh-record,
      .entry-stamp {
        min-height: 2.8rem;
        padding: 0 var(--space-4);
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text-primary);
        font: 700 var(--font-size-xs)/1 var(--font-family-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        text-decoration: none;
        box-sizing: border-box;
      }
      .entry-stamp {
        border: 2px solid var(--color-primary);
        background: var(--color-primary);
        color: white;
        box-shadow: 3px 3px 0 #702d25;
        transform: rotate(-1deg);
      }
      .entry-stamp:hover {
        transform: rotate(0deg) translate(-1px, -1px);
        box-shadow: 4px 4px 0 #702d25;
      }
      .refresh-record:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .ledger-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.52fr) minmax(18rem, 0.78fr);
        align-items: start;
        gap: var(--space-6);
      }
      .work-ledger,
      .handover-panel {
        min-width: 0;
      }
      .work-ledger {
        background: var(--color-surface);
        box-shadow: var(--shadow-card);
        border-top: 4px solid var(--color-sidebar);
      }
      .ledger-strip {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-5);
        color: #f8f2e7;
        background: var(--color-sidebar);
        font: 700 var(--font-size-xs)/1 var(--font-family-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .ledger-totals {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        border-bottom: 1px solid var(--color-border);
      }
      .ledger-totals a {
        min-height: 6.7rem;
        padding: var(--space-4) var(--space-4);
        color: inherit;
        text-decoration: none;
        border-right: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background-image: linear-gradient(
          to bottom,
          transparent calc(100% - 1px),
          rgba(67, 52, 32, 0.035) calc(100% - 1px)
        );
        background-size: 100% 1.9rem;
      }
      .ledger-totals a:last-child {
        border-right: 0;
      }
      .ledger-totals a:hover {
        background-color: color-mix(in srgb, var(--color-primary) 6%, transparent);
      }
      .ledger-totals strong {
        font-family: var(--font-family-display);
        font-size: 2rem;
        font-weight: 500;
        line-height: 1;
      }
      .ledger-totals span {
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
        font-weight: 700;
        letter-spacing: 0.055em;
        text-transform: uppercase;
      }
      .arrival-record {
        padding: var(--space-6) var(--space-5) var(--space-4);
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent 31px,
          rgba(79, 60, 35, 0.09) 31px,
          rgba(79, 60, 35, 0.09) 32px
        );
      }
      .record-heading {
        display: flex;
        justify-content: space-between;
        gap: var(--space-4);
        align-items: start;
        margin-bottom: var(--space-5);
      }
      .record-heading h2 {
        margin-bottom: 0;
      }
      .record-link,
      .handover-link {
        color: var(--color-primary);
        font: 700 var(--font-size-xs)/1.3 var(--font-family-mono);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-decoration: none;
      }
      .column-labels,
      .arrival-row {
        display: grid;
        grid-template-columns: 1.5fr 0.84fr 0.8fr 0.52fr;
        gap: var(--space-3);
        align-items: center;
      }
      .column-labels {
        padding: 0 0 var(--space-2);
        color: var(--color-text-secondary);
        font: 700 0.66rem/1 var(--font-family-mono);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .arrival-list {
        border-top: 1px solid var(--color-border);
      }
      .arrival-row {
        min-height: 4.45rem;
        border-bottom: 1px solid rgba(93, 75, 50, 0.22);
        padding: var(--space-2) 0;
        transition: background-color 180ms ease;
      }
      .arrival-row:hover {
        background: color-mix(in srgb, var(--color-primary) 5%, transparent);
      }
      .visitor-cell {
        display: grid;
        gap: 0.2rem;
      }
      .visitor-cell strong {
        font-weight: 700;
      }
      .visitor-cell span,
      .destination-cell,
      time {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      time {
        white-space: nowrap;
        font-family: var(--font-family-mono);
      }
      .record-stamp {
        display: inline-flex;
        width: max-content;
        padding: 0.34rem 0.48rem;
        border: 1px solid currentColor;
        font: 700 0.66rem/1 var(--font-family-mono);
        letter-spacing: 0.075em;
        text-transform: uppercase;
        transform: rotate(-1deg);
      }
      .badge-pending {
        color: #856312;
        background: #fff4cf;
      }
      .badge-onsite {
        color: #32694b;
        background: #e2efe3;
      }
      .badge-done {
        color: #55626b;
        background: #edf0ef;
      }
      .badge-cancelled {
        color: #9d3f36;
        background: #f8e2df;
      }
      .latest-entry {
        animation: move-to-handover 1.1s ease-out both;
      }
      @keyframes move-to-handover {
        0% {
          background: #f7df9b;
          transform: translateX(-1.2rem);
        }
        65% {
          background: #f8efcf;
        }
        100% {
          background: transparent;
          transform: translateX(0);
        }
      }
      .empty-ledger {
        min-height: 12rem;
        display: grid;
        place-content: center;
        text-align: center;
        color: var(--color-text-secondary);
      }
      .empty-ledger span {
        font: 500 3rem/1 var(--font-family-display);
        color: var(--color-primary);
      }
      .handover-panel {
        display: grid;
        gap: var(--space-5);
      }
      .lookup-record,
      .handover-record {
        padding: var(--space-5);
        background: var(--color-surface);
        box-shadow: var(--shadow-card);
      }
      .lookup-record {
        border-top: 4px solid var(--color-warning);
      }
      .lookup-record p:not(.eyebrow) {
        color: var(--color-text-secondary);
        line-height: 1.55;
      }
      .lookup-link {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) 0;
        color: var(--color-text-primary);
        border-top: 1px solid var(--color-border);
        font-size: var(--font-size-sm);
        font-weight: 700;
        text-decoration: none;
      }
      .lookup-link:hover {
        color: var(--color-primary);
      }
      .handover-record {
        border-left: 3px solid var(--color-primary);
        background: color-mix(in srgb, var(--color-surface) 94%, #ead8b0);
      }
      .handover-heading {
        display: flex;
        justify-content: space-between;
      }
      .archive-mark {
        padding: 0.3rem 0.42rem;
        color: var(--color-primary);
        border: 1px solid currentColor;
        font: 700 0.62rem/1 var(--font-family-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transform: rotate(2deg);
      }
      .handover-record ol {
        list-style: none;
        margin: var(--space-5) 0;
        padding: 0;
      }
      .handover-record li {
        position: relative;
        display: grid;
        grid-template-columns: 1rem 1fr;
        gap: var(--space-3);
        padding-bottom: var(--space-5);
      }
      .handover-record li:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 0.7rem;
        left: 0.42rem;
        height: calc(100% - 0.55rem);
        border-left: 1px dashed var(--color-border-strong);
      }
      .timeline-dot {
        z-index: 1;
        width: 0.84rem;
        height: 0.84rem;
        border: 2px solid var(--color-primary);
        background: var(--color-surface);
        border-radius: 50%;
      }
      .handover-record strong,
      .handover-record small {
        display: block;
      }
      .handover-record strong {
        font-size: var(--font-size-sm);
      }
      .handover-record small,
      .fresh-note {
        margin-top: 0.25rem;
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
      }
      .fresh-note {
        padding: var(--space-2);
        background: #f7e6bd;
        color: #6f5018;
      }
      .page-error {
        margin-bottom: var(--space-4);
        padding: var(--space-3) var(--space-4);
        color: var(--color-danger);
        border: 1px solid var(--color-danger);
        background: var(--color-danger-light);
      }
      .loading-state {
        min-height: 40vh;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: var(--space-3);
        color: var(--color-text-secondary);
      }
      @media (max-width: 960px) {
        .ledger-layout {
          grid-template-columns: 1fr;
        }
        .handover-panel {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 680px) {
        .ledger-heading {
          align-items: start;
          flex-direction: column;
        }
        .heading-actions {
          width: 100%;
        }
        .heading-actions button {
          flex: 1;
          justify-content: center;
        }
        .ledger-strip {
          font-size: 0.62rem;
          padding-inline: var(--space-3);
        }
        .ledger-strip span:nth-child(2) {
          display: none;
        }
        .ledger-totals {
          grid-template-columns: 1fr 1fr;
        }
        .ledger-totals a:nth-child(2) {
          border-right: 0;
        }
        .ledger-totals a:nth-child(-n + 2) {
          border-bottom: 1px solid var(--color-border);
        }
        .arrival-record {
          padding-inline: var(--space-3);
        }
        .column-labels {
          display: none;
        }
        .arrival-row {
          grid-template-columns: 1fr auto;
          gap: var(--space-2);
          padding-block: var(--space-3);
        }
        .destination-cell {
          grid-column: 1;
          grid-row: 2;
        }
        .arrival-row > div:nth-child(3) {
          grid-column: 2;
          grid-row: 1;
        }
        .arrival-row time {
          grid-column: 2;
          grid-row: 2;
          font-size: 0.68rem;
        }
        .handover-panel {
          grid-template-columns: 1fr;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .entry-stamp,
        .entry-stamp:hover {
          transform: none;
        }
        .latest-entry {
          animation: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardApiService);
  private readonly auth = inject(AuthService);

  stats = signal<DashboardStatsResponse | null>(null);
  loading = signal(true);
  pageError = signal<string | null>(null);
  entryWorkflowOpen = signal(false);
  visitCreateOpen = signal(false);
  handoffUpdated = signal(false);

  canUseGatehouse = (): boolean =>
    this.auth.roles().includes('AttendantProfile') || this.auth.roles().includes('TenantAdmin');

  onEntryLogged(): void {
    this.handoffUpdated.set(true);
    this.refresh();
    setTimeout(() => this.handoffUpdated.set(false), 1800);
  }

  onVisitCreated(): void {
    this.handoffUpdated.set(true);
    this.refresh();
    setTimeout(() => this.handoffUpdated.set(false), 1800);
  }

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.getStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.pageError.set(getApiErrorMessage(err, 'Failed to load dashboard statistics'));
        this.loading.set(false);
      },
    });
  }

  refresh(): void {
    this.load();
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
}
