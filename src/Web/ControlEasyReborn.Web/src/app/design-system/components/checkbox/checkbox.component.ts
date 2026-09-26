import { Component, input, output, ChangeDetectionStrategy, signal, forwardRef } from '@angular/core';

@Component({
  selector: 'ce-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ce-checkbox" [class.disabled]="disabled()">
      <input
        type="checkbox"
        class="ce-checkbox-input"
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [name]="name()"
        [attr.aria-checked]="indeterminate() ? 'mixed' : checked() ? 'true' : 'false'"
        (change)="onChange($event)"
      />
      <span class="ce-checkbox-box" [class.checked]="checked()" [class.indeterminate]="indeterminate()">
        @if (checked() && !indeterminate()) {
          <svg viewBox="0 0 16 16" fill="none" class="ce-checkbox-check">
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        }
        @if (indeterminate()) {
          <svg viewBox="0 0 16 16" fill="none" class="ce-checkbox-check">
            <rect x="3" y="7" width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        }
      </span>
      <span class="ce-checkbox-label">{{ label() }}</span>
    </label>
  `,
  styles: [
    `
      .ce-checkbox {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
        user-select: none;
        min-height: 44px;
      }
      .ce-checkbox.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
      .ce-checkbox-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 0;
        height: 0;
      }
      .ce-checkbox-box {
        width: 1.25rem;
        height: 1.25rem;
        border: 1.5px solid var(--color-border);
        background: var(--color-surface);
        border-radius: var(--radius-sm);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
          background var(--duration-fast) var(--ease-out),
          border-color var(--duration-fast) var(--ease-out);
        flex-shrink: 0;
        position: relative;
      }
      .ce-checkbox-box.checked {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }
      .ce-checkbox-box.indeterminate {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }
      .ce-checkbox-check {
        width: 0.875rem;
        height: 0.875rem;
        color: var(--color-text-on-primary);
      }
      .ce-checkbox-input:focus-visible + .ce-checkbox-box {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 15%, transparent);
      }
      .ce-checkbox-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class CeCheckboxComponent {
  label = input('');
  checked = input(false);
  checkedChange = output<boolean>();
  disabled = input(false);
  indeterminate = input(false);
  name = input('');

  onChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.checkedChange.emit(target.checked);
  }
}
