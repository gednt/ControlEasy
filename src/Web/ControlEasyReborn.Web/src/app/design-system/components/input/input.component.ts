import {
  Component,
  input,
  forwardRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'ce-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CeInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ce-input-group" [class.has-error]="error()">
      <label class="ce-input-label" [attr.for]="inputId()">{{ label() }}</label>
      <div class="ce-input-wrapper" [class.has-error]="error()">
        <ng-content select="[input-prefix]" />
        <input
          [id]="inputId()"
          class="ce-input"
          [type]="type()"
          [placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="helper() || error() ? inputId() + '-helper' : null"
          [value]="internalValue()"
          (input)="onInput($event)"
          (blur)="onBlur()"
        />
        <ng-content select="[input-suffix]" />
      </div>
      @if (error()) {
        <div class="ce-input-error" [id]="inputId() + '-helper'" role="alert">{{ error() }}</div>
      } @else if (helper()) {
        <div class="ce-input-helper" [id]="inputId() + '-helper'">{{ helper() }}</div>
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
      .ce-input {
        flex: 1;
        border: 0;
        background: transparent;
        padding: var(--space-3);
        font-family: inherit;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        outline: none;
        min-height: 2.5rem;
      }
      .ce-input::placeholder {
        color: var(--color-text-muted);
      }
      .ce-input-error {
        font-size: var(--font-size-xs);
        color: var(--color-danger);
        font-weight: var(--font-weight-medium);
      }
      .ce-input-helper {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }
      :host ::ng-deep [input-prefix],
      :host ::ng-deep [input-suffix] {
        display: flex;
        align-items: center;
        padding: 0 var(--space-3);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class CeInputComponent implements ControlValueAccessor {
  label = input('');
  helper = input('');
  error = input<string | null>(null);
  placeholder = input('');
  type = input('text');
  autocomplete = input('');
  inputId = input('ce-input');

  internalValue = signal('');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private cdr = inject(ChangeDetectorRef);

  writeValue(value: string): void {
    this.internalValue.set(value ?? '');
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.internalValue.set(target.value);
    this.onChange(target.value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
