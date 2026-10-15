import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CeButtonComponent, CeCardComponent, CeIconComponent, CeSpinnerComponent } from '../../../design-system';
import { DevicesApiService } from '../devices-api.service';
import { DeviceSimulatorService } from '../device-simulator.service';
import { GatehouseContextService } from '../../access-control/gatehouse-context.service';
import { AuthService } from '../../../core/services/auth.service';
import { getApiErrorMessage } from '../../../core/utils/api-error.util';
import {
  DeviceEventListItem,
  DeviceListItem,
  SimulatedPresentationResult,
  SimulatorDeviceReadiness,
  VirtualDoorDirection,
  isConfiguredSimulatorFailure,
  virtualDoorOutcomeLabel,
} from '../door-unlock.types';

// Operational-gatehouse-simulator — the operator surface of the DEVELOPMENT
// virtual door. Renders inside the Gatehouse panel's "Virtual door" tab,
// which only exists when the inspector probe succeeded
// (DeviceSimulatorService.inspectorAvailable() === true).
//
// Treat the simulator as a virtual physical reader, not a diagnostics form:
//   - device selection / creation (TenantAdmin only — porteiro sees
//     actionable administrator guidance, never a failing create action),
//   - gatehouse binding display (from GatehouseContextService + the
//     backend readiness verdict),
//   - Entrance / Exit direction toggle adjacent to the device identity,
//   - paste-issued-token input + primary "Present credential" action
//     (the issued QR payload is only ever shown once at issuance, so this
//     is a paste-token field — never a secret viewer),
//   - compact operational receipt (outcome, direction, timestamp, linked
//     record IDs) and the recent device-events list.
//
// Low-level failure-mode / offline controls deliberately remain on Device
// health — this component only reports the configured failure surfaced by
// the presentation endpoint.
@Component({
  selector: 'ce-virtual-door',
  standalone: true,
  imports: [CommonModule, FormsModule, CeButtonComponent, CeCardComponent, CeIconComponent, CeSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="virtual-door" data-testid="virtual-door-section">
      <div class="section-intro">
        <div>
          <h2 class="section-title">Virtual door</h2>
          <p class="section-subtitle">
            Development reader bound to the active gatehouse. Present a real issued credential to exercise the
            canonical gatehouse ledger.
          </p>
        </div>
      </div>

      @if (errorMessage(); as error) {
        <div class="form-error-banner" role="alert" data-testid="virtual-door-error">{{ error }}</div>
      }

      @if (loadingDevices()) {
        <div class="loading-state" data-testid="virtual-door-loading">
          <ce-spinner tone="primary" size="md" />
          <p>Loading virtual doors…</p>
        </div>
      } @else if (readers().length === 0) {
        <div class="ce-card empty-state" data-testid="virtual-door-empty-state">
          @if (auth.isTenantAdmin()) {
            <p>
              No virtual door is registered yet. Create one bound to the selected gatehouse
              <strong>{{ gatehouseContext.selectedGatehouse()?.name ?? '—' }}</strong>.
            </p>
            <ce-button
              variant="primary"
              size="sm"
              [disabled]="creatingDevice() || !gatehouseContext.selectedGatehouseId()"
              (click)="createVirtualDevice()"
              data-testid="virtual-door-create-btn"
            >
              <ce-icon name="plus" [size]="16" />
              {{ creatingDevice() ? 'Creating…' : 'Create virtual door' }}
            </ce-button>
            @if (!gatehouseContext.selectedGatehouseId()) {
              <p class="hint" role="status">Select a gatehouse location first.</p>
            }
          } @else {
            <p data-testid="virtual-door-empty-guidance">
              No virtual door is configured for this location yet. Ask an authorized administrator to create one
              under Device administration (type <em>reader</em>, vendor <em>ControlEasy simulator</em>), bound to
              the active gatehouse.
            </p>
          }
        </div>
      } @else {
        <div class="ce-card reader-card">
          <div class="reader-grid">
            <label class="field-label">
              <span>Virtual reader</span>
              <select
                class="ce-input"
                [ngModel]="selectedDeviceId()"
                (ngModelChange)="onDeviceChange($event)"
                data-testid="virtual-door-device-select"
              >
                @for (reader of readers(); track reader.id) {
                  <option [value]="reader.id">
                    {{ reader.vendor }} — {{ reader.id | slice: 0 : 8 }}
                  </option>
                }
              </select>
            </label>

            <div class="binding" data-testid="virtual-door-binding">
              @if (probingReadiness()) {
                <span class="binding-status" role="status">Checking reader…</span>
              } @else if (readiness()?.ready) {
                <span class="binding-status is-ready">
                  <ce-icon name="check-circle" [size]="14" />
                  Bound to {{ readiness()?.gatehouseName ?? 'gatehouse' }}
                </span>
              } @else if (readiness() && !readiness()!.ready) {
                <span class="binding-status is-error" role="alert">{{ bindingFailureLabel(readiness()!.reason) }}</span>
              } @else {
                <span class="binding-status is-error" role="status">{{ simulator.lastError() ?? 'Reader unavailable.' }}</span>
              }
            </div>
          </div>

          <div class="direction-toggle" role="radiogroup" aria-label="Cycle direction">
            <button
              type="button"
              class="direction-btn"
              role="radio"
              [attr.aria-checked]="direction() === 'entrance'"
              [class.is-active]="direction() === 'entrance'"
              (click)="direction.set('entrance')"
              data-testid="virtual-door-direction-entrance"
            >
              <ce-icon name="log-in" [size]="16" /> Entrance
            </button>
            <button
              type="button"
              class="direction-btn"
              role="radio"
              [attr.aria-checked]="direction() === 'exit'"
              [class.is-active]="direction() === 'exit'"
              (click)="direction.set('exit')"
              data-testid="virtual-door-direction-exit"
            >
              <ce-icon name="log-out" [size]="16" /> Exit
            </button>
          </div>

          <label class="field-label">
            <span>Issued credential token (paste once at issuance)</span>
            <input
              type="text"
              class="ce-input token-input"
              placeholder="Paste the issued QR token…"
              [ngModel]="token()"
              (ngModelChange)="token.set($event)"
              autocomplete="off"
              spellcheck="false"
              data-testid="virtual-door-token-input"
            />
          </label>

          <div class="present-row">
            <ce-button
              variant="primary"
              size="md"
              [disabled]="!canPresent()"
              (click)="present()"
              data-testid="virtual-door-present-btn"
            >
              @if (presenting()) {
                <span class="spinner"></span> Presenting…
              } @else {
                <ce-icon name="scan-line" [size]="18" /> Present credential
              }
            </ce-button>
            <span class="gatehouse-note">
              Recording location: {{ readiness()?.gatehouseName ?? '—' }} · Direction:
              {{ direction() }}
            </span>
          </div>
        </div>

        @if (receipt(); as r) {
          <div
            class="ce-card receipt"
            [class.is-denied]="receiptIsDenied()"
            data-testid="virtual-door-receipt"
            role="status"
          >
            <div class="receipt-header">
              <ce-icon
                [name]="receiptIsAccepted() ? 'check-circle' : 'x-circle'"
                [size]="20"
              />
              <strong>{{ virtualDoorOutcomeLabel(r.outcome) }}</strong>
              @if (r.failureCode) {
                <span class="failure-code" data-testid="virtual-door-receipt-failure-code">{{ r.failureCode }}</span>
              }
            </div>
            <dl class="receipt-grid" data-testid="virtual-door-receipt-detail">
              <div>
                <dt>Direction</dt>
                <dd data-testid="virtual-door-receipt-direction">{{ r.direction }}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd data-testid="virtual-door-receipt-time">{{ r.processedAtUtc | date: 'short' }}</dd>
              </div>
              @if (r.visitId) {
                <div>
                  <dt>Visit</dt>
                  <dd class="mono" data-testid="virtual-door-receipt-visit">{{ r.visitId | slice: 0 : 8 }}</dd>
                </div>
              }
              @if (r.accessEventId) {
                <div>
                  <dt>Access event</dt>
                  <dd class="mono" data-testid="virtual-door-receipt-access">{{ r.accessEventId | slice: 0 : 8 }}</dd>
                </div>
              }
              @if (r.refusalId) {
                <div>
                  <dt>Refusal</dt>
                  <dd class="mono" data-testid="virtual-door-receipt-refusal">{{ r.refusalId | slice: 0 : 8 }}</dd>
                </div>
              }
            </dl>
            @if (isConfiguredFailure(r.outcome)) {
              <p class="receipt-note">
                Configured simulator failure — no access or refusal ledger row was written.
              </p>
            }
          </div>
        }

        <div class="ce-card events-card">
          <div class="events-header">
            <h3>Recent device events</h3>
            <button type="button" class="ce-button variant-ghost size-sm" (click)="refresh()" data-testid="virtual-door-refresh-btn">
              <ce-icon name="refresh" [size]="14" /> Refresh
            </button>
          </div>
          @if (loadingEvents()) {
            <p class="binding-status" role="status">Loading events…</p>
          } @else if (recentEvents().length === 0) {
            <p class="binding-status" data-testid="virtual-door-events-empty">No device events recorded yet.</p>
          } @else {
            <table class="ce-table" data-testid="virtual-door-events">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Result</th>
                  <th>Failure</th>
                </tr>
              </thead>
              <tbody>
                @for (event of recentEvents(); track event.id) {
                  <tr>
                    <td>{{ event.occurredAtUtc | date: 'short' }}</td>
                    <td>{{ event.eventType }}</td>
                    <td data-testid="virtual-door-event-result">{{ event.resultCode }}</td>
                    <td>{{ event.failureCode ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .virtual-door {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        color: var(--color-text-primary);
      }

      .section-intro {
        display: flex;
        align-items: flex-start;
      }

      .section-title {
        margin: 0 0 var(--space-1);
        font-size: var(--font-size-lg);
      }

      .section-subtitle {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .empty-state,
      .reader-card,
      .receipt,
      .events-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-4);
      }

      .hint {
        margin: 0;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .reader-grid {
        display: grid;
        grid-template-columns: minmax(16rem, 1fr) auto;
        gap: var(--space-3);
        align-items: end;
      }

      .field-label {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--font-size-sm);
      }

      .direction-toggle {
        display: inline-flex;
        gap: var(--space-1);
        align-self: flex-start;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 2px;
      }

      .direction-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-3);
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        cursor: pointer;
      }

      .direction-btn.is-active {
        background: var(--color-primary);
        color: var(--color-text-on-primary, #fff);
      }

      .binding-status {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--font-size-sm);
      }

      .binding-status.is-ready {
        color: var(--color-success);
      }

      .binding-status.is-error {
        color: var(--color-danger, var(--color-warning));
      }

      .gatehouse-note {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .present-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }

      .receipt-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .receipt.is-denied {
        border-left: 3px solid var(--color-danger, var(--color-warning));
      }

      .failure-code {
        font-family: monospace;
        font-size: var(--font-size-xs);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        background: var(--color-warning-light, rgba(0, 0, 0, 0.06));
      }

      .receipt-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: var(--space-3);
        margin: 0;
      }

      .receipt-grid dt {
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-secondary);
      }

      .receipt-grid dd {
        margin: 2px 0 0;
        font-size: var(--font-size-sm);
      }

      .receipt-grid dd.mono {
        font-family: monospace;
      }

      .receipt-note {
        margin: 0;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .events-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .events-header h3 {
        margin: 0;
        font-size: var(--font-size-sm);
        font-weight: 600;
      }

      .token-input {
        font-family: monospace;
      }

      .spinner {
        display: inline-block;
        width: 0.85rem;
        height: 0.85rem;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        vertical-align: -2px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class VirtualDoorComponent implements OnInit {
  protected readonly devicesApi = inject(DevicesApiService);
  protected readonly simulator = inject(DeviceSimulatorService);
  protected readonly gatehouseContext = inject(GatehouseContextService);
  protected readonly auth = inject(AuthService);

  // Exposed for the template's label helper.
  protected readonly virtualDoorOutcomeLabel = virtualDoorOutcomeLabel;
  protected readonly isConfiguredFailure = isConfiguredSimulatorFailure;

  protected readonly readers = signal<DeviceListItem[]>([]);
  protected readonly loadingDevices = signal(false);
  protected readonly creatingDevice = signal(false);
  protected readonly selectedDeviceId = signal<string | null>(null);
  protected readonly readiness = signal<SimulatorDeviceReadiness | null>(null);
  protected readonly probingReadiness = signal(false);
  protected readonly direction = signal<VirtualDoorDirection>('entrance');
  protected readonly token = signal('');
  protected readonly presenting = signal(false);
  protected readonly receipt = signal<SimulatedPresentationResult | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly recentEvents = signal<DeviceEventListItem[]>([]);
  protected readonly loadingEvents = signal(false);

  protected readonly errorMessage = computed(() => this.actionError());

  protected readonly canPresent = computed(
    () =>
      this.readiness()?.ready === true &&
      this.token().trim().length > 0 &&
      !this.presenting(),
  );

  ngOnInit(): void {
    this.loadReaders();
  }

  protected loadReaders(): void {
    this.loadingDevices.set(true);
    this.actionError.set(null);
    this.devicesApi.list().subscribe({
      next: (devices) => {
        // Only ACTIVE reader devices can act as the virtual door.
        const readers = devices.filter((d) => d.deviceType === 'reader' && d.isActive);
        this.readers.set(readers);
        this.loadingDevices.set(false);

        if (readers.length === 0) {
          this.readiness.set(null);
          this.recentEvents.set([]);
          return;
        }

        const selected = this.selectedDeviceId();
        const preferred: string = selected && readers.some((r) => r.id === selected)
          ? selected
          : (readers[0]?.id ?? '');
        this.selectedDeviceId.set(preferred);
        void this.probeReadiness(preferred);
        void this.loadRecentEvents(preferred);
      },
      error: (err) => {
        this.loadingDevices.set(false);
        this.actionError.set(getApiErrorMessage(err, 'Failed to load virtual doors.'));
      },
    });
  }

  protected onDeviceChange(deviceId: string): void {
    this.selectedDeviceId.set(deviceId);
    this.receipt.set(null);
    this.actionError.set(null);
    void this.probeReadiness(deviceId);
    void this.loadRecentEvents(deviceId);
  }

  protected async probeReadiness(deviceId: string): Promise<void> {
    this.probingReadiness.set(true);
    const readiness = await this.simulator.probeReadiness(deviceId);
    if (this.selectedDeviceId() === deviceId) {
      this.readiness.set(readiness);
      this.probingReadiness.set(false);
    }
  }

  protected async loadRecentEvents(deviceId: string): Promise<void> {
    this.loadingEvents.set(true);
    this.devicesApi.listEvents(deviceId, null, 20).subscribe({
      next: (events) => {
        if (this.selectedDeviceId() === deviceId) {
          this.recentEvents.set(events);
          this.loadingEvents.set(false);
        }
      },
      error: () => {
        if (this.selectedDeviceId() === deviceId) {
          this.recentEvents.set([]);
          this.loadingEvents.set(false);
        }
      },
    });
  }

  protected createVirtualDevice(): void {
    if (this.creatingDevice()) return;
    const gatehouseId = this.gatehouseContext.selectedGatehouseId();
    if (!gatehouseId) return;

    this.creatingDevice.set(true);
    this.actionError.set(null);
    // The virtual door is created THROUGH the existing device-registration
    // endpoint, already bound to the active gatehouse of the tenant.
    this.devicesApi
      .register({
        deviceType: 'reader',
        vendor: 'ControlEasy simulator',
        gatehouseId,
        connectionParams: { simulator: true },
      })
      .subscribe({
        next: (device) => {
          this.creatingDevice.set(false);
          this.selectedDeviceId.set(device.id);
          this.loadReaders();
        },
        error: (err) => {
          this.creatingDevice.set(false);
          this.actionError.set(getApiErrorMessage(err, 'Could not create the virtual door. Try again.'));
        },
      });
  }

  protected async present(): Promise<void> {
    const deviceId = this.selectedDeviceId();
    const token = this.token().trim();
    if (!deviceId || !token || this.presenting()) return;

    this.presenting.set(true);
    this.actionError.set(null);
    const result = await this.simulator.presentCredential(deviceId, token, this.direction());
    this.presenting.set(false);

    // Guard against a mid-flight device switch: only the responses of the
    // device that is still selected may touch this component's state.
    if (
      this.selectedDeviceId() !== deviceId ||
      !result
    ) {
      if (!result && this.selectedDeviceId() === deviceId) {
        this.actionError.set(this.simulator.lastError() ?? 'Presentation failed.');
      }
      return;
    }

    this.receipt.set(result);
    if (isConfiguredSimulatorFailure(result.outcome)) {
      // The offline / auth-failure mode is a deliberate dev configuration —
      // show it as the outcome, not as an application error.
      this.actionError.set(null);
    }
    void this.loadRecentEvents(deviceId);
  }

  protected refresh(): void {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) return;
    void this.probeReadiness(deviceId);
    void this.loadRecentEvents(deviceId);
  }

  protected receiptIsAccepted(): boolean {
    const outcome = this.receipt()?.outcome;
    return (
      outcome === 'advanced_visit' || outcome === 'created_visit' || outcome === 'matched_dweller'
    );
  }

  protected receiptIsDenied(): boolean {
    const outcome = this.receipt()?.outcome;
    return Boolean(outcome) && !this.receiptIsAccepted() && outcome !== 'replay_duplicate';
  }

  protected bindingFailureLabel(reason: string | null): string {
    switch (reason) {
      case 'device_not_found':
        return 'Reader not found for this tenant.';
      case 'device_inactive':
        return 'Reader is inactive.';
      case 'not_a_reader':
        return 'This device is not a reader.';
      case 'gatehouse_binding_missing':
        return 'Reader has no gatehouse binding — ask an administrator to bind it to the active gatehouse.';
      case 'gatehouse_inactive':
        return 'The bound gatehouse is inactive.';
      case 'not_a_simulator':
        return 'This reader is not a ControlEasy simulator — the virtual door is device-specific.';
      case 'door_integration_disabled':
        return 'Door integration is disabled for this condominium.';
      default:
        return 'Reader is not presentable right now.';
    }
  }
}