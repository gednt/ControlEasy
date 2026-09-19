import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GatewayControlService } from './gateway-control.service';
import { LookupResponse, ManualLookupResult, ManualLookupType, ScanResult, SubjectKind } from './access-control.types';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { AccessScanResultComponent } from './components/access-scan-result.component';
import { ToastService } from '../../design-system/components/toast/toast.component';

type UiMode = 'search' | 'confirm' | 'recorded';

interface UiState {
  mode: UiMode;
  activeCriterion: ManualLookupType;
  cpf: string;
  identityDocument: string;
  name: string;
  apartmentBlock: string;
  apartmentUnit: string;
  block: string;
  busy: boolean;
  error: string | null;
  lookupAuditId: string | null;
  results: ManualLookupResult[];
  narrowHint: string | null;
  selected: ManualLookupResult | null;
  direction: 'entrance' | 'exit';
  recorded: {
    decision: ScanResult['decision'];
    accessEventId: string;
    subjectType: SubjectKind;
    direction: 'entrance' | 'exit';
    destinationBlock: string;
    destinationUnit: string;
  } | null;
}

const MIN_NAME = 3;
const MIN_APARTMENT = 1;
const MIN_BLOCK = 1;

const initialState = (): UiState => ({
  mode: 'search',
  activeCriterion: 'cpf',
  cpf: '',
  identityDocument: '',
  name: '',
  apartmentBlock: '',
  apartmentUnit: '',
  block: '',
  busy: false,
  error: null,
  lookupAuditId: null,
  results: [],
  narrowHint: null,
  selected: null,
  direction: 'entrance',
  recorded: null,
});

