import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CreateServiceProviderRequest,
  ServiceProviderResponse,
  ServiceProvidersApiService,
  UpdateServiceProviderRequest,
} from './service-providers-api.service';
import { AuthService } from '../../core/services/auth.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { CeButtonComponent, CeModalComponent, CePhotoPanelComponent } from '../../design-system';

type ProviderStatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'ce-service-providers-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CeButtonComponent, CeModalComponent, CePhotoPanelComponent],
  template: `
    <header class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Service providers</h1>
        <p class="page-subtitle">Keep contractor details current and control who is active on site.</p>
      </div>
      <div class="page-actions">
        <ce-button variant="secondary" size="md" (click)="load()" [disabled]="loading()">Refresh</ce-button>
        @if (canWrite()) {
          <ce-button variant="primary" size="md" (click)="openCreate()">Add provider</ce-button>
        }
      </div>
    </header>

    <section class="provider-summary" aria-label="Service provider summary">
      <span
        ><strong>{{ providers().length }}</strong> registered</span
      >
      <span
        ><strong>{{ activeCount() }}</strong> active</span
      >
      <span
        ><strong>{{ inactiveCount() }}</strong> inactive</span
      >
    </section>

    @if (pageError()) {
      <div class="page-error" role="alert">{{ pageError() }}</div>
    }

    <section class="directory-toolbar" aria-label="Service provider filters">
      <label class="search-control" for="service-provider-search">
        <span>Search providers</span>
        <input
          id="service-provider-search"
          class="ce-input"
          type="search"
          placeholder="Name, document, company, or service"
          [value]="search()"
          (input)="setSearch($any($event.target).value)"
        />
      </label>
      <div class="status-tabs" role="group" aria-label="Filter by provider status">
        @for (tab of statusTabs(); track tab.key) {
          <button
            type="button"
            class="status-tab"
            [class.is-selected]="statusFilter() === tab.key"
            (click)="statusFilter.set(tab.key)"
          >
            {{ tab.label }} <span>{{ tab.count }}</span>
          </button>
        }
      </div>
    </section>

    @if (loading()) {
      <div class="loading-state" aria-live="polite">
        <span class="loading-mark" aria-hidden="true"></span>
        Loading service providers…
      </div>
    } @else if (filteredProviders().length === 0) {
      <section class="empty-state" aria-live="polite">
        <h2>{{ providers().length === 0 ? 'No service providers yet' : 'No matching providers' }}</h2>
        <p>
          {{
            providers().length === 0
              ? 'Add a provider to keep the gatehouse directory ready.'
              : 'Try changing the search or status filter.'
          }}
        </p>
        @if (providers().length === 0 && canWrite()) {
          <ce-button variant="primary" size="md" (click)="openCreate()">Add provider</ce-button>
        }
      </section>
    } @else {
      <div class="directory-card">
        <div class="table-scroll">
          <table class="provider-table">
            <caption class="sr-only">
              Service provider directory
            </caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Contact</th>
                <th scope="col">Service</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (provider of filteredProviders(); track provider.id) {
                <tr [class.is-inactive]="!provider.active">
                  <td>
                    <strong class="provider-name">{{ provider.name }}</strong>
                    <span class="provider-detail">{{ provider.document }}</span>
                  </td>
                  <td>
                    <span>{{ provider.phone ?? 'No phone' }}</span>
                    <span class="provider-detail">{{ provider.email ?? 'No email' }}</span>
                  </td>
                  <td>
                    <span>{{ provider.serviceType ?? 'Unspecified service' }}</span>
                    @if (provider.company) {
                      <span class="provider-detail">{{ provider.company }}</span>
                    }
                  </td>
                  <td>
                    <span
                      class="status-badge"
                      [class.is-active]="provider.active"
                      [class.is-inactive]="!provider.active"
                    >
                      {{ provider.active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <ce-button variant="ghost" size="sm" (click)="openPhotos(provider)">Photos</ce-button>
                      @if (canWrite()) {
                        <ce-button variant="secondary" size="sm" (click)="openEdit(provider)">Edit</ce-button>
                        @if (provider.active) {
                          <ce-button variant="danger" size="sm" (click)="openDisableConfirmation(provider)"
                            >Disable</ce-button
                          >
                        }
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <ce-modal [open]="createOpen()" title="Add service provider" size="lg" (openChange)="onCreateModalChange($event)">
      @if (createError()) {
        <div class="form-error" role="alert">{{ createError() }}</div>
      }
      <form class="provider-form" [formGroup]="createForm" (ngSubmit)="create()">
        <div class="form-field">
          <label for="create-provider-name">Name</label>
          <input id="create-provider-name" class="ce-input" formControlName="name" autocomplete="name" />
          @if (createForm.controls.name.invalid && createForm.controls.name.touched) {
            <span class="field-error">Name is required.</span>
          }
        </div>
        <div class="form-field">
          <label for="create-provider-document">Document</label>
          <input id="create-provider-document" class="ce-input" formControlName="document" />
          @if (createForm.controls.document.invalid && createForm.controls.document.touched) {
            <span class="field-error">Document is required.</span>
          }
        </div>
        <div class="form-field">
          <label for="create-provider-phone">Phone</label>
          <input id="create-provider-phone" class="ce-input" formControlName="phone" autocomplete="tel" />
        </div>
        <div class="form-field">
          <label for="create-provider-email">Email</label>
          <input id="create-provider-email" class="ce-input" formControlName="email" autocomplete="email" />
        </div>
        <div class="form-field">
          <label for="create-provider-service">Service type</label>
          <input id="create-provider-service" class="ce-input" formControlName="serviceType" />
        </div>
        <div class="form-field">
          <label for="create-provider-company">Company</label>
          <input id="create-provider-company" class="ce-input" formControlName="company" autocomplete="organization" />
        </div>
      </form>
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closeCreate()">Cancel</ce-button>
        <ce-button
          variant="primary"
          size="sm"
          [disabled]="createForm.invalid || creating()"
          [loading]="creating()"
          (click)="create()"
          >Add provider</ce-button
        >
      </div>
    </ce-modal>

    <ce-modal [open]="editOpen()" title="Edit service provider" size="lg" (openChange)="onEditModalChange($event)">
      @if (editError()) {
        <div class="form-error" role="alert">{{ editError() }}</div>
      }
      <form class="provider-form" [formGroup]="editForm" (ngSubmit)="saveEdit()">
        <div class="form-field">
          <label for="edit-provider-name">Name</label>
          <input id="edit-provider-name" class="ce-input" formControlName="name" autocomplete="name" />
          @if (editForm.controls.name.invalid && editForm.controls.name.touched) {
            <span class="field-error">Name is required.</span>
          }
        </div>
        <div class="form-field">
          <label for="edit-provider-document">Document</label>
          <input id="edit-provider-document" class="ce-input" formControlName="document" />
          @if (editForm.controls.document.invalid && editForm.controls.document.touched) {
            <span class="field-error">Document is required.</span>
          }
        </div>
        <div class="form-field">
          <label for="edit-provider-phone">Phone</label>
          <input id="edit-provider-phone" class="ce-input" formControlName="phone" autocomplete="tel" />
        </div>
        <div class="form-field">
          <label for="edit-provider-email">Email</label>
          <input id="edit-provider-email" class="ce-input" formControlName="email" autocomplete="email" />
        </div>
        <div class="form-field">
          <label for="edit-provider-service">Service type</label>
          <input id="edit-provider-service" class="ce-input" formControlName="serviceType" />
        </div>
        <div class="form-field">
          <label for="edit-provider-company">Company</label>
          <input id="edit-provider-company" class="ce-input" formControlName="company" autocomplete="organization" />
        </div>
      </form>
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closeEdit()">Cancel</ce-button>
        <ce-button
          variant="primary"
          size="sm"
          [disabled]="editForm.invalid || saving()"
          [loading]="saving()"
          (click)="saveEdit()"
          >Save changes</ce-button
        >
      </div>
    </ce-modal>

    <ce-modal
      [open]="disableTarget() !== null"
      title="Disable service provider?"
      size="sm"
      (openChange)="onDisableModalChange($event)"
    >
      @if (disableTarget(); as target) {
        <p class="confirm-copy">
          <strong>{{ target.name }}</strong> will remain in the directory, but will be marked inactive and should not be
          used for active service access.
        </p>
      }
      @if (disableError()) {
        <div class="form-error" role="alert">{{ disableError() }}</div>
      }
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closeDisableConfirmation()">Keep active</ce-button>
        <ce-button variant="danger" size="sm" [loading]="disabling()" (click)="confirmDisable()"
          >Disable provider</ce-button
        >
      </div>
    </ce-modal>

    <ce-modal
      [open]="photosModalOpen()"
      [title]="photosProvider() ? photosProvider()!.name + ' — Photos' : 'Service provider photos'"
      size="lg"
      (openChange)="onPhotosModalOpenChange($event)"
    >
      @if (photosModalOpen()) {
        <ce-photo-panel
          entityType="service-provider"
          [entity]="photosEntity()"
          [canAdd]="canWrite()"
          [canDelete]="canWrite()"
        />
      }
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closePhotos()">Close</ce-button>
      </div>
    </ce-modal>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        margin-bottom: var(--space-4);
      }
      .page-title {
        margin: 0 0 var(--space-1);
        font-size: var(--font-size-2xl);
      }
      .page-subtitle {
        max-width: 44rem;
        margin: 0;
        color: var(--color-text-secondary);
      }
      .page-actions,
      .row-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .provider-summary {
        display: flex;
        gap: var(--space-4);
        flex-wrap: wrap;
        padding: var(--space-3) 0;
        margin-bottom: var(--space-4);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      .provider-summary strong {
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
      }
      .directory-toolbar {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        margin-bottom: var(--space-4);
      }
      .search-control {
        display: grid;
        gap: var(--space-1);
        min-width: min(100%, 19rem);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      .ce-input {
        width: 100%;
        min-height: 2.5rem;
        padding: 0 var(--space-3);
        color: var(--color-text-primary);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font: inherit;
      }
      .ce-input:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
        border-color: var(--color-primary);
      }
      .status-tabs {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
      }
      .status-tab {
        min-height: 2.25rem;
        padding: 0 var(--space-3);
        color: var(--color-text-secondary);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        cursor: pointer;
        font: inherit;
        font-size: var(--font-size-sm);
      }
      .status-tab span {
        margin-left: var(--space-1);
        font-variant-numeric: tabular-nums;
      }
      .status-tab:hover {
        background: var(--color-neutral-light);
        color: var(--color-text-primary);
      }
      .status-tab.is-selected {
        color: var(--color-text-primary);
        background: var(--color-surface);
        border-color: var(--color-border);
      }
      .status-tab:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .directory-card {
        overflow: hidden;
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-card);
      }
      .table-scroll {
        overflow-x: auto;
      }
      .provider-table {
        width: 100%;
        min-width: 48rem;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
      }
      .provider-table th {
        padding: var(--space-3) var(--space-4);
        color: var(--color-text-secondary);
        background: var(--color-neutral-light);
        border-bottom: 1px solid var(--color-border);
        text-align: left;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .provider-table td {
        padding: var(--space-3) var(--space-4);
        color: var(--color-text-primary);
        border-bottom: 1px solid var(--color-border);
        vertical-align: middle;
      }
      .provider-table tbody tr:last-child td {
        border-bottom: 0;
      }
      .provider-table tbody tr:hover {
        background: var(--color-neutral-light);
      }
      .provider-table tr.is-inactive {
        opacity: 0.72;
      }
      .provider-name,
      .provider-detail {
        display: block;
      }
      .provider-detail {
        margin-top: var(--space-1);
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
      }
      .status-badge {
        display: inline-flex;
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        color: var(--color-text-secondary);
        background: var(--color-neutral-light);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
      }
      .status-badge.is-active {
        color: var(--color-success);
        background: var(--color-success-light);
        border-color: color-mix(in oklch, var(--color-success) 30%, transparent);
      }
      .page-error,
      .form-error {
        padding: var(--space-3);
        margin-bottom: var(--space-4);
        color: var(--color-danger);
        background: var(--color-danger-light);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
      }
      .loading-state,
      .empty-state {
        display: grid;
        justify-items: center;
        gap: var(--space-3);
        padding: var(--space-12) var(--space-6);
        color: var(--color-text-secondary);
        text-align: center;
      }
      .empty-state h2 {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--font-size-lg);
      }
      .empty-state p {
        max-width: 28rem;
        margin: 0;
      }
      .loading-mark {
        width: 1.5rem;
        height: 1.5rem;
        border: 3px solid var(--color-primary);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      .provider-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-4);
      }
      .form-field {
        display: grid;
        gap: var(--space-1);
      }
      .form-field label {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      .field-error {
        color: var(--color-danger);
        font-size: var(--font-size-xs);
      }
      .confirm-copy {
        margin: 0;
        color: var(--color-text-secondary);
        line-height: 1.55;
      }
      .confirm-copy strong {
        color: var(--color-text-primary);
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (max-width: 40rem) {
        .provider-form {
          grid-template-columns: 1fr;
        }
        .page-actions {
          width: 100%;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .loading-mark {
          animation: none;
          border-style: dashed;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceProvidersPage {
  private readonly api = inject(ServiceProvidersApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly providers = signal<ServiceProviderResponse[]>([]);
  readonly loading = signal(true);
  readonly pageError = signal<string | null>(null);
  readonly search = signal('');
  readonly statusFilter = signal<ProviderStatusFilter>('all');
  readonly createOpen = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly editOpen = signal(false);
  readonly editingProvider = signal<ServiceProviderResponse | null>(null);
  readonly saving = signal(false);
  readonly editError = signal<string | null>(null);
  readonly disableTarget = signal<ServiceProviderResponse | null>(null);
  readonly disabling = signal(false);
  readonly disableError = signal<string | null>(null);
  readonly photosModalOpen = signal(false);
  readonly photosProvider = signal<ServiceProviderResponse | null>(null);

  readonly canWrite = computed(() => this.auth.hasPermission('ServiceProviders.Write'));
  readonly activeCount = computed(() => this.providers().filter((provider) => provider.active).length);
  readonly inactiveCount = computed(() => this.providers().length - this.activeCount());
  readonly statusTabs = computed(() => [
    { key: 'all' as const, label: 'All', count: this.providers().length },
    { key: 'active' as const, label: 'Active', count: this.activeCount() },
    { key: 'inactive' as const, label: 'Inactive', count: this.inactiveCount() },
  ]);
  readonly filteredProviders = computed(() => {
    const search = this.search().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.providers().filter((provider) => {
      const matchesStatus = status === 'all' || (status === 'active' ? provider.active : !provider.active);
      const haystack = [
        provider.name,
        provider.document,
        provider.phone,
        provider.email,
        provider.serviceType,
        provider.company,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLocaleLowerCase();
      return matchesStatus && (!search || haystack.includes(search));
    });
  });
  readonly photosEntity = computed(() => {
    const provider = this.photosProvider();
    return provider ? { id: provider.id, displayName: provider.name } : null;
  });

  readonly createForm = this.buildForm();
  readonly editForm = this.buildForm();

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.list().subscribe({
      next: (providers) => {
        this.providers.set(providers);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.pageError.set(getApiErrorMessage(error, 'Service providers could not be loaded. Try again.'));
        this.loading.set(false);
      },
    });
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

  openCreate(): void {
    this.createForm.reset(this.emptyFormValue());
    this.createError.set(null);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
    this.createError.set(null);
  }

  onCreateModalChange(open: boolean): void {
    if (!open) this.closeCreate();
  }

  create(): void {
    if (this.createForm.invalid || this.creating()) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    this.createError.set(null);
    this.api.create(this.toRequest(this.createForm.getRawValue())).subscribe({
      next: (provider) => {
        this.providers.update((providers) => [provider, ...providers]);
        this.creating.set(false);
        this.closeCreate();
      },
      error: (error: unknown) => {
        this.createError.set(
          getApiErrorMessage(error, 'The provider could not be added. Review the details and try again.'),
        );
        this.creating.set(false);
      },
    });
  }

  openEdit(provider: ServiceProviderResponse): void {
    this.editingProvider.set(provider);
    this.editForm.reset({
      name: provider.name,
      document: provider.document,
      phone: provider.phone ?? '',
      email: provider.email ?? '',
      serviceType: provider.serviceType ?? '',
      company: provider.company ?? '',
    });
    this.editError.set(null);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editingProvider.set(null);
    this.editError.set(null);
  }

  onEditModalChange(open: boolean): void {
    if (!open) this.closeEdit();
  }

  saveEdit(): void {
    const provider = this.editingProvider();
    if (!provider || this.editForm.invalid || this.saving()) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.editError.set(null);
    this.api.update(provider.id, this.toRequest(this.editForm.getRawValue())).subscribe({
      next: (updated) => {
        this.replaceProvider(updated);
        this.saving.set(false);
        this.closeEdit();
      },
      error: (error: unknown) => {
        this.editError.set(
          getApiErrorMessage(error, 'The provider could not be saved. Review the details and try again.'),
        );
        this.saving.set(false);
      },
    });
  }

  openDisableConfirmation(provider: ServiceProviderResponse): void {
    this.disableError.set(null);
    this.disableTarget.set(provider);
  }

  closeDisableConfirmation(): void {
    if (this.disabling()) return;
    this.disableTarget.set(null);
    this.disableError.set(null);
  }

  onDisableModalChange(open: boolean): void {
    if (!open) this.closeDisableConfirmation();
  }

  confirmDisable(): void {
    const provider = this.disableTarget();
    if (!provider || this.disabling()) return;

    this.disabling.set(true);
    this.disableError.set(null);
    this.api.deactivate(provider.id).subscribe({
      next: (updated) => {
        this.replaceProvider(updated);
        this.disabling.set(false);
        this.closeDisableConfirmation();
      },
      error: (error: unknown) => {
        this.disableError.set(getApiErrorMessage(error, 'The provider could not be disabled. Try again.'));
        this.disabling.set(false);
      },
    });
  }

  openPhotos(provider: ServiceProviderResponse): void {
    this.photosProvider.set(provider);
    this.photosModalOpen.set(true);
  }

  closePhotos(): void {
    this.photosModalOpen.set(false);
    this.photosProvider.set(null);
  }

  onPhotosModalOpenChange(open: boolean): void {
    if (!open) this.closePhotos();
  }

  private buildForm() {
    return this.fb.nonNullable.group({
      name: ['', Validators.required],
      document: ['', Validators.required],
      phone: [''],
      email: ['', Validators.email],
      serviceType: [''],
      company: [''],
    });
  }

  private emptyFormValue() {
    return { name: '', document: '', phone: '', email: '', serviceType: '', company: '' };
  }

  private toRequest(value: {
    name: string;
    document: string;
    phone: string;
    email: string;
    serviceType: string;
    company: string;
  }): UpdateServiceProviderRequest {
    return {
      name: value.name.trim(),
      document: value.document.trim(),
      phone: this.toNullable(value.phone),
      email: this.toNullable(value.email),
      serviceType: this.toNullable(value.serviceType),
      company: this.toNullable(value.company),
    };
  }

  private toNullable(value: string): string | null {
    const trimmed = value.trim();
    return trimmed || null;
  }

  private replaceProvider(updated: ServiceProviderResponse): void {
    this.providers.update((providers) =>
      providers.map((provider) => (provider.id === updated.id ? updated : provider)),
    );
  }
}
