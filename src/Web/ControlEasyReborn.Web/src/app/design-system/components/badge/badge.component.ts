import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ce-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ce-badge" [class]="'tone-' + tone() + ' size-' + size()" [attr.aria-label]="content()">
      {{ content() }}
    </span>
  `,
  styles: [
    `
      .ce-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-full);
        line-height: 1;
        white-space: nowrap;
      }
      .size-sm {
        font-size: var(--font-size-xs);
        padding: 2px var(--space-2);
      }
      .size-md {
        font-size: var(--font-size-xs);
        padding: var(--space-1) var(--space-3);
      }
      .tone-primary {
        background: var(--color-primary-light);
        color: var(--color-primary);
      }
      .tone-success {
        background: var(--color-success-light);
        color: var(--color-success);
      }
      .tone-warning {
        background: var(--color-warning-light);
        color: var(--color-warning);
      }
      .tone-danger {
        background: var(--color-danger-light);
        color: var(--color-danger);
      }
      .tone-info {
        background: var(--color-info-light);
        color: var(--color-info);
      }
      .tone-neutral {
        background: var(--color-neutral-light);
        color: var(--color-neutral);
      }
    `,
  ],
})
export class CeBadgeComponent {
  content = input('');
  tone = input<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>('neutral');
  size = input<'sm' | 'md'>('md');
}
