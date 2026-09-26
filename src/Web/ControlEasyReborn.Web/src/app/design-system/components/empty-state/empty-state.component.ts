import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ce-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-empty-state">
      @if (icon()) {
        <div class="ce-empty-state-icon">{{ icon() }}</div>
      }
      <h3 class="ce-empty-state-title">{{ title() }}</h3>
      @if (description()) {
        <p class="ce-empty-state-desc">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <button class="ce-empty-state-action" type="button" (click)="action.emit()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .ce-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: var(--space-8) var(--space-4);
      }
      .ce-empty-state-icon {
        font-size: 2.5rem;
        margin-bottom: var(--space-4);
        color: var(--color-text-muted);
      }
      .ce-empty-state-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin-bottom: var(--space-2);
      }
      .ce-empty-state-desc {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        max-width: 24rem;
        margin-bottom: var(--space-4);
      }
      .ce-empty-state-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        border: 0;
        border-radius: var(--radius-lg);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-family: inherit;
        transition: background var(--duration-fast) var(--ease-out);
      }
      .ce-empty-state-action:hover {
        background: var(--color-primary-hover);
      }
    `,
  ],
})
export class CeEmptyStateComponent {
  icon = input('');
  title = input('');
  description = input('');
  actionLabel = input('');
  action = output<void>();
}
