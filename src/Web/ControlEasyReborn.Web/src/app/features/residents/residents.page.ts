import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal, viewChildren } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CeAvatarComponent,
  CeBadgeComponent,
  CeButtonComponent,
  CeCardComponent,
  CeDropdownComponent,
  CeEmptyStateComponent,
  CeIconComponent,
  CeInputComponent,
  CeModalComponent,
  CePaginationComponent,
  CePhotoPanelComponent,
  CePhotoThumbComponent,
  CeSpinnerComponent,
  CeStatTileComponent,
  CeTableComponent,
} from '../../design-system';
import { ResidentsApiService, ResidentResponse } from './residents-api.service';
import { ApartmentPickerComponent } from '../../shared/apartment-picker/apartment-picker.component';
import { ApartmentsApiService, formatApartmentLabel } from '../apartments/apartments-api.service';
import { DashboardApiService, RecentVisit } from '../dashboard/dashboard-api.service';
import { cpfValidator } from '../../core/validators/cpf.validator';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { AuthService } from '../../core/services/auth.service';

type StatusTab = 'all' | 'active' | 'pending' | 'overdue';
type SortKey = 'nameAsc' | 'newest';

@Component({
  selector: 'ce-residents-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    ApartmentPickerComponent,
    CeAvatarComponent,
    CeBadgeComponent,
    CeButtonComponent,
    CeCardComponent,
    CeDropdownComponent,
    CeEmptyStateComponent,
    CeIconComponent,
    CeInputComponent,
    CeModalComponent,
    CePaginationComponent,
    CePhotoPanelComponent,
    CePhotoThumbComponent,
    CeSpinnerComponent,
    CeStatTileComponent,
    CeTableComponent,
  ],
  template: `
    <div class="page-header">
      <div class="page-title-block">
        <p class="eyebrow">Directory / verified records</p>
        <h1 class="page-title">Resident register</h1>
        <p class="page-subtitle">{{ activeCount() }} active residents across the condominium record.</p>
      </div>
      <div class="page-header-actions">
        <ce-button variant="secondary" size="md" (click)="refresh()">
          <ce-icon name="refresh" [size]="16" /> Refresh
        </ce-button>
        @if (canWrite()) {
          <ce-button variant="primary" size="md" (click)="openCreateModal()">
            <ce-icon name="plus" [size]="16" /> Add resident
          </ce-button>
        }
      </div>
    </div>

    <div class="stat-grid">
      <ce-stat-tile label="Active Residents" [value]="activeCount()" />
      <ce-stat-tile label="Total Residents" [value]="totalResidents()" />
      <ce-stat-tile label="Apartments Covered" [value]="apartmentsCovered()" />
      <ce-stat-tile label="Inactive Residents" [value]="inactiveCount()" />
    </div>

    @if (loading()) {
      <div class="loading-state">
        <ce-spinner tone="primary" size="lg" />
        <p>Loading residents...</p>
      </div>
    } @else if (residents().length === 0 && !searchTerm() && !selectedBlockId() && statusTab() === 'all') {
      <ce-empty-state
        icon="&#128101;"
        title="No residents yet"
        description="Add your first resident to get started."
        [actionLabel]="canWrite() ? '+ Add resident' : ''"
        (action)="openCreateModal()"
      />
    } @else {
      <ce-card [padded]="false">
        <div class="status-tabs" role="group" aria-label="Resident filters">
          @for (tab of statusTabs(); track tab.key) {
            <button
              class="status-tab"
              type="button"
              [class.active]="statusTab() === tab.key"
              [attr.aria-pressed]="statusTab() === tab.key"
              (click)="onTabSelect(tab.key)"
            >
              {{ tab.label }} ({{ tab.count }})
            </button>
          }
        </div>
        <div class="filter-toolbar">
          <ce-input
            class="toolbar-search"
            inputId="resident-search"
            type="search"
            placeholder="Search by name, apartment, or CPF..."
            (input)="onSearch($event)"
          />
          @if (searchTerm()) {
            <span class="result-count">{{ filteredTotal() }} result{{ filteredTotal() !== 1 ? 's' : '' }}</span>
          }
          <ce-dropdown>
            <button class="filter-trigger" ceDropdownTrigger type="button">
              {{ blockTriggerLabel() }} <ce-icon name="chevron-down" [size]="14" />
            </button>
            <button role="menuitem" type="button" (click)="onBlockSelect(null)">All blocks</button>
            @for (option of blockOptions(); track option.id) {
              <button role="menuitem" type="button" (click)="onBlockSelect(option.id)">{{ option.label }}</button>
            }
          </ce-dropdown>
          <ce-dropdown>
            <button class="filter-trigger" ceDropdownTrigger type="button">
              {{ sortTriggerLabel() }} <ce-icon name="chevron-down" [size]="14" />
            </button>
            <button role="menuitem" type="button" (click)="onSortSelect('nameAsc')">Name (A&#8211;Z)</button>
            <button role="menuitem" type="button" (click)="onSortSelect('newest')">Newest first</button>
          </ce-dropdown>
        </div>
        <ce-table>
          <thead>
            <tr>
              <th scope="col">Photo</th>
              <th scope="col">Resident</th>
              <th scope="col">Apartment</th>
              <th scope="col">CPF</th>
              <th scope="col">Phone</th>
              <th scope="col">Status</th>
              <th scope="col" class="actions-column"></th>
            </tr>
          </thead>
          <tbody>
            @for (resident of paginatedResidents(); track resident.id) {
              <tr>
                <td><ce-photo-thumb entityType="resident" [entityId]="resident.id" /></td>
                <td>
                  <div class="resident-name-cell">
                    <ce-avatar [name]="resident.name" size="sm" />
                    <div>
                      <div class="font-semibold">{{ resident.name }}</div>
                      @if (resident.email) {
                        <div class="text-xs text-secondary">{{ resident.email }}</div>
                      }
                    </div>
                  </div>
                </td>
                <td>{{ getApartmentLabel(resident.apartmentId) }}</td>
                <td>{{ resident.cpf }}</td>
                <td>{{ resident.phone ?? '—' }}</td>
                <td>
                  <ce-badge
                    [content]="resident.active ? 'Active' : 'Inactive'"
                    [tone]="resident.active ? 'success' : 'neutral'"
                    size="sm"
                  />
                </td>
                <td class="resident-actions">
                  <ce-dropdown align="end">
                    <button
                      class="action-menu-btn"
                      ceDropdownTrigger
                      type="button"
                      aria-label="Resident actions"
                      aria-haspopup="menu"
                    >
                      <ce-icon name="more-horizontal" [size]="16" />
                    </button>
                    <button role="menuitem" type="button" (click)="openViewModal(resident)">View photos</button>
                    @if (canWrite()) {
                      <button role="menuitem" type="button" (click)="openEditModal(resident)">Edit</button>
                      @if (resident.active) {
                        <button
                          role="menuitem"
                          type="button"
                          style="color: var(--color-danger);"
                          (click)="onDeactivate(resident)"
                        >
                          Deactivate
                        </button>
                      }
                    }
                  </ce-dropdown>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <ce-empty-state
                    icon="&#128269;"
                    title="No residents match your filters"
                    description="Try clearing the search or selecting a different filter."
                  />
                </td>
              </tr>
            }
          </tbody>
        </ce-table>
        <div class="table-footer">
          <ce-pagination
            [page]="clampedPage()"
            [pageSize]="pageSize()"
            [total]="filteredTotal()"
            [pageSizeOptions]="pageSizeOptions"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      </ce-card>
    }

    <ce-card>
      <div card-header>Recent activity</div>
      @if (recentVisits().length === 0) {
        <ce-empty-state
          icon="&#128197;"
          title="No recent activity"
          description="Recent visits will appear here as they are registered."
        />
      } @else {
        <ul class="activity-list">
          @for (visit of recentVisits(); track visit.id) {
            <li class="activity-item">
              <ce-avatar [name]="visit.visitorName" size="sm" />
              <div class="activity-body">
                <div class="activity-title">{{ visit.visitorName }}</div>
                <div class="text-xs text-secondary">
                  {{ visit.apartmentLabel ?? '—' }} &#183; {{ visit.createdAtUtc | date: 'short' }}
                </div>
              </div>
              <ce-badge [content]="visitStatusLabel(visit.status)" [tone]="visitStatusTone(visit.status)" size="sm" />
            </li>
          }
        </ul>
      }
    </ce-card>

    <ce-modal
      [open]="createModalOpen()"
      [title]="
        createModalStep() === 'photos'
          ? 'Add photos for ' + (createdResident()?.name ?? 'resident')
          : 'Add new resident'
      "
      [size]="createModalStep() === 'photos' ? 'lg' : 'md'"
      (openChange)="onCreateModalOpenChange($event)"
    >
      @if (createModalStep() === 'form') {
        @if (createError()) {
          <div class="form-error-banner">{{ createError() }}</div>
        }
        <form class="resident-form" [formGroup]="createForm" (ngSubmit)="onCreateResident()">
          <ce-input
            label="Full name"
            inputId="ar-name"
            placeholder="e.g. Maria Silva"
            formControlName="name"
            [error]="fieldError(createForm, 'name', 'Name is required')"
          />
          <ce-input
            label="CPF"
            inputId="ar-cpf"
            placeholder="000.000.000-00"
            formControlName="cpf"
            [error]="cpfError(createForm, 'cpf')"
          />
          <ce-apartment-picker
            formControlName="apartmentId"
            label="Apartment"
            inputId="ar-apartment"
            placeholder="Select block and unit..."
            [hasError]="fieldError(createForm, 'apartmentId', 'Apartment is required') !== null"
          />
          @if (fieldError(createForm, 'apartmentId', 'Apartment is required') !== null) {
            <div class="field-error">Apartment is required</div>
          }
          <ce-input label="Phone" inputId="ar-phone" placeholder="(11) 99999-0000" formControlName="phone" />
        </form>
      } @else {
        <ce-photo-panel
          entityType="resident"
          [entity]="createdResidentPhotoEntity()"
          [canAdd]="canWrite()"
          [canDelete]="canWrite()"
        />
      }
      <div ce-modal-footer>
        @if (createModalStep() === 'form') {
          <ce-button variant="ghost" size="sm" (click)="closeCreateModal()">Cancel</ce-button>
          <ce-button
            variant="primary"
            size="sm"
            [disabled]="createForm.invalid || creating()"
            [loading]="creating()"
            (click)="onCreateResident()"
          >
            Add resident
          </ce-button>
        } @else {
          <ce-button variant="primary" size="sm" (click)="closeCreateModal()">Done</ce-button>
        }
      </div>
    </ce-modal>

    <ce-modal
      [open]="editModalOpen()"
      [title]="editModalStep() === 'photos' ? 'Photos for ' + (editingResident()?.name ?? 'resident') : 'Edit resident'"
      [size]="editModalStep() === 'photos' ? 'lg' : 'md'"
      (openChange)="onEditModalOpenChange($event)"
    >
      @if (editModalStep() === 'form') {
        @if (editError()) {
          <div class="form-error-banner">{{ editError() }}</div>
        }
        <form class="resident-form" [formGroup]="editForm" (ngSubmit)="onEditResident()">
          <ce-input
            label="Full name"
            inputId="er-name"
            placeholder="e.g. Maria Silva"
            formControlName="name"
            [error]="fieldError(editForm, 'name', 'Name is required')"
          />
          <ce-input
            label="CPF"
            inputId="er-cpf"
            placeholder="000.000.000-00"
            formControlName="cpf"
            [error]="cpfError(editForm, 'cpf')"
          />
          <ce-apartment-picker
            formControlName="apartmentId"
            label="Apartment"
            inputId="er-apartment"
            placeholder="Select block and unit..."
            [hasError]="fieldError(editForm, 'apartmentId', 'Apartment is required') !== null"
          />
          @if (fieldError(editForm, 'apartmentId', 'Apartment is required') !== null) {
            <div class="field-error">Apartment is required</div>
          }
          <ce-input label="Phone" inputId="er-phone" placeholder="(11) 99999-0000" formControlName="phone" />
        </form>
      } @else {
        <ce-photo-panel
          entityType="resident"
          [entity]="editingResidentPhotoEntity()"
          [canAdd]="canWrite()"
          [canDelete]="canWrite()"
        />
      }
      <div ce-modal-footer>
        @if (editModalStep() === 'form') {
          <ce-button variant="ghost" size="sm" (click)="closeEditModal()">Cancel</ce-button>
          <ce-button
            variant="primary"
            size="sm"
            [disabled]="editForm.invalid || saving()"
            [loading]="saving()"
            (click)="onEditResident()"
          >
            Save changes
          </ce-button>
        } @else {
          <ce-button variant="primary" size="sm" (click)="closeEditModal()">Done</ce-button>
        }
      </div>
    </ce-modal>

    <ce-modal
      [open]="confirmDeactivateOpen()"
      title="Deactivate resident"
      size="sm"
      (openChange)="onDeactivateModalOpenChange($event)"
    >
      <p class="text-secondary">
        Are you sure you want to deactivate <strong>{{ residentToDeactivate()?.name }}</strong
        >? They will no longer be able to access the condominium.
      </p>
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closeDeactivateConfirm()">Cancel</ce-button>
        <ce-button
          variant="danger"
          size="sm"
          [disabled]="deactivating()"
          [loading]="deactivating()"
          (click)="onConfirmDeactivate()"
        >
          Deactivate
        </ce-button>
      </div>
    </ce-modal>

    <ce-modal
      [open]="viewModalOpen()"
      [title]="residentBeingViewed() ? residentBeingViewed()!.name + ' — Photos' : 'Resident photos'"
      size="lg"
      (openChange)="onViewModalOpenChange($event)"
    >
      @if (viewModalOpen()) {
        <ce-photo-panel
          entityType="resident"
          [entity]="residentPhotoEntity()"
          [canAdd]="canWrite()"
          [canDelete]="canWrite()"
        />
      }
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closeViewModal()">Close</ce-button>
      </div>
    </ce-modal>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        margin-bottom: var(--space-6);
      }
      .page-title-block {
        min-width: 0;
      }
      .eyebrow {
        margin: 0 0 var(--space-2);
        color: var(--color-text-secondary);
        font: 700 var(--font-size-xs)/1 var(--font-family-mono);
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      .page-title {
        font-family: var(--font-family-display);
        font-size: clamp(2rem, 3vw, 3rem);
        font-weight: 500;
        letter-spacing: -0.04em;
        margin-bottom: var(--space-1);
      }
      .page-subtitle {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      .page-header-actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 1px;
        margin-bottom: var(--space-6);
        background: var(--color-border);
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-12);
        gap: var(--space-4);
        color: var(--color-text-secondary);
      }

      .status-tabs {
        display: flex;
        gap: 0;
        padding: 0 var(--space-6);
        border-bottom: 1px solid var(--color-border);
        overflow-x: auto;
      }
      .status-tab {
        padding: var(--space-3) var(--space-4);
        border: 0;
        background: transparent;
        color: var(--color-text-secondary);
        font: 700 var(--font-size-xs)/1 var(--font-family-mono);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        font-family: inherit;
        white-space: nowrap;
        transition:
          color var(--duration-fast) var(--ease-out),
          border-color var(--duration-fast) var(--ease-out);
      }
      .status-tab:hover {
        color: var(--color-text-primary);
      }
      .status-tab.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
      }

      .filter-toolbar {
        padding: var(--space-4) var(--space-6);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
        align-items: center;
      }
      .toolbar-search {
        flex: 1;
        max-width: 24rem;
      }
      .result-count {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        white-space: nowrap;
      }
      .filter-trigger {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        height: 2.5rem;
        padding: 0 var(--space-3);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 0;
        font-size: var(--font-size-sm);
        font-family: inherit;
        cursor: pointer;
        white-space: nowrap;
        transition: background var(--duration-fast) var(--ease-out);
      }
      .filter-trigger:hover {
        background: var(--color-surface-elevated);
      }

      .actions-column {
        width: 1%;
      }
      .resident-name-cell {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .resident-actions {
        width: 1%;
        white-space: nowrap;
      }
      .action-menu-btn {
        width: 2.75rem;
        height: 2.75rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0;
        cursor: pointer;
        color: var(--color-text-secondary);
        box-shadow: var(--shadow-sm);
        transition:
          background var(--duration-fast) var(--ease-out),
          color var(--duration-fast) var(--ease-out),
          border-color var(--duration-fast) var(--ease-out);
      }
      .action-menu-btn:hover,
      .action-menu-btn:focus-visible {
        background: var(--color-primary-light);
        border-color: var(--color-primary);
        color: var(--color-primary);
        outline: none;
      }
      @media (max-width: 640px) {
        .action-menu-btn {
          width: 3rem;
          height: 3rem;
        }
      }

      .table-footer {
        display: flex;
        justify-content: flex-end;
        padding: var(--space-4) var(--space-6);
        border-top: 1px solid var(--color-border);
      }

      .activity-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .activity-item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) 0;
        border-bottom: 1px solid var(--color-border);
      }
      .activity-item:last-child {
        border-bottom: 0;
      }
      .activity-body {
        flex: 1;
        min-width: 0;
      }

      .resident-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .field-error {
        font-size: var(--font-size-xs);
        color: var(--color-danger);
        font-weight: var(--font-weight-medium);
      }
      .form-error-banner {
        margin-bottom: var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-lg);
        background: var(--color-danger-light);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
      }

      .font-semibold {
        font-weight: var(--font-weight-semibold);
      }
      .text-xs {
        font-size: var(--font-size-xs);
      }
      .text-secondary {
        color: var(--color-text-secondary);
      }

      .view-photo-section {
        min-height: 96px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidentsPage implements OnDestroy {
  private readonly api = inject(ResidentsApiService);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly dropdowns = viewChildren(CeDropdownComponent);

  readonly canWrite = computed(() => this.auth.hasPermission('Residents.Write'));

  residents = signal<ResidentResponse[]>([]);
  apartmentLabels = signal<Record<string, string>>({});
  recentVisits = signal<RecentVisit[]>([]);
  loading = signal(true);
  creating = signal(false);
  saving = signal(false);
  deactivating = signal(false);
  createModalOpen = signal(false);
  editModalOpen = signal(false);
  confirmDeactivateOpen = signal(false);
  viewModalOpen = signal(false);
  createError = signal<string | null>(null);
  editError = signal<string | null>(null);
  searchTerm = signal('');
  residentToDeactivate = signal<ResidentResponse | null>(null);
  editingResident = signal<ResidentResponse | null>(null);
  residentBeingViewed = signal<ResidentResponse | null>(null);

  /** Two-step flow state: form → photos (after success). */
  createModalStep = signal<'form' | 'photos'>('form');
  editModalStep = signal<'form' | 'photos'>('form');
  createdResident = signal<ResidentResponse | null>(null);

  /** Wraps the resident under view in the shape expected by ce-photo-panel. */
  readonly residentPhotoEntity = computed(() => {
    const r = this.residentBeingViewed();
    return r ? { id: r.id, displayName: r.name } : null;
  });

  /** Photo entity for the freshly-created resident (post-create step). */
  readonly createdResidentPhotoEntity = computed(() => {
    const r = this.createdResident();
    return r ? { id: r.id, displayName: r.name } : null;
  });

  /** Photo entity for the resident being edited (post-edit step). */
  readonly editingResidentPhotoEntity = computed(() => {
    const r = this.editingResident();
    return r ? { id: r.id, displayName: r.name } : null;
  });

  statusTab = signal<StatusTab>('all');
  selectedBlockId = signal<string | null>(null);
  sortKey = signal<SortKey>('nameAsc');
  page = signal(1);
  pageSize = signal(10);

  readonly pageSizeOptions: number[] = [10, 25, 50];

  readonly activeCount = computed(() => this.residents().filter((r) => r.active).length);
  readonly totalResidents = computed(() => this.residents().length);
  readonly inactiveCount = computed(() => this.totalResidents() - this.activeCount());
  readonly apartmentsCovered = computed(() => {
    const ids = new Set<string>();
    for (const resident of this.residents()) {
      if (resident.apartmentId) {
        ids.add(resident.apartmentId);
      }
    }
    return ids.size;
  });

  readonly statusTabs = computed(() => [
    { key: 'all' as StatusTab, label: 'All', count: this.residents().length },
    { key: 'active' as StatusTab, label: 'Active', count: this.activeCount() },
    { key: 'pending' as StatusTab, label: 'Pending', count: 0 },
    { key: 'overdue' as StatusTab, label: 'Overdue', count: 0 },
  ]);

  readonly blockOptions = computed(() => {
    const seen = new Set<string>();
    const options: { id: string; label: string }[] = [];
    for (const [id, label] of Object.entries(this.apartmentLabels())) {
      if (!seen.has(id)) {
        seen.add(id);
        options.push({ id, label: label + ' \u00b7 ' + id.slice(0, 8) });
      }
    }
    return options;
  });

  readonly blockTriggerLabel = computed(() => {
    const id = this.selectedBlockId();
    if (!id) return 'Block: All';
    return 'Block: ' + (this.apartmentLabels()[id] ?? id.slice(0, 8));
  });

  readonly sortTriggerLabel = computed(() =>
    this.sortKey() === 'newest' ? 'Sort: Newest first' : 'Sort: Name (A\u2013Z)',
  );

  readonly filteredResidents = computed(() => {
    const list = this.residents();
    const search = this.searchTerm().trim().toLowerCase();
    const blockId = this.selectedBlockId();
    const tab = this.statusTab();
    return list.filter((resident) => {
      if (blockId && resident.apartmentId !== blockId) return false;
      if (tab === 'active' && !resident.active) return false;
      if (tab === 'pending' || tab === 'overdue') return false;
      if (search) {
        const haystack = [
          resident.name,
          resident.cpf,
          resident.email ?? '',
          resident.phone ?? '',
          this.getApartmentLabel(resident.apartmentId),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  });

  readonly sortedResidents = computed(() => {
    const list = [...this.filteredResidents()];
    if (this.sortKey() === 'newest') {
      return list.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredTotal = computed(() => this.sortedResidents().length);

  readonly clampedPage = computed(() => {
    const pageCount = Math.max(1, Math.ceil(this.filteredTotal() / this.pageSize()));
    return Math.min(this.page(), pageCount);
  });

  readonly paginatedResidents = computed(() => {
    const start = (this.clampedPage() - 1) * this.pageSize();
    return this.sortedResidents().slice(start, start + this.pageSize());
  });

  createForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    cpf: ['', [Validators.required, cpfValidator()]],
    apartmentId: [null, [Validators.required]],
    phone: [null],
  });

  editForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    cpf: ['', [Validators.required, cpfValidator()]],
    apartmentId: [null, [Validators.required]],
    phone: [null],
  });

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;

  constructor() {
    this.loadApartmentLabels();
    this.loadResidents();
    this.loadRecentVisits();
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  loadApartmentLabels(): void {
    this.apartmentsApi.list(undefined, 0, 500).subscribe({
      next: (apartments) => {
        const labels: Record<string, string> = {};
        for (const apartment of apartments) {
          labels[apartment.id] = formatApartmentLabel(apartment);
        }
        this.apartmentLabels.set(labels);
      },
    });
  }

  getApartmentLabel(apartmentId: string | null): string {
    if (!apartmentId) return '\u2014';
    return this.apartmentLabels()[apartmentId] ?? apartmentId.slice(0, 8);
  }

  loadResidents(): void {
    const requestId = ++this.searchRequestId;
    this.loading.set(true);
    this.api.list(this.searchTerm() || undefined, 0, 500).subscribe({
      next: (data) => {
        if (requestId !== this.searchRequestId) return;
        this.residents.set(data);
        this.loading.set(false);
      },
      error: () => {
        if (requestId !== this.searchRequestId) return;
        this.loading.set(false);
      },
    });
  }

  private loadRecentVisits(): void {
    this.dashboardApi.getStats().subscribe({
      next: (stats) => {
        this.recentVisits.set(stats.recentVisits ?? []);
      },
      error: () => {},
    });
  }

  refresh(): void {
    this.loadResidents();
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    this.searchTerm.set(value);
    this.page.set(1);
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.searchTimeout = null;
      this.loadResidents();
    }, 300);
  }

  onTabSelect(tab: StatusTab): void {
    this.statusTab.set(tab);
    this.page.set(1);
  }

  onBlockSelect(apartmentId: string | null): void {
    this.selectedBlockId.set(apartmentId);
    this.page.set(1);
    this.closeAllDropdowns();
  }

  onSortSelect(key: SortKey): void {
    this.sortKey.set(key);
    this.page.set(1);
    this.closeAllDropdowns();
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.page.set(1);
  }

  openCreateModal(): void {
    this.createForm.reset();
    this.createError.set(null);
    this.createModalStep.set('form');
    this.createdResident.set(null);
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
    this.createModalStep.set('form');
    this.createdResident.set(null);
  }

  onCreateModalOpenChange(open: boolean): void {
    if (!open && !this.creating()) this.closeCreateModal();
  }

  onCreateResident(): void {
    if (this.createForm.invalid) return;
    this.creating.set(true);
    this.createError.set(null);
    const value = this.createForm.value;
    this.api
      .create({
        name: value.name,
        cpf: value.cpf,
        phone: value.phone ?? null,
        apartmentId: value.apartmentId,
      })
      .subscribe({
        next: (created) => {
          this.creating.set(false);
          this.createdResident.set(created);
          this.createModalStep.set('photos');
          this.loadResidents();
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(getApiErrorMessage(err, 'Failed to create resident'));
        },
      });
  }

  openEditModal(resident: ResidentResponse): void {
    this.closeAllDropdowns();
    this.editingResident.set(resident);
    this.editForm.patchValue({
      name: resident.name,
      cpf: resident.cpf,
      apartmentId: resident.apartmentId,
      phone: resident.phone,
    });
    this.editError.set(null);
    this.editModalStep.set('form');
    this.editModalOpen.set(true);
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
    this.editingResident.set(null);
    this.editModalStep.set('form');
  }

  onEditModalOpenChange(open: boolean): void {
    if (!open && !this.saving()) this.closeEditModal();
  }

  onEditResident(): void {
    if (this.editForm.invalid) return;
    const resident = this.editingResident();
    if (!resident) return;
    this.saving.set(true);
    this.editError.set(null);
    const value = this.editForm.value;
    this.api
      .update(resident.id, {
        name: value.name,
        cpf: value.cpf,
        phone: value.phone ?? null,
        apartmentId: value.apartmentId,
        active: resident.active,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          // Refresh editingResident so photo panel sees the latest name/id
          this.editingResident.set(updated);
          this.editModalStep.set('photos');
          this.loadResidents();
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(getApiErrorMessage(err, 'Failed to update resident'));
        },
      });
  }

  onDeactivate(resident: ResidentResponse): void {
    this.closeAllDropdowns();
    this.residentToDeactivate.set(resident);
    this.confirmDeactivateOpen.set(true);
  }

  closeDeactivateConfirm(): void {
    this.confirmDeactivateOpen.set(false);
    this.residentToDeactivate.set(null);
  }

  onDeactivateModalOpenChange(open: boolean): void {
    if (!open && !this.deactivating()) this.closeDeactivateConfirm();
  }

  onConfirmDeactivate(): void {
    const resident = this.residentToDeactivate();
    if (!resident) return;
    this.deactivating.set(true);
    this.api
      .deactivate(resident.id, resident.name, resident.cpf, resident.email, resident.phone, resident.apartmentId)
      .subscribe({
        next: () => {
          this.deactivating.set(false);
          this.closeDeactivateConfirm();
          this.loadResidents();
        },
        error: () => {
          this.deactivating.set(false);
        },
      });
  }

  fieldError(form: FormGroup, controlName: string, message: string): string | null {
    const control = form.get(controlName);
    return control && control.invalid && control.touched ? message : null;
  }

  cpfError(form: FormGroup, controlName: string): string | null {
    const control = form.get(controlName);
    if (!control || !control.touched) return null;
    if (control.hasError('required')) return 'CPF is required';
    if (control.hasError('invalidCpf')) return 'CPF check digits are invalid';
    return control.invalid ? 'CPF check digits are invalid' : null;
  }

  visitStatusLabel(status: string): string {
    switch (status) {
      case 'Pending':
        return 'Pending';
      case 'CheckedIn':
        return 'On-site';
      case 'CheckedOut':
        return 'Checked out';
      case 'Cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  visitStatusTone(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (status) {
      case 'Pending':
        return 'warning';
      case 'CheckedIn':
        return 'success';
      case 'CheckedOut':
        return 'info';
      case 'Cancelled':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  private closeAllDropdowns(): void {
    for (const dropdown of this.dropdowns()) {
      dropdown.close();
    }
  }

  // ---------- Photo gallery (Phase 12) ----------

  openViewModal(resident: ResidentResponse): void {
    this.closeAllDropdowns();
    this.residentBeingViewed.set(resident);
    this.viewModalOpen.set(true);
  }

  closeViewModal(): void {
    this.viewModalOpen.set(false);
    this.residentBeingViewed.set(null);
  }

  onViewModalOpenChange(open: boolean): void {
    if (!open) this.closeViewModal();
  }
}
