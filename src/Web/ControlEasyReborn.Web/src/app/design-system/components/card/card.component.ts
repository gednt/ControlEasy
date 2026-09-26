import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ce-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-card" [class]="hostClass()">
      <ng-content select="[ce-card-header], [card-header]" />
      <div class="ce-card-body" [class.unpadded]="!padded()">
        <ng-content />
      </div>
      <ng-content select="[ce-card-footer], [card-footer]" />
    </div>
  `,
  styles: [
    `
      .ce-card {
        background: var(--color-surface);
        border: 0;
        border-top: 3px solid var(--color-sidebar-bg);
        border-radius: 0;
        box-shadow: var(--shadow-card);
        overflow: hidden;
      }
      .ce-card.accent-primary {
        background: var(--color-primary-light);
      }
      .ce-card.accent-success {
        background: var(--color-success-light);
      }
      .ce-card.accent-warning {
        background: var(--color-warning-light);
      }
      .ce-card.accent-danger {
        background: var(--color-danger-light);
      }
      .ce-card.accent-info {
        background: var(--color-info-light);
      }
      .ce-card-body {
        padding: var(--space-6);
      }
      .ce-card-body.unpadded {
        padding: 0;
      }
      :host ::ng-deep [card-header],
      :host ::ng-deep [ce-card-header] {
        padding: var(--space-4) var(--space-6);
        border-bottom: 1px solid var(--color-border);
        font: var(--font-weight-semibold) var(--font-size-xs)/1.2 var(--font-family-mono);
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }
      :host ::ng-deep [card-footer],
      :host ::ng-deep [ce-card-footer] {
        padding: var(--space-4) var(--space-6);
        border-top: 1px solid var(--color-border);
      }
    `,
  ],
})
export class CeCardComponent {
  accent = input<'primary' | 'success' | 'warning' | 'danger' | 'info' | null>(null);
  padded = input(true);

  hostClass(): string {
    const classes: string[] = [];
    const a = this.accent();
    if (a) classes.push(`accent-${a}`);
    return classes.join(' ');
  }
}
