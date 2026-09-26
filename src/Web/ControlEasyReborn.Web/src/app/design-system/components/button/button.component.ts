import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { clsx } from 'clsx';

@Component({
  selector: 'ce-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [class]="hostClass()"
      [type]="type()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-disabled]="disabled() || loading() ? 'true' : null"
      [disabled]="disabled() || loading()"
    >
      @if (loading()) {
        <span class="ce-spinner-sm" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      :host button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-md);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        font-family: inherit;
        border: 1px solid transparent;
        transition:
          transform var(--duration-fast) var(--ease-out),
          box-shadow var(--duration-fast) var(--ease-out),
          background-color var(--duration-fast) var(--ease-out),
          border-color var(--duration-fast) var(--ease-out),
          color var(--duration-fast) var(--ease-out),
          opacity var(--duration-fast) var(--ease-out);
      }
      :host button:disabled,
      :host button[aria-busy='true'] {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
      }
      :host button:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .size-sm {
        height: 2rem;
        padding: 0 var(--space-3);
        font-size: var(--font-size-sm);
      }
      .size-md {
        height: 2.5rem;
        padding: 0 var(--space-4);
        font-size: var(--font-size-sm);
      }
      .size-lg {
        height: 3rem;
        padding: 0 var(--space-6);
        font-size: var(--font-size-base);
      }
      .variant-primary {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        box-shadow: var(--shadow-primary-glow);
      }
      .variant-primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
        transform: translateY(-2px);
        box-shadow: var(--shadow-primary-glow);
      }
      .variant-secondary {
        background: var(--color-surface);
        color: var(--color-text-primary);
        border-color: var(--color-border);
      }
      .variant-secondary:hover:not(:disabled) {
        background: var(--color-surface-elevated);
      }
      .variant-ghost {
        background: transparent;
        color: var(--color-text-primary);
      }
      .variant-ghost:hover:not(:disabled) {
        background: var(--color-surface);
      }
      .variant-danger {
        background: var(--color-danger);
        color: var(--color-text-on-primary);
      }
      .variant-danger:hover:not(:disabled) {
        opacity: 0.9;
      }
      .ce-spinner-sm {
        width: 1rem;
        height: 1rem;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: var(--radius-full);
        animation: spin-slow 1.4s linear infinite;
        display: inline-block;
      }
      @media (prefers-reduced-motion: reduce) {
        .ce-spinner-sm {
          animation: none;
          border-style: dashed;
        }
        :host button {
          transition: none;
        }
      }
    `,
  ],
})
export class CeButtonComponent {
  variant = input<'primary' | 'secondary' | 'ghost' | 'danger'>('primary');
  size = input<'sm' | 'md' | 'lg'>('md');
  loading = input(false);
  disabled = input(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  buttonClick = output<MouseEvent>();

  hostClass = computed(() => clsx(this.size(), this.variant()));
}
