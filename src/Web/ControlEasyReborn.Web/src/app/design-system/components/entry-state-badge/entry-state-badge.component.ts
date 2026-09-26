import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { CeIconComponent } from '../icon/icon.component';
import type { LucideIconName } from '../icon/icon.types';
import type { EntryState } from '../../../features/entry-log/entry-log.service';

interface EntryStateMeta {
  tone: 'success' | 'warning' | 'neutral' | 'danger';
  icon: LucideIconName;
  label: string;
}

const STATE_META: Record<EntryState, EntryStateMeta> = {
  entered_with_consent: { tone: 'success', icon: 'check-circle', label: 'With consent' },
  entered_override: { tone: 'warning', icon: 'alert-triangle', label: 'Override' },
  gatehouse_only: { tone: 'neutral', icon: 'package', label: 'No entry' },
  entered_without_consent: {
    tone: 'danger',
    icon: 'x-circle',
    label: 'Refused',
  },
  exited: { tone: 'neutral', icon: 'log-out', label: 'Exit' },
};

/**
 * Inline pill badge for entry-state values. Tone colors are scoped to the
 * design-system tokens (success/warning/neutral/danger) so dark theme and
 * future skinning inherit automatically.
 */
@Component({
  selector: 'ce-entry-state-badge',
  standalone: true,
  imports: [CeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ce-entry-state-badge" [attr.data-tone]="meta().tone" [attr.aria-label]="meta().label">
      <ce-icon [name]="meta().icon" [size]="14" />
      <span class="label">{{ meta().label }}</span>
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }
      .ce-entry-state-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1, 4px);
        padding: var(--space-1, 4px) var(--space-3, 12px);
        border-radius: var(--radius-full, 999px);
        font-size: var(--font-size-xs, 13px);
        font-weight: var(--font-weight-medium, 500);
        line-height: 1.2;
        white-space: nowrap;
      }
      .ce-entry-state-badge[data-tone='success'] {
        background: var(--color-success-light);
        color: var(--color-success);
      }
      .ce-entry-state-badge[data-tone='warning'] {
        background: var(--color-warning-light);
        color: var(--color-warning);
      }
      .ce-entry-state-badge[data-tone='danger'] {
        background: var(--color-danger-light);
        color: var(--color-danger);
      }
      .ce-entry-state-badge[data-tone='neutral'] {
        background: var(--color-neutral-light);
        color: var(--color-text-secondary);
      }
      .label {
        line-height: 1;
      }
    `,
  ],
})
export class CeEntryStateBadgeComponent {
  state = input.required<EntryState>();

  meta = computed<EntryStateMeta>(() => STATE_META[this.state()]);
}
