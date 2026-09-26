import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { CeEntryStateBadgeComponent } from '../entry-state-badge/entry-state-badge.component';
import { CePhotoComponent } from '../photo/photo.component';
import type { EntryLogResponse } from '../../../features/entry-log/entry-log.service';

/**
 * Single row in the audit table. Override rows get a 4px red left border so
 * reviewers can spot overrides at a glance. Photo cells render the Phase 12
 * thumbnail (ce-photo) — when no photo is attached the cell shows a quiet
 * em-dash.
 */
@Component({
  selector: 'ce-audit-row',
  standalone: true,
  imports: [DatePipe, CeEntryStateBadgeComponent, CePhotoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tr [class.override-row]="entry().entryState === 'entered_override'">
      <td class="cell-time">
        {{ entry().recordedAt | date:'yyyy-MM-dd HH:mm:ss.SSS' }}
      </td>
      <td>
        <ce-entry-state-badge [state]="entry().entryState" />
      </td>
      <td class="cell-subject">{{ subjectTypeLabel() }}</td>
      <td>{{ entry().subjectName || '—' }}</td>
      <td class="cell-photo">
        @if (entry().photoId) {
          <ce-photo
            [photoId]="entry().photoId!"
            [pixelSize]="64"
            (photoClicked)="photoClicked.emit(entry().id)"
          />
        } @else {
          <span class="no-photo">—</span>
        }
      </td>
      <td>{{ entry().overrideReason || '—' }}</td>
      <td class="cell-porteiro">{{ porteiroName() || '—' }}</td>
    </tr>
  `,
  styles: [
    `
      :host { display: contents; }
      tr td {
        padding: var(--space-3, 12px) var(--space-2, 8px);
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-primary, #111827);
        vertical-align: middle;
      }
      tr.override-row td:first-child {
        border-left: 4px solid var(--color-danger, #991b1b);
        padding-left: calc(var(--space-2, 8px) - 4px);
      }
      .cell-time {
        font-family: var(--font-family-mono, monospace);
        white-space: nowrap;
        color: var(--color-text-secondary, #4b5563);
      }
      .cell-subject {
        text-transform: capitalize;
        color: var(--color-text-secondary, #4b5563);
      }
      .cell-photo { width: 64px; }
      .no-photo {
        color: var(--color-text-muted, #9ca3af);
        opacity: 0.6;
      }
      .cell-porteiro {
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary, #4b5563);
        word-break: break-word;
      }
    `,
  ],
})
export class CeAuditRowComponent {
  entry = input.required<EntryLogResponse>();
  porteiroName = input<string | undefined>(undefined);
  photoClicked = output<string>();

  subjectTypeLabel = computed(() => {
    const t = this.entry().subjectType;
    if (t === 'service_provider') return 'Service provider';
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
}