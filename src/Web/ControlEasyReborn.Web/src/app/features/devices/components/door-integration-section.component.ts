import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  Input,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SecurityService } from '../../../api/services/security.service';
import { CeToggleComponent } from '../../../design-system/components/toggle/toggle.component';
import {
  AdministrationApiService,
  TenantDoorIntegrationFlagDto,
} from '../../administration/administration-api.service';
import { DevicesApiService } from '../devices-api.service';
import {
  DeviceDetail,
  DeviceListItem,
} from '../door-unlock.types';
import { DeviceFormModalComponent } from './device-form-modal.component';
import { getApiErrorMessage } from '../../../core/utils/api-error.util';

interface GatehouseOption {
  id: string;
  name: string;
  location: string | null;
  active: boolean;
}

interface DeviceRow {
  id: string;
  vendor: string;
  deviceType: string;
  gatehouseId: string | null;
  gatehouseName: string | null;
  isActive: boolean;
  updatedAtUtc: string | null;
  createdAtUtc: string;
}

@Component({
  selector: 'ce-door-integration-section',
  standalone: true,
  imports: [CommonModule, FormsModule, CeToggleComponent, DeviceFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="door-integration"
      class="door-integration-section"
      data-test="door-integration"
      aria-labelledby="door-integration-heading"
    >
      <header class="section-header">
        <h2 id="door-integration-heading">Door Integration</h2>
        <p class="section-subtitle">
          Trigger door relays and ingest card-reader events from physical devices installed at your entrances.
          When enabled, every API-triggered unlock is HMAC-signed, rate-limited, and audited.
        </p>
      </header>

      <div class="opt-in-card" aria-labelledby="opt-in-heading">
        <header class="opt-in-header">
          <h3 id="opt-in-heading">Opt-in toggle</h3>
          @if (doorFlag() !== null) {
            <span
              class="ce-badge"
              [class.success]="doorFlag()?.doorIntegrationEnabled === true"
              [class.neutral]="doorFlag()?.doorIntegrationEnabled === false"
            >
              {{ doorFlag()?.doorIntegrationEnabled ? 'Online' : 'Offline' }}
            </span>
          }
        </header>
        <div class="opt-in-row">
          <div class="opt-in-info">
            <span class="opt-in-title">Enable door integration</span>
            <span class="opt-in-desc">
              {{ doorFlag()?.doorIntegrationEnabled ? 'Active' : 'Off' }}
            </span>
          </div>
          <ce-toggle
            [checked]="doorFlag()?.doorIntegrationEnabled ?? false"
            [disabled]="toggling()"
            (checkedChange)="onToggleDoorIntegration($event)"
          ></ce-toggle>
        </div>
        @if (doorFlag()?.doorIntegrationChangedAtUtc) {
          <p class="last-changed">
            Last changed
            {{ doorFlag()?.doorIntegrationChangedAtUtc | date: 'medium' }}
          </p>
        } @else {
          <p class="last-changed muted">Never changed.</p>
        }
        @if (doorToggleError()) {
          <p class="error-text" role="alert">{{ doorToggleError() }}</p>
        }
      </div>

      <div class="gatehouses-card" aria-labelledby="gatehouses-heading" data-test="gatehouses-card">
          <header class="gatehouses-header">
            <h3 id="gatehouses-heading">Gatehouses</h3>
          </header>

          @if (gatehousesLoading()) {
            <p class="loading-state" aria-live="polite">Loading gatehouses...</p>
          } @else if (gatehouseOptions().length === 0) {
            <p class="empty-state">
              No gatehouses registered yet. Door devices require a gatehouse binding —
              create at least one below.
            </p>
          } @else {
            <ul class="gatehouse-list" data-test="gatehouse-list">
              @for (g of gatehouseOptions(); track g.id) {
                <li class="gatehouse-list-item" [attr.data-test]="'gatehouse-row-' + g.id">
                  <span class="gatehouse-list-name">
                    {{ g.name }}
                    @if (g.location) { <small>{{ g.location }}</small> }
                  </span>
                  <span class="ce-badge" [class.success]="g.active" [class.neutral]="!g.active">
                    {{ g.active ? 'Active' : 'Inactive' }}
                  </span>
                  <button
                    type="button"
                    class="ce-button variant-ghost size-sm"
                    [attr.data-test]="'gatehouse-activation-' + g.id"
                    [disabled]="gatehouseActivationPendingId() === g.id"
                    (click)="onSetGatehouseActivation(g)"
                  >
                    {{ gatehouseActivationPendingId() === g.id ? 'Saving...' : (g.active ? 'Disable' : 'Enable') }}
                  </button>
                </li>
              }
            </ul>
          }
          @if (gatehouseActivationError()) {
            <p class="error-text" role="alert">{{ gatehouseActivationError() }}</p>
          }

          <form
            class="gatehouse-create-form"
            data-test="gatehouse-create-form"
            (ngSubmit)="onCreateGatehouse()"
          >
            <label class="gatehouse-create-field">
              <span>Name <span aria-hidden="true">*</span></span>
              <input
                type="text"
                class="ce-input"
                data-test="gatehouse-create-name"
                [(ngModel)]="gatehouseCreateName"
                name="gatehouseCreateName"
                maxlength="120"
                required
                [disabled]="gatehouseCreating()"
              />
            </label>
            <label class="gatehouse-create-field">
              <span>Location</span>
              <input
                type="text"
                class="ce-input"
                data-test="gatehouse-create-location"
                [(ngModel)]="gatehouseCreateLocation"
                name="gatehouseCreateLocation"
                maxlength="500"
                [disabled]="gatehouseCreating()"
              />
            </label>
            <button
              type="submit"
              class="ce-button variant-primary"
              data-test="gatehouse-create-submit"
              [disabled]="gatehouseCreating() || !gatehouseCreateName().trim()"
            >
              @if (gatehouseCreating()) {
                <span>Creating...</span>
              } @else {
                <span>+ Register gatehouse</span>
              }
            </button>
            @if (gatehouseCreateError()) {
              <p class="error-text" role="alert">{{ gatehouseCreateError() }}</p>
            }
          </form>
      </div>

      @if (doorFlag()?.doorIntegrationEnabled) {
        <div class="devices-card" aria-labelledby="devices-heading">
          <header class="devices-header">
            <h3 id="devices-heading">Devices</h3>
            <button
              type="button"
              class="ce-button variant-primary"
              data-test="register-device-btn"
              (click)="openRegisterModal()"
            >
              + Register device
            </button>
          </header>

          @if (devicesLoading()) {
            <p class="loading-state" aria-live="polite">Loading devices...</p>
          } @else if (devicesError()) {
            <p class="error-text" role="alert">{{ devicesError() }}</p>
            <button type="button" class="ce-button variant-secondary" (click)="loadDevices()">Retry</button>
          } @else if (deviceRows().length === 0) {
            <p class="empty-state">
              No devices registered yet. Click <strong>Register device</strong> to add your first door device.
            </p>
          } @else {
            <table class="ce-table" aria-label="Registered devices">
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Type</th>
                  <th scope="col">Gatehouse</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last modified</th>
                  <th scope="col" class="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (d of deviceRows(); track d.id) {
                  <tr [attr.data-test]="'device-row-' + d.id">
                    <td>{{ d.vendor }}</td>
                    <td>
                      <span class="ce-badge neutral size-sm">{{ d.deviceType }}</span>
                    </td>
                    <td>{{ d.gatehouseName ?? '—' }}</td>
                    <td>
                      <span
                        class="ce-badge"
                        [class.success]="d.isActive"
                        [class.neutral]="!d.isActive"
                        size-sm
                      >
                        {{ d.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td>{{ (d.updatedAtUtc ?? d.createdAtUtc) | date: 'short' }}</td>
                    <td class="cell-actions">
                      <button
                        type="button"
                        class="ce-button variant-ghost size-sm"
                        [attr.data-test]="'device-edit-' + d.id"
                        (click)="openEditModal(d)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="ce-button variant-ghost size-sm"
                        [attr.data-test]="'device-activate-' + d.id"
                        (click)="onSetActivation(d)"
                      >
                        {{ d.isActive ? 'Deactivate' : 'Activate' }}
                      </button>
                      <button
                        type="button"
                        class="ce-button variant-ghost size-sm danger"
                        [attr.data-test]="'device-remove-' + d.id"
                        (click)="onRemove(d)"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      } @else {
        <div class="disabled-card" aria-labelledby="disabled-heading">
          <h3 id="disabled-heading">Door integration is currently disabled</h3>
          <p>
            Turn on door integration above to manage devices. Every API-triggered unlock is HMAC-signed,
            rate-limited, and audited.
          </p>
        </div>
      }

      <ce-device-form-modal
        [open]="modalOpen()"
        [device]="modalDevice()"
        [gatehouseList]="modalGatehouseOptions()"
        (saved)="onDeviceSaved($event)"
        (cancelled)="onDeviceCancelled()"
      ></ce-device-form-modal>
    </section>
  `,
  styles: [
    `
      .door-integration-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-5, 20px);
        margin-top: var(--space-6, 24px);
      }
      .section-header h2 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .section-subtitle {
        margin: 4px 0 0;
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary);
      }
      .opt-in-card,
      .devices-card,
      .gatehouses-card,
      .disabled-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-top: 4px solid var(--color-primary);
        border-radius: 8px;
        box-shadow: var(--shadow-card);
        padding: var(--space-5, 20px);
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
      }
      .disabled-card {
        border-top-color: var(--color-neutral-light);
      }
      .opt-in-header,
      .devices-header,
      .gatehouses-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3, 12px);
      }
      .opt-in-header h3,
      .devices-header h3,
      .gatehouses-header h3,
      .disabled-card h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .gatehouse-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
      }
      .gatehouse-list-item {
        padding: var(--space-2, 8px) var(--space-3, 12px);
        background: var(--color-surface-muted);
        border-radius: var(--radius-md, 6px);
        font-size: var(--font-size-sm, 14px);
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
      }
      .gatehouse-list-name {
        display: flex;
        flex: 1;
        flex-direction: column;
        font-weight: 500;
        color: var(--color-text-primary);
      }
      .gatehouse-list-name small {
        color: var(--color-text-secondary);
        font-weight: 400;
      }
      .gatehouse-create-form {
        display: grid;
        grid-template-columns: 2fr 2fr auto;
        gap: var(--space-3, 12px);
        align-items: end;
        padding-top: var(--space-3, 12px);
        border-top: 1px solid var(--color-border);
      }
      .gatehouse-create-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .gatehouse-create-field > span {
        font-size: var(--font-size-xs, 12px);
        font-weight: 500;
        color: var(--color-text-secondary);
      }
      .opt-in-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3, 12px);
        padding: var(--space-3, 12px) 0;
        border-top: 1px solid var(--color-border);
        border-bottom: 1px solid var(--color-border);
      }
      .opt-in-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .opt-in-title {
        font-size: var(--font-size-sm, 14px);
        font-weight: 500;
        color: var(--color-text-primary);
      }
      .opt-in-desc {
        font-size: var(--font-size-xs, 12px);
        color: var(--color-text-secondary);
      }
      .last-changed {
        font-size: var(--font-size-xs, 12px);
        color: var(--color-text-secondary);
        margin: 0;
      }
      .last-changed.muted {
        opacity: 0.7;
      }
      .error-text {
        font-size: var(--font-size-sm, 14px);
        color: var(--color-danger);
        margin: 0;
      }
      .loading-state,
      .empty-state {
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary);
        margin: 0;
      }
      .ce-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm, 14px);
        text-align: left;
      }
      .ce-table th,
      .ce-table td {
        padding: var(--space-3, 12px) var(--space-4, 16px);
        border-bottom: 1px solid var(--color-border);
      }
      .ce-table thead {
        background: color-mix(in oklch, var(--color-sidebar-bg) 8%, var(--color-surface));
        font-family: var(--font-family-mono, monospace);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 0.72rem;
        color: var(--color-text-secondary);
      }
      .th-actions,
      .cell-actions {
        text-align: right;
      }
      .cell-actions {
        white-space: nowrap;
        display: flex;
        gap: 4px;
        justify-content: flex-end;
      }
      .ce-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ce-badge.success {
        background: var(--color-success-light);
        color: var(--color-success);
      }
      .ce-badge.neutral {
        background: var(--color-neutral-light);
        color: var(--color-text-secondary);
      }
      .ce-badge.size-sm {
        font-size: 0.7rem;
      }
      .ce-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 2.35rem;
        padding: 0 var(--space-4, 16px);
        border-radius: 6px;
        font-size: var(--font-size-sm, 14px);
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .ce-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .ce-button.size-sm {
        height: 2rem;
        padding: 0 var(--space-3, 12px);
        font-size: var(--font-size-xs, 12px);
      }
      .variant-primary {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
      }
      .variant-secondary {
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }
      .variant-ghost {
        background: transparent;
        color: var(--color-text-secondary);
      }
      .variant-ghost.danger {
        color: var(--color-danger);
      }
    `,
  ],
})
export class DoorIntegrationSectionComponent implements OnInit {
  private readonly adminApi = inject(AdministrationApiService);
  private readonly devicesApi = inject(DevicesApiService);
  private readonly securityApi = inject(SecurityService);

  readonly doorFlag = signal<TenantDoorIntegrationFlagDto | null>(null);
  readonly toggling = signal(false);
  readonly doorToggleError = signal<string | null>(null);

  readonly devicesLoading = signal(false);
  readonly devicesError = signal<string | null>(null);
  readonly devices = signal<DeviceDetail[]>([]);
  readonly gatehouseOptions = signal<GatehouseOption[]>([]);
  readonly activeGatehouseOptions = computed(() => this.gatehouseOptions().filter((gatehouse) => gatehouse.active));
  readonly modalGatehouseOptions = computed(() => {
    const active = this.activeGatehouseOptions();
    const currentGatehouseId = this.modalDevice()?.gatehouseId;
    if (!currentGatehouseId || active.some((gatehouse) => gatehouse.id === currentGatehouseId)) return active;
    const current = this.gatehouseOptions().find((gatehouse) => gatehouse.id === currentGatehouseId);
    return current ? [...active, current] : active;
  });
  readonly gatehousesLoading = signal(false);
  readonly gatehouseCreateName = signal('');
  readonly gatehouseCreateLocation = signal('');
  readonly gatehouseCreating = signal(false);
  readonly gatehouseCreateError = signal<string | null>(null);
  readonly gatehouseActivationPendingId = signal<string | null>(null);
  readonly gatehouseActivationError = signal<string | null>(null);

  readonly deviceRows = computed<DeviceRow[]>(() =>
    this.devices().map((d) => ({
      id: d.id,
      vendor: d.vendor,
      deviceType: d.deviceType,
      gatehouseId: d.gatehouseId,
      gatehouseName:
        (d.gatehouseId
          ? this.gatehouseOptions().find((g) => g.id === d.gatehouseId)?.name ?? null
          : null),
      isActive: d.isActive,
      updatedAtUtc: d.updatedAtUtc,
      createdAtUtc: d.createdAtUtc,
    }))
  );

  readonly modalOpen = signal(false);
  readonly modalDevice = signal<DeviceDetail | undefined>(undefined);

  ngOnInit(): void {
    void this.loadDoorFlag();
  }

  @Input() set enabled(value: boolean) {
    if (value && this.devices().length === 0 && !this.devicesLoading()) {
      void this.loadDevices();
    }
  }

  async loadDoorFlag(): Promise<void> {
    try {
      const flag = await firstValueFrom(this.adminApi.getDoorIntegration());
      this.doorFlag.set(flag);
      void this.loadGatehouses();
      if (flag.doorIntegrationEnabled) {
        void this.loadDevices();
      }
    } catch {
      this.doorFlag.set({
        tenantId: '',
        doorIntegrationEnabled: false,
        doorIntegrationChangedAtUtc: null,
        doorIntegrationChangedByProfileId: null,
      });
    }
  }

  async loadDevices(): Promise<void> {
    this.devicesLoading.set(true);
    this.devicesError.set(null);
    try {
      const list = await firstValueFrom(this.devicesApi.list());
      // API list endpoint returns DeviceListItem (no gatehouseName). Fetch
      // each device detail so we can render the gatehouse name.
      const details: DeviceDetail[] = [];
      for (const item of list) {
        const li = item as DeviceListItem;
        try {
          const detail = await firstValueFrom(this.devicesApi.get(li.id));
          details.push(detail);
        } catch {
          // Fall back to a synthetic detail without a gatehouseName so the
          // row still renders.
          details.push({
            id: li.id,
            tenantId: '',
            deviceType: li.deviceType,
            vendor: li.vendor,
            connectionParams: { redacted: true, last4: '0000' },
            gatehouseId: li.gatehouseId,
            gatehouseName: null,
            isActive: li.isActive,
            createdAtUtc: li.createdAtUtc,
            updatedAtUtc: li.updatedAtUtc,
            removedAtUtc: null,
            createdByProfileId: '',
          });
        }
      }
      this.devices.set(details);
    } catch (err) {
      this.devicesError.set(getApiErrorMessage(err, 'Failed to load devices.'));
    } finally {
      this.devicesLoading.set(false);
    }
  }

  async loadGatehouses(): Promise<void> {
    this.gatehousesLoading.set(true);
    try {
      // Reuse the Security module's existing endpoint.
      const list = await firstValueFrom(this.securityApi.apiV1SecurityGatehousesGet({ includeInactive: true }));
      this.gatehouseOptions.set(
        list.flatMap((g) =>
          g.id && g.name
            ? [{ id: g.id, name: g.name, location: g.location ?? null, active: g.active !== false }]
            : [],
        ),
      );
    } catch {
      // Non-blocking: modal will still render with an empty gatehouse list.
      this.gatehouseOptions.set([]);
    } finally {
      this.gatehousesLoading.set(false);
    }
  }

  // v2.3 hotfix (gatehouse-management UI): the Security module already exposes
  // POST /api/v1/security/gatehouses (SecurityEndpoints.cs:187), but no UI
  // surface calls it. Tenants on a fresh install had no way to create a
  // gatehouse, blocking every device registration because the modal's
  // Gatehouse dropdown was empty.
  async onCreateGatehouse(): Promise<void> {
    const name = this.gatehouseCreateName().trim();
    if (!name) return;
    const location = this.gatehouseCreateLocation().trim();
    this.gatehouseCreating.set(true);
    this.gatehouseCreateError.set(null);
    try {
      const created = await firstValueFrom(this.securityApi.apiV1SecurityGatehousesPost({
        body: { name, location: location || null },
      }));
      if (!created.id || !created.name) throw new Error('Gatehouse response was incomplete.');
      this.gatehouseOptions.set([
        ...this.gatehouseOptions(),
        { id: created.id, name: created.name, location: created.location ?? null, active: created.active !== false },
      ]);
      this.gatehouseCreateName.set('');
      this.gatehouseCreateLocation.set('');
    } catch (err) {
      this.gatehouseCreateError.set(getApiErrorMessage(err, 'Failed to create gatehouse.'));
    } finally {
      this.gatehouseCreating.set(false);
    }
  }

  async onSetGatehouseActivation(gatehouse: GatehouseOption): Promise<void> {
    const active = !gatehouse.active;
    if (!active && !window.confirm(`Disable ${gatehouse.name}? Operators and devices will no longer be able to record activity there.`)) {
      return;
    }

    this.gatehouseActivationPendingId.set(gatehouse.id);
    this.gatehouseActivationError.set(null);
    try {
      const updated = await firstValueFrom(this.securityApi.apiV1SecurityGatehousesIdActivationPut({
        id: gatehouse.id,
        body: { active },
      }));
      this.gatehouseOptions.update((items) =>
        items.map((item) => item.id === gatehouse.id ? { ...item, active: updated.active ?? active } : item),
      );
    } catch (err) {
      this.gatehouseActivationError.set(getApiErrorMessage(err, `Failed to ${active ? 'enable' : 'disable'} gatehouse.`));
    } finally {
      this.gatehouseActivationPendingId.set(null);
    }
  }

  async onToggleDoorIntegration(enabled: boolean): Promise<void> {
    this.toggling.set(true);
    this.doorToggleError.set(null);
    try {
      const updated = await firstValueFrom(this.devicesApi.toggleDoorIntegration(enabled));
      this.doorFlag.set({
        tenantId: updated.tenantId,
        doorIntegrationEnabled: updated.doorIntegrationEnabled,
        doorIntegrationChangedAtUtc: updated.doorIntegrationChangedAtUtc,
        doorIntegrationChangedByProfileId: updated.doorIntegrationChangedByProfileId,
      });
      if (enabled) {
        await this.loadDevices();
      }
    } catch (err) {
      this.doorToggleError.set(getApiErrorMessage(err, 'Failed to update door integration.'));
    } finally {
      this.toggling.set(false);
    }
  }

  openRegisterModal(): void {
    this.modalDevice.set(undefined);
    this.modalOpen.set(true);
  }

  openEditModal(row: DeviceRow): void {
    const full = this.devices().find((d) => d.id === row.id);
    if (!full) return;
    this.modalDevice.set(full);
    this.modalOpen.set(true);
  }

  onDeviceSaved(detail: DeviceDetail): void {
    this.modalOpen.set(false);
    this.modalDevice.set(undefined);
    void this.loadDevices();
  }

  onDeviceCancelled(): void {
    this.modalOpen.set(false);
    this.modalDevice.set(undefined);
  }

  async onSetActivation(row: DeviceRow): Promise<void> {
    try {
      const updated = await firstValueFrom(
        this.devicesApi.setActivation(row.id, !row.isActive)
      );
      this.replaceDevice(updated);
    } catch (err) {
      this.devicesError.set(getApiErrorMessage(err, 'Failed to update device.'));
    }
  }

  async onRemove(row: DeviceRow): Promise<void> {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(
        'Remove this device? Historical unlock events stay on file.'
      );
      if (!ok) return;
    }
    try {
      await firstValueFrom(this.devicesApi.remove(row.id));
      this.devices.update((list) => list.filter((d) => d.id !== row.id));
    } catch (err) {
      this.devicesError.set(getApiErrorMessage(err, 'Failed to remove device.'));
    }
  }

  private replaceDevice(updated: DeviceDetail): void {
    this.devices.update((list) => list.map((d) => (d.id === updated.id ? updated : d)));
  }
}
