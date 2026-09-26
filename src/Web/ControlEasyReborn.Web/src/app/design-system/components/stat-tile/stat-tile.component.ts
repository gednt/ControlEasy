import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ce-stat-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-stat-tile">
      <div class="ce-stat-label">{{ label() }}</div>
      <div class="ce-stat-value">{{ value() }}</div>
      @if (trend()) {
        <div class="ce-stat-trend" [class]="'trend-' + trend()!.direction">
          <span class="ce-stat-trend-value">{{ trend()!.value }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ce-stat-tile {
        background: var(--color-surface);
        border: 0;
        border-radius: 0;
        padding: var(--space-4) var(--space-5);
        box-shadow: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .ce-stat-label {
        font: 700 var(--font-size-xs)/1.2 var(--font-family-mono);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-medium);
      }
      .ce-stat-value {
        font-family: var(--font-family-display);
        font-size: var(--font-size-3xl);
        font-weight: 500;
        color: var(--color-text-primary);
        line-height: var(--line-height-tight);
      }
      .ce-stat-trend {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-full);
        width: fit-content;
      }
      .trend-up {
        background: var(--color-success-light);
        color: var(--color-success);
      }
      .trend-down {
        background: var(--color-danger-light);
        color: var(--color-danger);
      }
      .trend-flat {
        background: var(--color-neutral-light);
        color: var(--color-neutral);
      }
    `,
  ],
})
export class CeStatTileComponent {
  label = input('');
  value = input<string | number>('');
  trend = input<{ direction: 'up' | 'down' | 'flat'; value: string; tone?: string } | null>(null);
}
