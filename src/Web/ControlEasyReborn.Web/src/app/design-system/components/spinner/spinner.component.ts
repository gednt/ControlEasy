import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ce-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-spinner" [class]="'size-' + size() + ' tone-' + tone()" role="status" aria-label="Loading"></div>
  `,
  styles: [
    `
      .ce-spinner {
        border-radius: var(--radius-full);
        border: 2px solid currentColor;
        border-top-color: transparent;
        animation: spin-slow 1.4s linear infinite;
        display: inline-block;
      }
      .size-sm {
        width: 1rem;
        height: 1rem;
        border-width: 2px;
      }
      .size-md {
        width: 1.5rem;
        height: 1.5rem;
        border-width: 2.5px;
      }
      .size-lg {
        width: 2rem;
        height: 2rem;
        border-width: 3px;
      }
      .tone-primary {
        color: var(--color-primary);
      }
      .tone-current {
        color: currentColor;
      }
      @media (prefers-reduced-motion: reduce) {
        .ce-spinner {
          animation: none;
          border-style: dashed;
        }
      }
    `,
  ],
})
export class CeSpinnerComponent {
  size = input<'sm' | 'md' | 'lg'>('md');
  tone = input<'primary' | 'current'>('current');
}
