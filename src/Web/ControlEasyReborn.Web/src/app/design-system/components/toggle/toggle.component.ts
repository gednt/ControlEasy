import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

/**
 * Accessible toggle switch (role="switch", aria-checked) used by the consent
 * policy editor. Stateless — the parent owns the source-of-truth signal and
 * reads the latest emitted value via the (checkedChange) output.
 */
@Component({
  selector: 'ce-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="ce-toggle"
      role="switch"
      [attr.aria-checked]="checked()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <span class="track" [class.on]="checked()">
        <span class="thumb" [class.on]="checked()"></span>
      </span>
      <span class="label">{{ checked() ? 'On' : 'Off' }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }
      .ce-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2, 8px);
        background: none;
        border: 0;
        cursor: pointer;
        padding: 0;
        font-family: inherit;
        color: inherit;
      }
      .ce-toggle:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .ce-toggle:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 4px;
        border-radius: var(--radius-md, 6px);
      }
      .track {
        width: 44px;
        height: 24px;
        background: var(--color-neutral-light);
        border-radius: 12px;
        position: relative;
        transition: background 150ms ease-out;
        flex-shrink: 0;
      }
      .track.on {
        background: var(--color-primary);
      }
      .thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: var(--color-text-on-primary);
        border-radius: 50%;
        transition: transform 150ms ease-out;
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
      }
      .thumb.on {
        transform: translateX(20px);
      }
      .label {
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary);
      }
      @media (prefers-reduced-motion: reduce) {
        .track,
        .thumb {
          transition: none;
        }
      }
    `,
  ],
})
export class CeToggleComponent {
  checked = input.required<boolean>();
  disabled = input<boolean>(false);
  checkedChange = output<boolean>();

  toggle(): void {
    if (this.disabled()) return;
    this.checkedChange.emit(!this.checked());
  }
}
