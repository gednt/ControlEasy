import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { CeModalComponent } from '../../../design-system/components/modal/modal.component';
import { ToastService } from '../../../design-system/components/toast/toast.component';
import { DevicesApiService } from '../devices-api.service';
import {
  DeviceHealthDto,
  DEVICE_UNBOUND_GATEHOUSE_ID,
  EditDeviceRequest,
  UpdateDeviceThresholdsRequest,
} from '../door-unlock.types';
import { getApiErrorMessage } from '../../../core/utils/api-error.util';

interface DeviceConfigureFormShape {
  gatehouseId: FormControl<string>;
  offlineAfterSeconds: FormControl<number | null>;
  errorRateThresholdPercent: FormControl<number | null>;
}

export interface ConfigureGatehouseOption {
  id: string;
  name: string;
}

// Rejects non-integer numbers — the backend column is INT and "90.5 seconds"
// would otherwise be silently truncated (or 400 from the validator).
const integerValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (control.value === null || control.value === undefined || control.value === '') return null;
  return Number.isInteger(control.value) ? null : { notInteger: true };
};

// Per-device Configure dialog on /devices — combines the gatehouse binding
// (existing PATCH /api/v1/devices/{id}) with the persisted heartbeat
// thresholds (PUT /api/v1/devices/{deviceId}/thresholds). Follows the
// device-form-modal conventions: @Input open + device, CeModalComponent,
// saved/cancelled outputs, getApiErrorMessage for error copy. Save calls
// update() / updateThresholds() only for the field groups the user changed —
// invalid input never fires an API call (client-side mirror of the backend
// validator: offlineAfterSeconds >= 1 integer, 0 <= errorRateThresholdPercent
// <= 100).
@Component({
  selector: 'ce-device-configure-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CeModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ce-modal
      [open]="open"
      title="Configure device"
      size="sm"
      (openChange)="onOpenChange($event)"
      (closed)="onCancelled()"
    >
      <form [formGroup]="form" class="configure-form" (ngSubmit)="onSubmit()">
        <p class="device-line" data-testid="configure-device-line">{{ deviceLabel() }}</p>

        <div class="form-row">
          <label for="configure-gatehouse">Gatehouse</label>
          <select
            id="configure-gatehouse"
            class="ce-select"
            formControlName="gatehouseId"
            data-testid="configure-gatehouse"
          >
            <option value="">No binding</option>
            @for (g of gatehouses(); track g.id) {
              <option [value]="g.id">{{ g.name }}</option>
            }
          </select>
        </div>

        <div class="form-row">
          <label for="configure-offline">Offline after (seconds)</label>
          <input
            id="configure-offline"
            class="ce-input"
            type="number"
            min="1"
            max="86400"
            step="1"
            formControlName="offlineAfterSeconds"
            data-testid="configure-offline"
          />
          @if (offlineError()) {
            <div class="field-error" role="alert" data-testid="configure-offline-error">
              {{ offlineError() }}
            </div>
          }
        </div>

        <div class="form-row">
          <label for="configure-percent">Error rate threshold (%)</label>
          <input
            id="configure-percent"
            class="ce-input"
            type="number"
            min="0"
            max="100"
            step="0.5"
            formControlName="errorRateThresholdPercent"
            data-testid="configure-percent"
          />
          @if (percentError()) {
            <div class="field-error" role="alert" data-testid="configure-percent-error">
              {{ percentError() }}
            </div>
          }
        </div>

        @if (errorMessage()) {
          <div class="form-error" role="alert" data-testid="configure-form-error">
            {{ errorMessage() }}
          </div>
        }

        <div class="modal-footer">
          <button type="button" class="ce-button variant-ghost" (click)="onCancelled()">
            Cancel
          </button>
          <button
            type="submit"
            class="ce-button variant-primary"
            [disabled]="form.invalid || !canSubmit() || saving()"
            data-testid="configure-save"
          >
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </ce-modal>
  `,
  styles: [
    `
      .configure-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
      }
      .device-line {
        margin: 0;
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary);
      }
      .form-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .form-row label {
        font-size: var(--font-size-sm, 14px);
        font-weight: 500;
        color: var(--color-text-primary);
      }
      .ce-select,
      .ce-input {
        width: 100%;
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        font-family: inherit;
        font-size: var(--font-size-sm, 14px);
        background: var(--color-surface);
        color: var(--color-text-primary);
      }
      .ce-select:focus,
      .ce-input:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 1px;
      }
      .field-error {
        font-size: var(--font-size-xs, 12px);
        color: var(--color-danger);
      }
      .form-error {
        padding: var(--space-2, 8px) var(--space-3, 12px);
        background: var(--color-danger-light);
        border-left: 4px solid var(--color-danger);
        color: var(--color-danger);
        border-radius: 4px;
        font-size: var(--font-size-sm, 14px);
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2, 8px);
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
      .variant-primary {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
      }
      .variant-ghost {
        background: transparent;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class DeviceConfigureModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly devicesApi = inject(DevicesApiService);
  private readonly toast = inject(ToastService);

  @Input() open = false;

  @Input() set device(value: DeviceHealthDto | undefined | null) {
    this._device.set(value ?? undefined);
    this.rebuildForm();
  }
  get device(): DeviceHealthDto | undefined {
    return this._device();
  }

  // Registered (active) tenant gatehouses; the merge that keeps the device's
  // current binding (even an inactive one) in the list happens on the page.
  @Input() set gatehouseList(value: ReadonlyArray<ConfigureGatehouseOption>) {
    this.gatehouses.set(value ?? []);
  }

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly gatehouses = signal<ReadonlyArray<ConfigureGatehouseOption>>([]);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly _device = signal<DeviceHealthDto | undefined>(undefined);

  readonly deviceLabel = computed(() => {
    const d = this._device();
    if (!d) return '';
    const kind = d.deviceType === 'controller' ? 'controller' : 'reader';
    return `${d.vendor} ${kind}${d.gatehouseName ? ' — currently bound to ' + d.gatehouseName : ''}`;
  });

  readonly form: FormGroup<DeviceConfigureFormShape> = this.fb.group<DeviceConfigureFormShape>({
    // gatehouseId takes '' ("No binding") or a registered gatehouse id — an
    // EMPTY value is a valid, meaningful state here, so no required validator.
    gatehouseId: this.fb.nonNullable.control<string>(''),
    offlineAfterSeconds: this.fb.nonNullable.control<number | null>(60, [
      Validators.required,
      Validators.min(1),
      // Mirrors the backend validator's upper bound: an offline threshold
      // beyond a day is almost certainly a data-entry error.
      Validators.max(86400),
      integerValidator,
    ]),
    errorRateThresholdPercent: this.fb.nonNullable.control<number | null>(10, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
  });

  // Baseline captured at rebuild; drive change detection via valueChanges
  // (signals don't auto-track Angular form values, so the derived
  // changed/error flags are re-materialised as signals on every change).
  private baselineGatehouseId = '';
  private baselineOfflineAfterSeconds: number | null = 60;
  private baselineErrorRateThresholdPercent: number | null = 10;

  readonly gatehouseChanged = signal(false);
  readonly thresholdsChanged = signal(false);
  readonly canSubmit = computed(() => this.gatehouseChanged() || this.thresholdsChanged());

  readonly offlineError = signal<string | null>(null);
  readonly percentError = signal<string | null>(null);

  constructor() {
    this.recomputeChanges();
    this.form.valueChanges.subscribe(() => this.recomputeChanges());
  }

  ngOnInit(): void {
    if (this._device() === undefined && this.open) {
      this.rebuildForm();
    }
  }

  private recomputeChanges(): void {
    const gatehouseControl = this.form.controls.gatehouseId;
    const offlineControl = this.form.controls.offlineAfterSeconds;
    const percentControl = this.form.controls.errorRateThresholdPercent;

    if (this._device() === undefined) {
      // No device bound to the dialog — nothing can be "changed".
      this.gatehouseChanged.set(false);
      this.thresholdsChanged.set(false);
      this.offlineError.set(null);
      this.percentError.set(null);
      return;
    }

    const gatehouseId = gatehouseControl.value ?? '';
    const offline = offlineControl.value;
    const percent = percentControl.value;
    this.gatehouseChanged.set(gatehouseId !== this.baselineGatehouseId);
    this.thresholdsChanged.set(
      offline !== null && percent !== null &&
        (offline !== this.baselineOfflineAfterSeconds ||
          percent !== this.baselineErrorRateThresholdPercent)
    );

    this.offlineError.set(this.fieldErrorText(offlineControl, [
      ['required', 'Offline threshold is required.'],
      ['min', 'Offline threshold must be at least 1 second.'],
      ['max', 'Offline threshold must be at most 86400 seconds (24 hours).'],
      ['notInteger', 'Offline threshold must be a whole number of seconds.'],
    ], 'Offline threshold is invalid.'));

    this.percentError.set(this.fieldErrorText(percentControl, [
      ['required', 'Error rate threshold is required.'],
      ['min', 'Error rate threshold must be between 0 and 100.'],
      ['max', 'Error rate threshold must be between 0 and 100.'],
    ], 'Error rate threshold is invalid.'));
  }

  private fieldErrorText(
    control: AbstractControl<number | null> | AbstractControl,
    messages: ReadonlyArray<readonly [string, string]>,
    fallback: string
  ): string | null {
    // No touched/dirty visibility gate: the dialog opens with valid
    // prefilled values (whatever the server row carries), so any invalid
    // value at read time is user-caused and must surface inline immediately.
    if (!control.invalid) return null;
    const errors = control.errors ?? {};
    for (const [key, message] of messages) {
      if (errors[key]) return message;
    }
    return fallback;
  }

  rebuildForm(): void {
    const existing = this._device();
    if (existing) {
      this.baselineGatehouseId = existing.gatehouseId ?? '';
      this.baselineOfflineAfterSeconds = existing.offlineAfterSeconds;
      this.baselineErrorRateThresholdPercent = existing.errorRateThresholdPercent;
      this.form.reset({
        gatehouseId: existing.gatehouseId ?? '',
        offlineAfterSeconds: existing.offlineAfterSeconds,
        errorRateThresholdPercent: existing.errorRateThresholdPercent,
      });
    } else {
      this.baselineGatehouseId = '';
      this.baselineOfflineAfterSeconds = null;
      this.baselineErrorRateThresholdPercent = null;
      this.form.reset({ gatehouseId: '', offlineAfterSeconds: null, errorRateThresholdPercent: null });
    }
    this.errorMessage.set(null);
    this.saving.set(false);
    this.recomputeChanges();
  }

  onOpenChange(isOpen: boolean): void {
    if (!isOpen) {
      this.onCancelled();
    }
  }

  onCancelled(): void {
    this.cancelled.emit();
  }

  async onSubmit(): Promise<void> {
    const current = this._device();
    if (!current || this.form.invalid || this.saving() || !this.canSubmit()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const gatehouseId = this.form.controls.gatehouseId.value ?? '';
      const offline = this.form.controls.offlineAfterSeconds.value;
      const percent = this.form.controls.errorRateThresholdPercent.value;

      if (this.gatehouseChanged()) {
        // '' ("No binding") → the EditDeviceRequest contract's Guid.Empty
        // marker clears the binding; a real id binds/rebinds.
        const editPayload: EditDeviceRequest = {
          gatehouseId: gatehouseId || DEVICE_UNBOUND_GATEHOUSE_ID,
        };
        await new Promise<void>((resolve, reject) => {
          this.devicesApi.update(current.deviceId, editPayload).subscribe({
            next: () => resolve(),
            error: (e) => reject(e),
          });
        });
      }

      if (this.thresholdsChanged() && offline !== null && percent !== null) {
        const thresholds: UpdateDeviceThresholdsRequest = {
          offlineAfterSeconds: offline,
          errorRateThresholdPercent: percent,
        };
        await new Promise<void>((resolve, reject) => {
          this.devicesApi.updateThresholds(current.deviceId, thresholds).subscribe({
            next: () => resolve(),
            error: (e) => reject(e),
          });
        });
      }

      this.saving.set(false);
      // One consolidated confirmation for the whole dialog save (binding
      // and/or thresholds) — no stacked duplicate toasts.
      this.toast.success('Device configuration saved.');
      this.saved.emit();
    } catch (err) {
      this.saving.set(false);
      this.errorMessage.set(getApiErrorMessage(err, 'Failed to save device configuration.'));
    }
  }
}