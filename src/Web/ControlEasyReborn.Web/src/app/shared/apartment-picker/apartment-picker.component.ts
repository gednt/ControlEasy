import { Component, ChangeDetectionStrategy, inject, signal, Input, forwardRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  ApartmentsApiService,
  ApartmentResponse,
  formatApartmentLabel,
} from '../../features/apartments/apartments-api.service';

@Component({
  selector: 'ce-apartment-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ApartmentPickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ce-input-group">
      @if (label) {
        <label class="ce-input-label" [for]="inputId">{{ label }}</label>
      }
      <div class="ce-input-wrapper select-wrapper" [class.has-error]="hasError">
        @if (loading()) {
          <span class="picker-loading">Loading apartments...</span>
        } @else {
          <select
            [id]="inputId"
            class="ce-select"
            [disabled]="disabled"
            [value]="value ?? ''"
            (change)="onSelect($event)"
            (blur)="onTouched()"
          >
            <option value="">{{ placeholder }}</option>
            @for (apartment of apartments(); track apartment.id) {
              <option [value]="apartment.id">{{ formatLabel(apartment) }}</option>
            }
          </select>
        }
      </div>
      @if (loadError()) {
        <div class="ce-input-error">{{ loadError() }}</div>
      }
    </div>
  `,
  styles: [
    `
      .ce-input-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .ce-input-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }
      .ce-input-wrapper {
        display: flex;
        align-items: center;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        transition:
          border-color var(--duration-fast) var(--ease-out),
          box-shadow var(--duration-fast) var(--ease-out);
        overflow: hidden;
      }
      .ce-input-wrapper:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 15%, transparent);
      }
      .ce-input-wrapper.has-error {
        border-color: var(--color-danger);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-danger) 15%, transparent);
      }
      .select-wrapper {
        padding: 0;
      }
      .ce-select {
        flex: 1;
        border: 0;
        background: transparent;
        padding: var(--space-3);
        font-family: inherit;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        outline: none;
        min-height: 2.5rem;
        width: 100%;
        cursor: pointer;
      }
      .ce-select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .picker-loading {
        padding: var(--space-3);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }
      .ce-input-error {
        font-size: var(--font-size-xs);
        color: var(--color-danger);
        font-weight: var(--font-weight-medium);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApartmentPickerComponent implements ControlValueAccessor, OnInit {
  private readonly api = inject(ApartmentsApiService);

  @Input() label = 'Apartment';
  @Input() placeholder = 'Select apartment...';
  @Input() inputId = 'apartment-picker';
  @Input() activeOnly = true;
  @Input() hasError = false;

  apartments = signal<ApartmentResponse[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  value: string | null = null;
  disabled = false;

  private onChange: (value: string | null) => void = () => {};
  onTouched: () => void = () => {};

  readonly formatLabel = formatApartmentLabel;

  ngOnInit(): void {
    this.loadApartments();
  }

  loadApartments(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list(undefined, 0, 500).subscribe({
      next: (data) => {
        const filtered = this.activeOnly ? data.filter((a) => a.active) : data;
        this.apartments.set(filtered);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load apartments');
        this.loading.set(false);
      },
    });
  }

  onSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selected = target.value || null;
    this.value = selected;
    this.onChange(selected);
  }

  writeValue(value: string | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
