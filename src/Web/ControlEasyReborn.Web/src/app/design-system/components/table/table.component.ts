import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ce-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-table-wrapper">
      <table class="ce-table">
        <ng-content />
      </table>
    </div>
  `,
  styles: [
    `
      .ce-table-wrapper {
        width: 100%;
        overflow-x: auto;
        border-top: 3px solid var(--color-sidebar-bg);
        border-radius: 0;
      }
      :host ::ng-deep .ce-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
      }
      :host ::ng-deep .ce-table thead {
        position: sticky;
        top: 0;
        z-index: 1;
        background: color-mix(in oklch, var(--color-sidebar-bg) 7%, var(--color-surface));
      }
      :host ::ng-deep .ce-table th {
        padding: var(--space-3) var(--space-4);
        text-align: left;
        font-family: var(--font-family-mono);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        border-bottom: 1px solid var(--color-border);
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      :host ::ng-deep .ce-table td {
        padding: var(--space-3) var(--space-4);
        color: var(--color-text-primary);
        border-bottom: 1px solid var(--color-border);
      }
      :host ::ng-deep .ce-table tbody tr:last-child td {
        border-bottom: none;
      }
      :host ::ng-deep .ce-table tbody tr:hover {
        background: color-mix(in oklch, var(--color-surface) 50%, transparent);
      }
    `,
  ],
})
export class CeTableComponent {}
