import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CeButtonComponent } from '../button/button.component';
import { type AuditFilters, type EntryState, type SubjectType } from '../../../features/entry-log/entry-log.service';

interface DropdownOption {
  value: string;
  label: string;
}

export interface PorteiroOption {
  profileId: string;
  displayName: string;
}

const CATEGORY_OPTIONS: DropdownOption[] = [
  { value: '', label: 'All categories' },
  { value: 'dweller', label: 'Dwellers' },
  { value: 'visitor', label: 'Visitors' },
  { value: 'service_provider', label: 'Service providers' },
  { value: 'vehicle', label: 'Vehicles' },
];

const STATE_OPTIONS: DropdownOption[] = [
  { value: '', label: 'All states' },
  { value: 'entered_with_consent', label: 'With consent' },
  { value: 'entered_override', label: 'Override' },
  { value: 'gatehouse_only', label: 'No entry' },
  { value: 'entered_without_consent', label: 'Refused' },
  { value: 'exited', label: 'Exit' },
];

/**
 * Filter chip row for the audit review page. Two date inputs and two
 * dropdowns (category, entry-state), plus a reset button. Emits a fresh
 * AuditFilters object on every change — the consumer swaps the page state
 * and re-fetches.
 *
 * Inputs are uncontrolled visually (native inputs/dropdowns); the consumer
 * owns the source-of-truth signal.
 */
@Component({
  selector: 'ce-audit-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, CeButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters" role="group" aria-label="Audit filters">
      <label class="field">
        <span class="field-label">From</span>
        <input type="date" class="ce-input" [value]="fromDate()" (change)="onFromDateChange($event)" />
      </label>
      <label class="field">
        <span class="field-label">To</span>
        <input type="date" class="ce-input" [value]="toDate()" (change)="onToDateChange($event)" />
      </label>
      <label class="field">
        <span class="field-label">Category</span>
        <select class="ce-input" [value]="category() || ''" (change)="onCategoryChange($event)">
          @for (opt of categoryOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </label>
      <label class="field">
        <span class="field-label">Entry state</span>
        <select class="ce-input" [value]="state() || ''" (change)="onStateChange($event)">
          @for (opt of stateOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </label>
      <label class="field">
        <span class="field-label">Porteiro</span>
        <select class="ce-input" [value]="porteiro() || ''" (change)="onPorteiroChange($event)">
          <option value="">All porteiros</option>
          @for (opt of porteirosList(); track opt.profileId) {
            <option [value]="opt.profileId">{{ opt.displayName }}</option>
          }
        </select>
      </label>
      <div class="reset-wrap">
        <ce-button variant="ghost" size="sm" (click)="reset()"> Reset filters </ce-button>
      </div>
    </div>
  `,
  styles: [
    `
      .filters {
        display: flex;
        gap: var(--space-3, 12px);
        padding: var(--space-3, 12px);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg, 8px);
        align-items: flex-end;
        flex-wrap: wrap;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
        min-width: 9rem;
        flex: 0 1 auto;
      }
      .field-label {
        font-size: var(--font-size-xs, 12px);
        font-weight: var(--font-weight-medium, 500);
        color: var(--color-text-secondary);
      }
      .ce-input {
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md, 6px);
        font-family: inherit;
        font-size: var(--font-size-sm, 14px);
        background: var(--color-surface-elevated);
        color: var(--color-text-primary);
        min-height: 2.25rem;
      }
      .ce-input:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 1px;
        border-color: var(--color-primary);
      }
      .reset-wrap {
        margin-left: auto;
      }
    `,
  ],
})
export class CeAuditFiltersComponent {
  filters = input.required<AuditFilters>();
  porteiros = input<PorteiroOption[]>([]);
  filtersChanged = output<AuditFilters>();

  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly stateOptions = STATE_OPTIONS;
  readonly porteirosList = computed(() => this.porteiros());

  fromDate = computed(() => this.filters().fromUtc?.split('T')[0] ?? '');
  toDate = computed(() => this.filters().toUtc?.split('T')[0] ?? '');
  category = computed(() => this.filters().subjectType);
  state = computed(() => this.filters().entryState);
  porteiro = computed(() => this.filters().porteiro);

  emit(partial: Partial<AuditFilters>): void {
    this.filtersChanged.emit({ ...this.filters(), ...partial });
  }

  onFromDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.emit({
      fromUtc: value ? new Date(value).toISOString() : undefined,
      skip: 0,
    });
  }

  onToDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.emit({
      toUtc: value ? new Date(value).toISOString() : undefined,
      skip: 0,
    });
  }

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.emit({
      subjectType: (value || undefined) as SubjectType | undefined,
      skip: 0,
    });
  }

  onStateChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.emit({
      entryState: (value || undefined) as EntryState | undefined,
      skip: 0,
    });
  }

  onPorteiroChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.emit({
      porteiro: value || undefined,
      skip: 0,
    });
  }

  reset(): void {
    this.filtersChanged.emit({ skip: 0, take: this.filters().take });
  }
}
