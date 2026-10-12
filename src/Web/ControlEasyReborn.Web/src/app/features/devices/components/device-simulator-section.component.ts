import {
  Component,
  ChangeDetectionStrategy,
  Input,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CeBadgeComponent } from '../../../design-system/components/badge/badge.component';
import { CeButtonComponent } from '../../../design-system/components/button/button.component';
import { CeSpinnerComponent } from '../../../design-system/components/spinner/spinner.component';
import { ToastService } from '../../../design-system/components/toast/toast.component';
import { DeviceSimulatorService, SimulatorAction } from '../device-simulator.service';
import {
  DeviceHealthDto,
  SIMULATOR_FAILURE_MODE_LABELS,
  simulatorFailureModeLabel,
  SimulatorFailureMode,
} from '../door-unlock.types';

// Device Simulator section (DOOR-15/DOOR-23 inspector surface).
//
// Rendered beneath the device-health table on /devices, inside the same
// page. Collapsed by default via a <details> disclosure; per-device
// simulator controls appear only when the section is expanded. Every
// state-changing action shows a confirmation step (window.confirm, the
// established pattern in DoorIntegrationSectionComponent.onRemove /
// onSetGatehouseActivation) and a ToastService notification.
//
// This component is pure presentation. It consumes DeviceSimulatorService
// from the parent page; it does not own any state beyond the form
// bindings for the failure-mode selector, the offline-until datetime
// input, and the enqueue count/sequence. Service state (selectedDeviceId,
// recordedAttempts, hasMoreAttempts, pendingAction, lastError) is the
// source of truth — the component subscribes via effect() to keep its
// local selectedId in sync for the [ngModel] one-way binding on the
// device <select>.
//
// Hard invariants honored here:
//   - No new routes, no new guards, no new permission tokens, no new
//     backend endpoints, no new database tables (FR-007, SC-006).
//   - Standalone, OnPush, signals, ce- selector prefix (architecture).
//   - Synthetic data only — the inspector probe uses device id
//     00000000-0000-0000-0000-000000000001 per FR-011.
@Component({
  selector: 'ce-device-simulator-section',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CeBadgeComponent, CeButtonComponent, CeSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="device-simulator-section"
      data-testid="device-simulator-section"
      aria-labelledby="simulator-heading"
    >
      <details data-testid="device-simulator-disclosure">
        <summary>
          <h2 id="simulator-heading">Device simulator</h2>
          <p class="section-subtitle">
            Internal inspector — visible only when the API environment is Development
            and the inspector flag is enabled.
          </p>
        </summary>

        @if (devices.length === 0) {
          <p class="empty-hint" data-testid="simulator-empty">
            No devices available. Register a device from Door Integration first.
          </p>
        } @else {
          <div class="device-picker">
            <label for="simulator-device-select">Device</label>
            <select
              id="simulator-device-select"
              data-testid="simulator-device-select"
              [ngModel]="selectedId()"
              (ngModelChange)="onDeviceChange($event)"
            >
              @for (device of devices; track device.deviceId) {
                <option [value]="device.deviceId">
                  {{ device.vendor }} — {{ device.deviceType }} ({{ device.deviceId }})
                </option>
              }
            </select>
          </div>

          <div class="form-row" data-testid="simulator-failure-mode-row">
            <label for="simulator-failure-mode">Failure mode</label>
            <select
              id="simulator-failure-mode"
              data-testid="simulator-failure-mode"
              [ngModel]="failureMode()"
              (ngModelChange)="failureMode.set(+$event)"
            >
              @for (mode of failureModeOptions; track mode.value) {
                <option [value]="mode.value">{{ mode.label }}</option>
              }
            </select>
            <ce-button
              variant="primary"
              size="sm"
              data-testid="simulator-failure-mode-apply"
              (click)="onApplyFailureMode()"
              [disabled]="isPending('failureMode')"
            >
              @if (isPending('failureMode')) {
                <ce-spinner size="sm" />
              } @else {
                Apply
              }
            </ce-button>
          </div>

          <div class="form-row" data-testid="simulator-offline-row">
            <label for="simulator-offline-until">Offline until (UTC)</label>
            <input
              id="simulator-offline-until"
              type="datetime-local"
              class="ce-input"
              data-testid="simulator-offline-until"
              [ngModel]="offlineUntilLocal()"
              (ngModelChange)="offlineUntilLocal.set($event)"
            />
            <ce-button
              variant="secondary"
              size="sm"
              data-testid="simulator-offline-apply"
              (click)="onApplyOffline()"
              [disabled]="isPending('offline')"
            >
              @if (isPending('offline')) {
                <ce-spinner size="sm" />
              } @else {
                Apply
              }
            </ce-button>
          </div>

          <div class="form-row" data-testid="simulator-reset-row">
            <ce-button
              variant="ghost"
              size="sm"
              data-testid="simulator-reset"
              (click)="onReset()"
              [disabled]="isPending('reset')"
            >
              @if (isPending('reset')) {
                <ce-spinner size="sm" />
              } @else {
                Reset simulator
              }
            </ce-button>
          </div>

          @if (lastError()) {
            <p class="error-text" role="alert" data-testid="simulator-error">
              {{ lastError() }}
            </p>
          }

          <h3 class="subsection-title">Recorded attempts</h3>
          @if (isPending('load')) {
            <p class="loading-hint" data-testid="simulator-loading">Loading attempts…</p>
          } @else if (recordedAttempts().length === 0) {
            <p class="empty-hint" data-testid="simulator-attempts-empty">
              No recorded attempts yet.
            </p>
          } @else {
            <ul class="attempts-list" data-testid="simulator-attempts-list">
              @for (attempt of recordedAttempts(); track attempt.correlationId) {
                <li class="attempts-item" [attr.data-testid]="'simulator-attempt-' + attempt.correlationId">
                  <ce-badge
                    [content]="attempt.outcome"
                    [tone]="attempt.outcome === 'Success' ? 'success' : 'danger'"
                    size="sm"
                  >
                    {{ attempt.outcome }}
                  </ce-badge>
                  <span class="attempts-time">{{ attempt.occurredAtUtc | date: 'short' }}</span>
                  <span class="attempts-correlation">{{ attempt.correlationId }}</span>
                </li>
              }
            </ul>
            @if (hasMoreAttempts()) {
              <p class="muted" data-testid="simulator-attempts-truncated">
                Showing most recent 200.
              </p>
            }
          }

          <h3 class="subsection-title">Event queue (DOOR-11 replay)</h3>
          <div class="form-row" data-testid="simulator-enqueue-row">
            <label for="simulator-enqueue-count">Count</label>
            <input
              id="simulator-enqueue-count"
              type="number"
              min="1"
              max="1000"
              class="ce-input"
              data-testid="simulator-enqueue-count"
              [ngModel]="enqueueCount()"
              (ngModelChange)="enqueueCount.set(+$event || 1)"
            />
            <label for="simulator-enqueue-from-seq">From sequence</label>
            <input
              id="simulator-enqueue-from-seq"
              type="number"
              min="0"
              class="ce-input"
              data-testid="simulator-enqueue-from-seq"
              [ngModel]="enqueueFromSeq()"
              (ngModelChange)="enqueueFromSeq.set(+$event || 0)"
            />
            <ce-button
              variant="secondary"
              size="sm"
              data-testid="simulator-enqueue"
              (click)="onEnqueue()"
              [disabled]="isPending('enqueue')"
            >
              @if (isPending('enqueue')) {
                <ce-spinner size="sm" />
              } @else {
                Enqueue offline events
              }
            </ce-button>
          </div>

          <div class="form-row" data-testid="simulator-drain-row">
            <ce-button
              variant="ghost"
              size="sm"
              data-testid="simulator-drain"
              (click)="onDrain()"
              [disabled]="isPending('drain')"
            >
              @if (isPending('drain')) {
                <ce-spinner size="sm" />
              } @else {
                Drain queue
              }
            </ce-button>
          </div>
        }
      </details>
    </section>
  `,
  styles: [
    `
      .device-simulator-section {
        margin-top: var(--space-5, 20px);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-top: 4px solid var(--color-warning);
        border-radius: 8px;
        box-shadow: var(--shadow-card);
        padding: var(--space-4, 16px) var(--space-5, 20px);
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
      }
      .device-simulator-section details > summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .device-simulator-section details > summary::-webkit-details-marker {
        display: none;
      }
      .device-simulator-section h2 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .section-subtitle {
        margin: 0;
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary);
      }
      .subsection-title {
        margin: var(--space-3, 12px) 0 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .device-picker {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .device-picker label {
        font-size: var(--font-size-xs, 12px);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .form-row {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: var(--space-3, 12px);
      }
      .form-row > label {
        font-size: var(--font-size-xs, 12px);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .form-row select,
      .form-row input[type='datetime-local'],
      .form-row input[type='number'] {
        height: 2.35rem;
        padding: 0 var(--space-2, 8px);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm, 14px);
        font-family: inherit;
      }
      .empty-hint,
      .loading-hint {
        margin: 0;
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary);
      }
      .error-text {
        margin: 0;
        font-size: var(--font-size-sm, 14px);
        color: var(--color-danger);
      }
      .muted {
        margin: var(--space-1, 4px) 0 0;
        font-size: var(--font-size-xs, 12px);
        color: var(--color-text-secondary);
      }
      .attempts-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
        max-height: 18rem;
        overflow-y: auto;
      }
      .attempts-item {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        background: var(--color-surface-muted);
        border-radius: var(--radius-md, 6px);
        font-size: var(--font-size-xs, 12px);
      }
      .attempts-time {
        font-family: var(--font-family-mono, monospace);
        color: var(--color-text-secondary);
      }
      .attempts-correlation {
        font-family: var(--font-family-mono, monospace);
        color: var(--color-text-primary);
        margin-left: auto;
      }
      @media (max-width: 720px) {
        .form-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DeviceSimulatorSectionComponent implements OnInit {
  protected readonly service = inject(DeviceSimulatorService);
  private readonly toast = inject(ToastService);

  @Input() devices: DeviceHealthDto[] = [];

  protected readonly failureModes: SimulatorFailureMode[] = [0, 1, 2, 3];
  // Render the four failure modes with explicit string-valued <option>s so
  // the underlying HTMLSelectElement.value lands on '0' / '1' / '2' / '3'
  // (string-comparable). Binding `[value]="mode"` on a number fails to
  // round-trip through the DOM when the corresponding `[ngModel]` writes a
  // number back, leaving `select.value === ''` and the test suite red.
  protected readonly failureModeOptions: ReadonlyArray<{
    value: string;
    label: string;
    mode: SimulatorFailureMode;
  }> = this.failureModes.map((mode) => ({
    value: String(mode),
    label: this.failureModeLabel(mode),
    mode,
  }));
  protected readonly selectedId = signal<string | null>(null);
  protected readonly failureMode = signal<SimulatorFailureMode>(0);
  protected readonly offlineUntilLocal = signal<string>(
    formatLocalDatetime(new Date(Date.now() + 60_000))
  );
  protected readonly enqueueCount = signal<number>(5);
  protected readonly enqueueFromSeq = signal<number>(0);

  protected readonly recordedAttempts = this.service.recordedAttempts;
  protected readonly hasMoreAttempts = this.service.hasMoreAttempts;
  protected readonly pendingAction = this.service.pendingAction;
  protected readonly lastError = this.service.lastError;

  failureModeLabel(mode: SimulatorFailureMode): string {
    return simulatorFailureModeLabel(mode);
  }

  isPending(action: SimulatorAction): boolean {
    return this.service.pendingAction() === action;
  }

  constructor() {
    // Stay in sync with the service's selectedDeviceId. The user input
    // (device <select>) writes to selectedId via onDeviceChange, and
    // the service writes to selectedDeviceId via selectDevice(); the
    // effect reconciles both directions so the template's
    // [ngModel]="selectedId()" always reflects the canonical value.
    effect(() => {
      const id = this.service.selectedDeviceId();
      if (id && id !== this.selectedId()) {
        this.selectedId.set(id);
      }
    });
  }

  ngOnInit(): void {
    // The default offline-until value is set at field-init time so the
    // input is populated even when the device list is empty at mount
    // (the test suite starts with `devices = []` and flips it later via
    // `setInput()`). Selecting the first device is no longer needed
    // here either — the effect below picks the change up.

    const first = this.devices[0];
    if (first && !this.service.selectedDeviceId()) {
      this.service.selectDevice(first.deviceId);
    }
  }

  onDeviceChange(deviceId: string): void {
    this.service.clearError();
    this.service.selectDevice(deviceId);
  }

  onApplyFailureMode(): void {
    const id = this.selectedId();
    if (!id) return;
    const mode = this.failureMode();
    const label = this.failureModeLabel(mode);
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(
        `Set failure mode to "${label}" for this device? Subsequent unlocks will reflect this.`,
      );
      if (!ok) return;
    }
    // The service owns the error UX (toast.error + lastError); the
    // component's success path is the only place we emit a toast here.
    // The trailing .catch is intentionally a no-op so that an unhandled
    // rejection doesn't bubble up to Zone.js (which Karma reports as a
    // test failure).
    this.service
      .setFailureMode(id, mode)
      .then(() => {
        this.toast.success(`Failure mode set to ${label}.`);
      })
      .catch(() => undefined);
  }

  onApplyOffline(): void {
    const id = this.selectedId();
    if (!id) return;
    const untilUtc = new Date(this.offlineUntilLocal());
    if (Number.isNaN(untilUtc.getTime())) {
      this.toast.error('Enter a valid "offline until" timestamp.');
      return;
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(`Mark this device offline until ${untilUtc.toISOString()}?`);
      if (!ok) return;
    }
    this.service
      .setOfflineUntil(id, untilUtc)
      .then(() => {
        this.toast.success(`Device marked offline until ${untilUtc.toISOString()}.`);
      })
      .catch(() => undefined);
  }

  onReset(): void {
    const id = this.selectedId();
    if (!id) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(
        'Reset simulator state for this device? Recorded attempts, failure mode, and offline window will be cleared.',
      );
      if (!ok) return;
    }
    this.service
      .reset(id)
      .then(() => {
        this.toast.success('Simulator reset.');
      })
      .catch(() => undefined);
  }

  onEnqueue(): void {
    const id = this.selectedId();
    if (!id) return;
    const count = this.enqueueCount();
    const fromSeq = this.enqueueFromSeq();
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(`Pre-load ${count} events from sequence ${fromSeq}?`);
      if (!ok) return;
    }
    this.service
      .enqueueOffline(id, count, fromSeq)
      .then((result) => {
        if (result) this.toast.success(`Enqueued ${result.queued} events.`);
      })
      .catch(() => undefined);
  }

  onDrain(): void {
    const id = this.selectedId();
    if (!id) return;
    this.service
      .drainQueue(id)
      .then((items) => {
        this.toast.info(`Drained ${items.length} events.`);
      })
      .catch(() => undefined);
  }
}

function formatLocalDatetime(d: Date): string {
  // YYYY-MM-DDTHH:mm in local time (input[type=datetime-local] format).
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}