@Component({
  selector: 'ce-manual-lookup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AccessScanResultComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Manual lookup</h1>
        <p class="page-subtitle">
          Use when the resident or driver has no QR code. Search by CPF, identity document, name, apartment, or block.
          Documents are masked.
        </p>
      </div>
    </div>

    @if (state().mode === 'search') {
      <section class="lookup-card" aria-label="Manual lookup form">
        <div class="criterion-tabs" role="tablist" aria-label="Search criterion">
          @for (tab of criterionTabs; track tab.id) {
            <button
              type="button"
              role="tab"
              class="criterion-tab"
              [class.active]="state().activeCriterion === tab.id"
              [class.busy]="state().busy"
              [disabled]="state().busy"
              [attr.aria-selected]="state().activeCriterion === tab.id"
              [attr.tabindex]="state().activeCriterion === tab.id ? 0 : -1"
              (click)="onCriterionChange(tab.id)"
              (keydown)="onCriterionKeydown($event, tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="criterion-panel" role="tabpanel">
          @switch (state().activeCriterion) {
            @case ('cpf') {
              <label class="field" for="manual-cpf">
                <span class="field-label">CPF</span>
                <span class="field-hint">11 digits, numbers only.</span>
                <input
                  id="manual-cpf"
                  type="text"
                  inputmode="numeric"
                  class="ce-input"
                  [ngModel]="state().cpf"
                  (ngModelChange)="onCpfChange($event)"
                  autocomplete="off"
                />
              </label>
            }
            @case ('identity_document') {
              <label class="field" for="manual-doc">
                <span class="field-label">Identity document</span>
                <span class="field-hint">RG or other full document number.</span>
                <input
                  id="manual-doc"
                  type="text"
                  class="ce-input"
                  [ngModel]="state().identityDocument"
                  (ngModelChange)="onIdentityDocumentChange($event)"
                  autocomplete="off"
                />
              </label>
            }
            @case ('name') {
              <label class="field" for="manual-name">
                <span class="field-label">Resident name</span>
                <span class="field-hint">At least 3 characters.</span>
                <input
                  id="manual-name"
                  type="text"
                  class="ce-input"
                  [ngModel]="state().name"
                  (ngModelChange)="onNameChange($event)"
                  autocomplete="off"
                />
              </label>
            }
            @case ('apartment') {
              <div class="field-row">
                <label class="field" for="manual-apt-block">
                  <span class="field-label">Block</span>
                  <input
                    id="manual-apt-block"
                    type="text"
                    class="ce-input"
                    [ngModel]="state().apartmentBlock"
                    (ngModelChange)="onApartmentBlockChange($event)"
                    autocomplete="off"
                  />
                </label>
                <label class="field" for="manual-apt-unit">
                  <span class="field-label">Unit</span>
                  <input
                    id="manual-apt-unit"
                    type="text"
                    class="ce-input"
                    [ngModel]="state().apartmentUnit"
                    (ngModelChange)="onApartmentUnitChange($event)"
                    autocomplete="off"
                  />
                </label>
              </div>
            }
            @case ('block') {
              <label class="field" for="manual-block">
                <span class="field-label">Block</span>
                <span class="field-hint">Building or tower identifier.</span>
                <input
                  id="manual-block"
                  type="text"
                  class="ce-input"
                  [ngModel]="state().block"
                  (ngModelChange)="onBlockChange($event)"
                  autocomplete="off"
                />
              </label>
            }
          }
        </div>

        <div class="field" style="margin-top: var(--space-3)">
          <span class="field-label">Direction</span>
          <div class="direction-row" role="radiogroup" aria-label="Direction">
            <button
              type="button"
              role="radio"
              class="direction-chip"
              [class.active]="state().direction === 'entrance'"
              [attr.aria-checked]="state().direction === 'entrance'"
              (click)="onDirectionChange('entrance')"
            >
              Entrance
            </button>
            <button
              type="button"
              role="radio"
              class="direction-chip"
              [class.active]="state().direction === 'exit'"
              [attr.aria-checked]="state().direction === 'exit'"
              (click)="onDirectionChange('exit')"
            >
              Exit
            </button>
          </div>
        </div>

        @if (state().error) {
          <p class="lookup-message error" role="alert">{{ state().error }}</p>
        }

        <div class="actions">
          <button
            type="button"
            class="ce-button variant-primary size-md"
            [disabled]="state().busy || !canSearch()"
            (click)="search()"
          >
            {{ state().busy ? 'Searching...' : 'Search' }}
          </button>
        </div>
      </section>
    }

    @if (state().mode === 'search' && state().results.length > 0) {
      <section class="results" aria-label="Lookup results">
        <h2>Matches</h2>
        <p class="hint">Tap a resident, visitor, or vehicle to confirm.</p>
        @if (state().narrowHint) {
          <p class="hint" data-testid="narrow-hint">{{ state().narrowHint }}</p>
        }
        <ul class="result-list" role="listbox" aria-label="Manual lookup results">
          @for (result of state().results; track result.subjectId) {
            <li>
              <button
                type="button"
                class="result-item"
                role="option"
                [attr.aria-selected]="state().selected?.subjectId === result.subjectId"
                (click)="select(result)"
              >
                <strong>{{ result.displayName }}</strong>
                <span class="result-meta">
                  @if (result.documentMasked) {
                    <span>{{ result.documentMasked }}</span>
                  }
                  @if (result.apartmentBlock && result.apartmentUnit) {
                    <span> · {{ result.apartmentBlock }}/{{ result.apartmentUnit }}</span>
                  }
                  <span class="subject-type">{{ subjectTypeLabel(result.subjectType) }}</span>
                </span>
              </button>
            </li>
          }
        </ul>
        @if (state().results.length === 1) {
          <p class="hint">Only one match returned. Confirm to record the access event.</p>
        }
      </section>
    }

    @if (state().mode === 'confirm' && state().selected) {
      <section class="confirm" aria-label="Confirm manual access event">
        <h2>Confirm access event</h2>
        <div class="confirm-card">
          <p>
            <strong>{{ state().selected!.displayName }}</strong>
            ({{ subjectTypeLabel(state().selected!.subjectType) }})
            @if (state().selected!.apartmentBlock && state().selected!.apartmentUnit) {
              heading to {{ state().selected!.apartmentBlock }}/{{ state().selected!.apartmentUnit }}
            }
            on <strong>{{ state().direction === 'entrance' ? 'entrance' : 'exit' }}</strong
            >.
          </p>
          @if (state().error) {
            <p class="lookup-message error" role="alert">{{ state().error }}</p>
          }
          <div class="actions">
            <button
              type="button"
              class="ce-button variant-ghost size-md"
              [disabled]="state().busy"
              (click)="backToSearch()"
            >
              Back
            </button>
            <button
              type="button"
              class="ce-button variant-primary size-md"
              [disabled]="state().busy"
              (click)="confirm()"
            >
              {{ state().busy ? 'Recording...' : 'Confirm and record' }}
            </button>
          </div>
        </div>
      </section>
    }

    @if (state().mode === 'recorded' && state().recorded) {
      <section class="recorded" aria-label="Recorded manual access event">
        <ce-access-scan-result
          [decision]="state().recorded!.decision"
          [subjectType]="state().recorded!.subjectType"
          [direction]="state().recorded!.direction"
          [destinationBlock]="state().recorded!.destinationBlock"
          [destinationUnit]="state().recorded!.destinationUnit"
        />
        <div class="actions">
          <button type="button" class="ce-button variant-primary size-md" (click)="reset()">Record another</button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .lookup-card,
      .results,
      .confirm,
      .recorded {
        background: var(--color-surface, #fff);
        border-radius: var(--radius-md, 8px);
        padding: var(--space-4, 16px);
        margin-top: var(--space-4, 16px);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
        margin-top: var(--space-3, 12px);
      }
      .field-label {
        font-weight: var(--font-weight-semibold, 600);
        font-size: 0.85rem;
      }
      .field-hint {
        color: var(--color-text-secondary, #555);
        font-size: 0.75rem;
      }
      .ce-input {
        padding: var(--space-2, 8px);
        border-radius: var(--radius-sm, 4px);
        border: 1px solid var(--color-border, #ccc);
      }
      .field-row {
        display: flex;
        gap: var(--space-3, 12px);
      }
      .field-row .field {
        flex: 1;
      }
      .criterion-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--color-border, #ccc);
      }
      .criterion-tab {
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 0;
        background: transparent;
        color: var(--color-text-secondary, #555);
        font-size: var(--font-size-sm, 0.875rem);
        font-weight: var(--font-weight-medium, 500);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        font-family: inherit;
      }
      .criterion-tab.active {
        color: var(--color-primary, #2c5cdc);
        border-bottom-color: var(--color-primary, #2c5cdc);
      }
      .criterion-tab:disabled {
        opacity: 0.55;
        cursor: wait;
      }
      .direction-row {
        display: flex;
        gap: var(--space-2, 8px);
        margin-top: var(--space-1, 4px);
      }
      .direction-chip {
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 1px solid var(--color-border, #ccc);
        background: transparent;
        border-radius: var(--radius-sm, 4px);
        cursor: pointer;
        font-family: inherit;
      }
      .direction-chip.active {
        background: var(--color-primary, #2c5cdc);
        color: var(--color-text-on-primary, #fff);
        border-color: var(--color-primary, #2c5cdc);
      }
      .actions {
        display: flex;
        gap: var(--space-2, 8px);
        margin-top: var(--space-4, 16px);
      }
      .lookup-message {
        margin-top: var(--space-2, 8px);
        font-size: 0.85rem;
      }
      .lookup-message.error {
        color: var(--color-danger, #b42318);
      }
      .hint {
        color: var(--color-text-secondary, #555);
        font-size: 0.85rem;
      }
      .result-list {
        list-style: none;
        padding: 0;
        margin: var(--space-3, 12px) 0 0;
      }
      .result-item {
        width: 100%;
        text-align: left;
        background: transparent;
        border: 1px solid var(--color-border, #ccc);
        border-radius: var(--radius-sm, 4px);
        padding: var(--space-3, 12px);
        margin-bottom: var(--space-2, 8px);
        cursor: pointer;
        font-family: inherit;
      }
      .result-item[aria-selected='true'] {
        border-color: var(--color-primary, #2c5cdc);
        background: rgba(44, 92, 220, 0.08);
      }
      .result-meta {
        display: flex;
        gap: var(--space-2, 8px);
        font-size: 0.8rem;
        color: var(--color-text-secondary, #555);
        margin-top: var(--space-1, 4px);
      }
      .subject-type {
        font-style: italic;
      }
      .confirm-card {
        background: rgba(44, 92, 220, 0.05);
        border-radius: var(--radius-sm, 4px);
        padding: var(--space-3, 12px);
      }
    `,
  ],
})
export class ManualLookupPage implements OnDestroy {
  private readonly gateway = inject(GatewayControlService);
  private readonly toast = inject(ToastService);
  private destroyed = false;

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  readonly criterionTabs: ReadonlyArray<{ id: ManualLookupType; label: string }> = [
    { id: 'cpf', label: 'CPF' },
    { id: 'identity_document', label: 'Document' },
    { id: 'name', label: 'Name' },
    { id: 'apartment', label: 'Apartment' },
    { id: 'block', label: 'Block' },
  ];

  readonly state = signal<UiState>(initialState());

  readonly canSearch = computed(() => this.hasSpecificValue(this.state().activeCriterion));

  onCriterionChange(criterion: ManualLookupType): void {
    if (this.state().busy) return;
    this.state.update((s) => ({
      ...s,
      activeCriterion: criterion,
      error: null,
      results: [],
      lookupId: null,
      narrowHint: null,
      selected: null,
      mode: 'search',
    }));
  }

  onCriterionKeydown(event: KeyboardEvent, criterion: ManualLookupType): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const idx = this.criterionTabs.findIndex((t) => t.id === criterion);
      const next = this.criterionTabs[(idx + 1) % this.criterionTabs.length];
      if (next) {
        this.onCriterionChange(next.id);
      }
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const idx = this.criterionTabs.findIndex((t) => t.id === criterion);
      const prev = this.criterionTabs[(idx - 1 + this.criterionTabs.length) % this.criterionTabs.length];
      if (prev) {
        this.onCriterionChange(prev.id);
      }
    }
  }

  onCpfChange(value: string): void {
    this.state.update((s) => ({ ...s, cpf: value, error: null }));
  }

  onIdentityDocumentChange(value: string): void {
    this.state.update((s) => ({ ...s, identityDocument: value, error: null }));
  }

  onNameChange(value: string): void {
    this.state.update((s) => ({ ...s, name: value, error: null }));
  }

  onApartmentBlockChange(value: string): void {
    this.state.update((s) => ({ ...s, apartmentBlock: value, error: null }));
  }

  onApartmentUnitChange(value: string): void {
    this.state.update((s) => ({ ...s, apartmentUnit: value, error: null }));
  }

  onBlockChange(value: string): void {
    this.state.update((s) => ({ ...s, block: value, error: null }));
  }

  onDirectionChange(direction: 'entrance' | 'exit'): void {
    this.state.update((s) => ({ ...s, direction }));
  }

  subjectTypeLabel(type: SubjectKind): string {
    switch (type) {
      case 'resident':
        return 'Resident';
      case 'vehicle':
        return 'Vehicle';
      case 'visitor':
        return 'Visitor';
      default:
        return type;
    }
  }

  select(result: ManualLookupResult): void {
    this.state.update((s) => ({ ...s, selected: result, mode: 'confirm', error: null }));
  }

  backToSearch(): void {
    this.state.update((s) => ({ ...s, mode: 'search', selected: null, error: null }));
  }

  reset(): void {
    this.state.set(initialState());
  }

  search(): void {
    const current = this.state();
    if (current.busy) return;
    const criterion = this.buildCriterion(current);
    if (!criterion) {
      this.state.update((s) => ({ ...s, error: 'Provide a value that is specific enough.' }));
      return;
    }
    this.state.update((s) => ({ ...s, busy: true, error: null, results: [], lookupAuditId: null }));

    this.gateway.searchSubject(criterion).subscribe({
      next: (response: LookupResponse) => {
        if (this.destroyed) return;
        this.state.update((s) => ({
          ...s,
          busy: false,
          lookupAuditId: response.lookupAuditId,
          results: response.items,
          narrowHint: null,
        }));
        if (response.items.length === 0) {
          this.state.update((s) => ({
            ...s,
            error: 'No matches found. Try a different criterion.',
          }));
        }
      },
      error: (err) => {
        if (this.destroyed) return;
        this.state.update((s) => ({
          ...s,
          busy: false,
          error: getApiErrorMessage(err, 'Search failed.'),
        }));
      },
    });
  }

  confirm(): void {
    const current = this.state();
    if (current.busy || !current.selected || !current.lookupAuditId) return;
    this.state.update((s) => ({ ...s, busy: true, error: null }));

    this.gateway
      .recordManual({
        lookupAuditId: current.lookupAuditId,
        subjectType: current.selected.subjectType,
        subjectId: current.selected.subjectId,
        direction: current.direction,
      })
      .subscribe({
        next: (response) => {
          if (this.destroyed) return;
          this.toast.info('Manual access recorded.');
          this.state.update((s) => ({
            ...s,
            busy: false,
            mode: 'recorded',
            recorded: {
              decision: response.decision ?? 'recorded',
              accessEventId: response.accessEventId,
              subjectType: response.subjectType,
              direction: response.direction,
              destinationBlock: response.destinationBlock,
              destinationUnit: response.destinationUnit,
            },
          }));
        },
        error: (err) => {
          if (this.destroyed) return;
          this.state.update((s) => ({
            ...s,
            busy: false,
            error: getApiErrorMessage(err, 'Could not record the event.'),
          }));
        },
      });
  }

  private hasSpecificValue(criterion: ManualLookupType): boolean {
    const s = this.state();
    switch (criterion) {
      case 'cpf':
        return s.cpf.replace(/\D/g, '').length === 11;
      case 'identity_document':
        return s.identityDocument.trim().length >= 4;
      case 'name':
        return s.name.trim().length >= MIN_NAME;
      case 'apartment':
        return s.apartmentBlock.trim().length >= MIN_APARTMENT && s.apartmentUnit.trim().length >= MIN_APARTMENT;
      case 'block':
        return s.block.trim().length >= MIN_BLOCK;
    }
  }

  private buildCriterion(s: UiState): { type: ManualLookupType; value: string; unit: string | null } | null {
    switch (s.activeCriterion) {
      case 'cpf': {
        const digits = s.cpf.replace(/\D/g, '');
        if (digits.length !== 11) return null;
        return { type: 'cpf', value: digits, unit: null };
      }
      case 'identity_document': {
        const trimmed = s.identityDocument.trim();
        if (trimmed.length < 4) return null;
        return { type: 'identity_document', value: trimmed, unit: null };
      }
      case 'name': {
        const trimmed = s.name.trim();
        if (trimmed.length < MIN_NAME) return null;
        return { type: 'name', value: trimmed, unit: null };
      }
      case 'apartment': {
        const block = s.apartmentBlock.trim();
        const unit = s.apartmentUnit.trim();
        if (block.length < MIN_APARTMENT || unit.length < MIN_APARTMENT) return null;
        return { type: 'apartment', value: block, unit };
      }
      case 'block': {
        const trimmed = s.block.trim();
        if (trimmed.length < MIN_BLOCK) return null;
        return { type: 'block', value: trimmed, unit: null };
      }
    }
  }
}
