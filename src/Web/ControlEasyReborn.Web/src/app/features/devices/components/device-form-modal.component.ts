import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
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
import { DevicesApiService } from '../devices-api.service';
import {
  DeviceDetail,
  EditDeviceRequest,
  RegisterDeviceRequest,
} from '../door-unlock.types';
import { getApiErrorMessage } from '../../../core/utils/api-error.util';

interface DeviceFormShape {
  deviceType: FormControl<'reader' | 'controller'>;
  vendor: FormControl<string>;
  gatehouseId: FormControl<string>;
  connectionParams: FormControl<string>;
}

interface GatehouseOption {
  id: string;
  name: string;
}

const VENDOR_OPTIONS = ['Generic', 'Control iD', 'Intelbras', 'Hikvision', 'Other'] as const;
type VendorOption = (typeof VENDOR_OPTIONS)[number] | string;

@Component({
  selector: 'ce-device-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CeModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ce-modal
      [open]="open"
      [title]="isEditMode() ? 'Edit device' : 'Register device'"
      size="md"
      (openChange)="onOpenChange($event)"
      (closed)="onCancelled()"
    >
      <form [formGroup]="form" class="device-form" (ngSubmit)="onSubmit()">
        <div class="form-row">
          <label for="device-type">Type *</label>
          <select
            id="device-type"
            class="ce-select"
            formControlName="deviceType"
            [attr.aria-readonly]="isEditMode() ? 'true' : null"
            [disabled]="isEditMode()"
          >
            <option value="reader">Reader</option>
            <option value="controller">Controller</option>
          </select>
        </div>

        <div class="form-row">
          <label for="vendor">Vendor *</label>
          <select id="vendor" class="ce-select" formControlName="vendor">
            @for (option of vendorOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </div>

        <div class="form-row">
          <label for="gatehouse">Gatehouse *</label>
          <select
            id="gatehouse"
            class="ce-select"
            formControlName="gatehouseId"
            [attr.aria-disabled]="gatehouses().length === 0 ? 'true' : null"
            [disabled]="gatehouses().length === 0"
          >
            <option value="">Select a gatehouse</option>
            @for (g of gatehouses(); track g.id) {
              <option [value]="g.id">{{ g.name }}</option>
            }
          </select>
        </div>

        <div class="form-row">
          <label for="connection-params">Connection parameters *</label>
          <textarea
            id="connection-params"
            class="ce-textarea mono"
            rows="6"
            formControlName="connectionParams"
            placeholder='{\n  "endpoint": "https://device.example.com/api",\n  "apiKey": "..."\n}'
            [attr.aria-invalid]="!connectionValid()"
          ></textarea>
          <div class="json-validity" [attr.data-state]="jsonValidity()">
            @if (jsonValidity() === 'valid') {
              <span aria-live="polite">JSON valid</span>
            } @else if (jsonValidity() === 'invalid') {
              <span aria-live="polite">Invalid JSON</span>
            } @else {
              <span class="muted">Enter connection parameters as JSON</span>
            }
          </div>
          <div class="hint warn">
            Connection parameters are encrypted at rest and never shown again.
          </div>
        </div>

        @if (errorMessage()) {
          <div class="form-error" role="alert">
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
            [disabled]="form.invalid || saving()"
          >
            {{ saving() ? 'Saving…' : submitLabel() }}
          </button>
        </div>
      </form>
    </ce-modal>
  `,
  styles: [
    `
      .device-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
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
      .ce-textarea {
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
      .ce-textarea:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 1px;
      }
      .ce-textarea.mono {
        font-family: var(--font-family-mono, monospace);
        font-size: 0.85rem;
      }
      .json-validity {
        font-size: var(--font-size-xs, 12px);
        margin-top: 4px;
      }
      .json-validity [data-state='valid'] {
        color: var(--color-success);
      }
      .json-validity [data-state='invalid'] {
        color: var(--color-danger);
      }
      .json-validity .muted {
        color: var(--color-text-secondary);
      }
      .hint.warn {
        font-size: var(--font-size-xs, 12px);
        color: var(--color-warning);
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
export class DeviceFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly devicesApi = inject(DevicesApiService);

  @Input() open = false;

  @Input() set device(value: DeviceDetail | undefined | null) {
    this._device.set(value ?? undefined);
    this.rebuildForm();
  }
  get device(): DeviceDetail | undefined {
    return this._device();
  }

  @Input() set gatehouseList(value: GatehouseOption[]) {
    this.gatehouses.set(value ?? []);
  }

  @Output() saved = new EventEmitter<DeviceDetail>();
  @Output() cancelled = new EventEmitter<void>();

  readonly vendorOptions = VENDOR_OPTIONS;
  readonly gatehouses = signal<GatehouseOption[]>([]);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly _device = signal<DeviceDetail | undefined>(undefined);

  readonly isEditMode = computed(() => this._device() !== undefined);
  readonly submitLabel = computed(() => (this.isEditMode() ? 'Save changes' : 'Register device'));

  // Track JSON validity reactively (signals don't auto-track Angular form values).
  readonly jsonValidity = signal<'valid' | 'invalid' | 'empty'>('empty');
  readonly invalidJsonType = this.jsonValidity.asReadonly();
  readonly connectionValid = computed(() => this.jsonValidity() === 'valid');

  // Custom validator: marks the form control invalid when the JSON does not
  // parse. An empty value is left to Validators.required so the JSON state
  // never reads "invalid" while the user is still typing the first character.
  private static readonly jsonValidator: ValidatorFn = (
    control: AbstractControl
  ): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (raw.length === 0) return null;
    try {
      JSON.parse(raw);
      return null;
    } catch {
      return { invalidJson: true };
    }
  };

  readonly form: FormGroup<DeviceFormShape> = this.fb.group<DeviceFormShape>({
    deviceType: this.fb.nonNullable.control<'reader' | 'controller'>('reader', Validators.required),
    vendor: this.fb.nonNullable.control<string>('Generic', Validators.required),
    gatehouseId: this.fb.nonNullable.control<string>('', Validators.required),
    connectionParams: this.fb.nonNullable.control<string>('', [
      Validators.required,
      DeviceFormModalComponent.jsonValidator
    ]),
  });

  constructor() {
    this.rebuildForm();

    // Track JSON validity via form valueChanges (signals don't auto-track Angular forms).
    this.form.controls.connectionParams.valueChanges.subscribe(() => {
      this.recomputeJsonValidity();
    });
  }

  private recomputeJsonValidity(): void {
    const raw = (this.form.controls.connectionParams.value ?? '').trim();
    if (raw.length === 0) {
      this.jsonValidity.set('empty');
      return;
    }
    try {
      JSON.parse(raw);
      this.jsonValidity.set('valid');
    } catch {
      this.jsonValidity.set('invalid');
    }
  }

  rebuildForm(): void {
    const existing = this._device();
    if (existing) {
      this.form.reset({
        deviceType: existing.deviceType,
        vendor: existing.vendor,
        gatehouseId: existing.gatehouseId ?? '',
        connectionParams: '',
      });
      this.form.controls.deviceType.disable();
    } else {
      this.form.controls.deviceType.enable();
      this.form.reset({
        deviceType: 'reader',
        vendor: 'Generic',
        gatehouseId: '',
        connectionParams: '',
      });
    }
    this.recomputeJsonValidity();
    this.errorMessage.set(null);
    this.saving.set(false);
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
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.controls.connectionParams.value ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.errorMessage.set('Connection parameters must be valid JSON.');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      this.errorMessage.set('Connection parameters must be a JSON object.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const deviceType = this.form.controls.deviceType.value;
    const vendor = this.form.controls.vendor.value;
    const gatehouseId = this.form.controls.gatehouseId.value;

    try {
      if (this.isEditMode()) {
        const existingId = this._device()!.id;
        const editPayload: EditDeviceRequest = {
          vendor: vendor,
          gatehouseId: gatehouseId || null,
          connectionParams: parsed,
        };
        const updated = await new Promise<DeviceDetail>((resolve, reject) => {
          this.devicesApi.update(existingId, editPayload).subscribe({
            next: (r) => resolve(r),
            error: (e) => reject(e),
          });
        });
        this.saving.set(false);
        this.saved.emit(updated);
      } else {
        const payload: RegisterDeviceRequest = {
          deviceType: deviceType,
          vendor: vendor,
          gatehouseId: gatehouseId || null,
          connectionParams: parsed,
        };
        const created = await new Promise<DeviceDetail>((resolve, reject) => {
          this.devicesApi.register(payload).subscribe({
            next: (r) => resolve(r),
            error: (e) => reject(e),
          });
        });
        this.saving.set(false);
        this.saved.emit(created);
      }
    } catch (err) {
      this.saving.set(false);
      this.errorMessage.set(getApiErrorMessage(err, 'Failed to save device.'));
    }
  }

  asVendorOption(value: string): VendorOption {
    return value as VendorOption;
  }
}