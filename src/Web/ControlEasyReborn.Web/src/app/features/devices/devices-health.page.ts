import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CeBadgeComponent } from '../../design-system/components/badge/badge.component';
import { CeButtonComponent } from '../../design-system/components/button/button.component';
import { CeCardComponent } from '../../design-system/components/card/card.component';
import { CeIconComponent } from '../../design-system/components/icon/icon.component';
import { CeSpinnerComponent } from '../../design-system/components/spinner/spinner.component';
import { CeTooltipDirective } from '../../design-system/components/tooltip/tooltip.directive';
import { DeviceHealthService } from './device-health.service';
import { DeviceHealthDto, DeviceStatus } from './door-unlock.types';
import { DeviceSimulatorService } from './device-simulator.service';
import { DeviceSimulatorSectionComponent } from './components/device-simulator-section.component';
import { DeviceConfigureModalComponent } from './components/device-configure-modal.component';
import { GatehouseContextService } from '../access-control/gatehouse-context.service';
import { ToastService } from '../../design-system/components/toast/toast.component';
import { AuthService } from '../../core/services/auth.service';
import { ConfigureGatehouseOption } from './components/device-configure-modal.component';

// Phase 26 (DOOR-13) — Device health dashboard page.
//
// Route: /devices (TenantAdmin or Porteiro role). The page renders the
// DeviceHealthService's reactive snapshot. Auto-refresh at 30s polling
// cadence (configurable via the service startPolling() arg). Status
// badges map online/offline/degraded to success/warning/danger tones.
//
// Recovery is automatic: when a heartbeat resumes the status flips back
// to online/degraded and the badge updates within one polling interval.
// No manual intervention needed.
@Component({
  selector: 'ce-devices-health-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    CeBadgeComponent,
    CeButtonComponent,
    CeCardComponent,
    CeIconComponent,
    CeSpinnerComponent,
    CeTooltipDirective,
    DeviceSimulatorSectionComponent,
    DeviceConfigureModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <p class="eyebrow">Hardware observability</p>
        <h1 class="page-title">Device health</h1>
        <p class="page-subtitle">
          Per-device status from the latest heartbeats. Use manual entry if a device is offline.
        </p>
      </div>
      <div class="header-actions">
        <ce-button
          variant="secondary"
          size="sm"
          (click)="refreshNow()"
          data-testid="refresh-btn"
        >
          <ce-icon name="refresh" [size]="14" />
          Refresh
        </ce-button>
      </div>
    </div>

    <p class="refresh-hint">
      Last refreshed: {{ lastRefreshedLabel() }} · Auto-refresh every 30s
      @if (service.isPaused()) {
        <span class="pause-pill" aria-live="polite">Polling paused (60s back-off)</span>
      }
    </p>

    @if (loading()) {
      <ce-card>
        <div class="loading-state" aria-busy="true" aria-label="Loading device health">
          <ce-spinner size="md" />
          <p>Loading device health…</p>
        </div>
      </ce-card>
    } @else if (error()) {
      <ce-card>
        <div class="error-state" role="alert">
          <ce-icon name="alert-triangle" [size]="20" />
          <p>{{ error() }}</p>
          <ce-button variant="secondary" size="sm" (click)="refreshNow()">
            <ce-icon name="refresh" [size]="14" />
            Retry
          </ce-button>
        </div>
      </ce-card>
    } @else if (devices().length === 0) {
      <ce-card>
        <div class="empty-state">
          <p class="empty-title">No devices registered yet.</p>
          <p class="empty-subtitle">
            Devices appear here once you register one from
            <a
              routerLink="/administration"
              fragment="door-integration"
              data-testid="empty-administration-link"
              >administration → Door Integration</a
            >.
          </p>
          @if (gatehouseContext.gatehouses().length > 0) {
            <p class="registered-gatehouses" data-testid="registered-gatehouses">
              Registered locations: {{ gatehouseNames() }}. Select one before registering a device.
            </p>
          } @else if (gatehouseContext.error()) {
            <p class="registered-gatehouses is-error" role="alert">
              {{ gatehouseContext.error() }}
              <button type="button" (click)="gatehouseContext.load()">Retry locations</button>.
            </p>
          } @else if (!gatehouseContext.loading()) {
            <p class="registered-gatehouses">
              Register a gatehouse in Door Integration before adding a device.
            </p>
          }
        </div>
      </ce-card>
    } @else {
      <ce-card>
        <div class="table-card" data-testid="device-health-table">
          <table class="ce-table" data-testid="device-health-table-inner">
            <thead>
              <tr>
                <th scope="col">Vendor</th>
                <th scope="col">Type</th>
                <th scope="col">Gatehouse</th>
                <th scope="col">Status</th>
                <th scope="col">Last heartbeat</th>
                <th scope="col">Error rate</th>
                <th scope="col">Offline threshold</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (device of devices(); track device.deviceId) {
                <tr [attr.data-testid]="'device-row-' + device.deviceId">
                  <td>
                    <strong>{{ device.vendor }}</strong>
                  </td>
                  <td>{{ device.deviceType }}</td>
                  <td>{{ device.gatehouseName ?? '—' }}</td>
                  <td>
                    <ce-badge
                      [content]="device.statusLabel"
                      [tone]="badgeToneFor(device.status)"
                      size="sm"
                      [attr.data-testid]="'device-status-' + device.deviceId"
                    >
                      {{ device.statusLabel }}
                    </ce-badge>
                  </td>
                  <td>
                    @if (device.lastHeartbeatAtUtc) {
                      <span
                        ceTooltip
                        [title]="formatAbsoluteUtc(device.lastHeartbeatAtUtc)"
                      >{{ formatRelative(device.lastHeartbeatAtUtc) }}</span>
                    } @else {
                      <span class="text-secondary">never</span>
                    }
                  </td>
                  <td>
                    @if (device.eventsSinceLastSuccess > 0) {
                      {{ device.errorCount }} / {{ device.eventsSinceLastSuccess }} =
                      {{ device.errorRatePercent | number: '1.0-2' }}%
                    } @else {
                      <span class="text-secondary">—</span>
                    }
                  </td>
                  <td>{{ device.offlineAfterSeconds }}s</td>
                  <td>
                    <ce-button
                      variant="ghost"
                      size="sm"
                      (click)="openConfigure(device)"
                      [disabled]="!canConfigure()"
                      ceTooltip="Configure requires the devices.write permission (admin only)."
                      [attr.aria-label]="
                        'Configure gatehouse binding and thresholds for ' + device.vendor + ' device'
                        + (canConfigure() ? '' : ' — requires the devices.write permission (admin only)')
                      "
                      data-testid="configure-btn"
                    >
                      Configure
                    </ce-button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </ce-card>
    }

    @if (simulatorService.inspectorAvailable()) {
      <ce-device-simulator-section
        [devices]="devices()"
        (virtualDeviceCreated)="refreshNow()"
      ></ce-device-simulator-section>
    }

    <ce-device-configure-modal
      [open]="configureOpen()"
      [device]="configureDevice()"
      [gatehouseList]="configureGatehouseOptions()"
      (saved)="onConfigureSaved()"
      (cancelled)="onConfigureCancelled()"
    ></ce-device-configure-modal>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
        padding: var(--space-2) 0 var(--space-3);
        border-bottom: 1px solid var(--color-border);
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
      .page-subtitle {
        margin: var(--space-1) 0 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        max-width: 780px;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .refresh-hint {
        margin: var(--space-2) 0 0;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .pause-pill {
        padding: 2px 8px;
        border-radius: 9999px;
        background: var(--color-warning-light);
        color: var(--color-warning);
        font-weight: 600;
        font-size: 0.7rem;
      }
      .loading-state,
      .error-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: var(--space-8);
        color: var(--color-text-secondary);
        text-align: center;
      }
      .error-state {
        color: var(--color-danger);
      }
      .error-state p {
        margin: 0;
        font-size: var(--font-size-sm);
      }
      .empty-title {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .empty-subtitle {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        max-width: 480px;
      }
      .empty-subtitle a {
        color: var(--color-primary);
        text-decoration: underline;
      }
      .registered-gatehouses {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
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
      .text-secondary {
        color: var(--color-text-secondary);
      }
      @media (max-width: 767px) {
        .refresh-hint {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class DevicesHealthPage implements OnInit, OnDestroy {
  protected readonly service = inject(DeviceHealthService);
  protected readonly simulatorService = inject(DeviceSimulatorService);
  readonly gatehouseContext = inject(GatehouseContextService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  // Configure writes via PATCH /devices/{id} + PUT /devices/{id}/thresholds
  // need devices.write — granted to TenantAdmin (TenantAdminDefaults) but
  // NOT to the Porteiro role (PorteiroDefaults), which passes the shared
  // porteiroGuard onto this page. Keep the action discoverable (disabled +
  // explanatory tooltip / aria-label) rather than hidden.
  readonly canConfigure = computed(() => this.auth.permissions().includes('devices.write'));

  readonly devices = signal<DeviceHealthDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastRefreshedAtMs = signal<number | null>(null);

  // Per-device Configure dialog state. The modal re-hydrates from the
  // device input on every reopen (the page clears configureDevice on close).
  readonly configureOpen = signal(false);
  readonly configureDevice = signal<DeviceHealthDto | undefined>(undefined);

  // Registered (active) gatehouses plus the configured device's current
  // binding when it is not in the active list (e.g. an inactive gatehouse),
  // so the select never shows a blank current value.
  readonly configureGatehouseOptions = computed<ConfigureGatehouseOption[]>(() => {
    const active = this.gatehouseContext.gatehouses().map((g) => ({ id: g.id, name: g.name }));
    const currentId = this.configureDevice()?.gatehouseId;
    if (!currentId || active.some((g) => g.id === currentId)) return active;
    const current = this.devices().find((d) => d.deviceId === this.configureDevice()!.deviceId);
    return [...active, { id: currentId, name: current?.gatehouseName ?? currentId }];
  });

  private readonly sub = new Subscription();
  private probedInspector = false;

  ngOnInit(): void {
    this.gatehouseContext.load();
    this.service.startPolling(30_000);
    this.sub.add(
      this.service.health$.subscribe((list) => {
        this.devices.set(list);
        this.loading.set(false);
        this.error.set(null);
        this.lastRefreshedAtMs.set(this.service.getLastFetchAtMs());
        // Probe the simulator inspector exactly once, after the first
        // health snapshot lands. The page's `simulatorService` is a
        // root-provided singleton; the probe uses the synthetic id
        // 00000000-0000-0000-0000-000000000001 and the result drives
        // whether the simulator section is rendered (FR-007).
        if (!this.probedInspector) {
          this.probedInspector = true;
          void this.simulatorService.probeInspector();
        }
      })
    );
    // Initial render: until the first snapshot arrives, show loading.
    // After 3 errors the service pauses for 60s — surface a soft error.
    this.sub.add(
      this.service.health$.subscribe({
        error: () => {
          this.error.set('Failed to load device health. Retrying…');
          this.loading.set(false);
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.service.stopPolling();
    this.sub.unsubscribe();
  }

  refreshNow(): void {
    this.loading.set(true);
    this.service.refreshNow();
  }

  openConfigure(device: DeviceHealthDto): void {
    this.configureDevice.set(device);
    this.configureOpen.set(true);
  }

  onConfigureSaved(): void {
    this.configureOpen.set(false);
    this.configureDevice.set(undefined);
    // Health reflects the new binding / thresholds after the next snapshot;
    // pull it immediately so the row updates without waiting for the poll.
    this.refreshNow();
  }

  onConfigureCancelled(): void {
    // Dismissal (ESC / backdrop / Cancel button) closes without any API call.
    this.configureOpen.set(false);
    this.configureDevice.set(undefined);
  }

  lastRefreshedLabel(): string {
    const ms = this.lastRefreshedAtMs();
    if (ms === null) return 'just now';
    const diffMs = Math.max(0, Date.now() - ms);
    const secs = Math.floor(diffMs / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ago`;
  }

  badgeToneFor(status: DeviceStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'Online':
        return 'success';
      case 'Degraded':
        return 'warning';
      case 'Offline':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  gatehouseNames(): string {
    return this.gatehouseContext.gatehouses()
      .map((gatehouse) => gatehouse.name)
      .join(', ');
  }

  formatRelative(iso: string): string {
    const ms = Math.max(0, Date.now() - new Date(iso).getTime());
    const secs = Math.floor(ms / 1000);
    if (secs < 1) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  }

  formatAbsoluteUtc(iso: string): string {
    const d = new Date(iso);
    return `${d.toISOString().replace('T', ' ').substring(0, 23)} UTC`;
  }
}
