import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VehiclesApiService, VehicleResponse } from './vehicles-api.service';
import { ApartmentPickerComponent } from '../../shared/apartment-picker/apartment-picker.component';
import { ApartmentsApiService, formatApartmentLabel } from '../apartments/apartments-api.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { AuthService } from '../../core/services/auth.service';
import {
  CeBadgeComponent,
  CeButtonComponent,
  CeCardComponent,
  CeEmptyStateComponent,
  CeIconComponent,
  CeInputComponent,
  CeModalComponent,
  CePhotoPanelComponent,
  CePhotoThumbComponent,
  CeSpinnerComponent,
  CeTableComponent,
} from '../../design-system';
import type { VehicleType } from '../../api/models/vehicle-type';

const VEHICLE_TYPES = [
  { value: 0, label: 'Car' },
  { value: 1, label: 'Motorcycle' },
  { value: 2, label: 'Truck' },
  { value: 3, label: 'Other' },
] as const;

@Component({
  selector: 'ce-vehicles-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ApartmentPickerComponent,
    CeBadgeComponent,
    CeButtonComponent,
    CeCardComponent,
    CeEmptyStateComponent,
    CeIconComponent,
    CeInputComponent,
    CeModalComponent,
    CePhotoPanelComponent,
    CePhotoThumbComponent,
    CeSpinnerComponent,
    CeTableComponent,
  ],
  template: `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Vehicles</h1>
        <p class="page-subtitle">{{ vehicles().length }} registered vehicles</p>
      </div>
      <div class="page-header-actions">
        <ce-button variant="secondary" size="md" (click)="refresh()">
          <ce-icon name="refresh" [size]="16" /> Refresh
        </ce-button>
        @if (canWrite()) {
          <ce-button variant="primary" size="md" (click)="openCreateModal()">
            <ce-icon name="plus" [size]="16" /> Add vehicle
          </ce-button>
        }
      </div>
    </div>

    @if (pageError()) {
      <div class="page-error">{{ pageError() }}</div>
    }

    @if (loading()) {
      <div class="loading-state">
        <ce-spinner tone="primary" size="lg" />
        <p>Loading vehicles...</p>
      </div>
    } @else if (vehicles().length === 0) {
      <ce-empty-state
        icon=""
        title="No vehicles yet"
        description="Add your first vehicle to get started."
        [actionLabel]="canWrite() ? 'Add vehicle' : ''"
        (action)="openCreateModal()"
      >
        <ce-icon name="car" [size]="40" />
      </ce-empty-state>
    } @else {
      <ce-card [padded]="false">
        <ce-table>
          <thead>
            <tr>
              <th scope="col">Photo</th>
              <th scope="col">Plate</th>
              <th scope="col">Owner</th>
              <th scope="col">Apartment</th>
              <th scope="col">Brand / Model</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col" class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            @for (vehicle of vehicles(); track vehicle.id) {
              <tr>
                <td><ce-photo-thumb entityType="vehicle" [entityId]="vehicle.id" /></td>
                <td>{{ vehicle.plate }}</td>
                <td>{{ vehicle.ownerName ?? '—' }}</td>
                <td>{{ getApartmentLabel(vehicle.apartmentId) }}</td>
                <td>{{ vehicle.brand ?? '—' }} {{ vehicle.model ?? '' }}</td>
                <td>{{ getVehicleTypeLabel(vehicle.vehicleType) }}</td>
                <td>
                  <ce-badge
                    [tone]="vehicle.active ? 'success' : 'neutral'"
                    size="sm"
                    [content]="vehicle.active ? 'Active' : 'Inactive'"
                  />
                </td>
                <td>
                  <div class="action-cell">
                    <ce-button
                      variant="ghost"
                      size="sm"
                      (click)="openPhotos(vehicle)"
                      [attr.aria-label]="'Vehicle photos'"
                      title="Photos"
                    >
                      <ce-icon name="camera" [size]="16" />
                    </ce-button>
                    @if (canWrite()) {
                      <ce-button
                        variant="ghost"
                        size="sm"
                        (click)="openEditModal(vehicle)"
                        [attr.aria-label]="'Edit vehicle'"
                        title="Edit"
                      >
                        <ce-icon name="edit" [size]="16" />
                      </ce-button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">
                  <ce-empty-state icon="" title="No vehicles found" description="">
                    <ce-icon name="car" [size]="40" />
                  </ce-empty-state>
                </td>
              </tr>
            }
          </tbody>
        </ce-table>
      </ce-card>
    }

    <ce-modal
      [open]="createModalOpen()"
      [title]="
        createModalStep() === 'photos' ? 'Add photos for ' + (createdVehicle()?.plate ?? 'vehicle') : 'Add vehicle'
      "
      [size]="createModalStep() === 'photos' ? 'lg' : 'md'"
      (openChange)="onCreateModalOpenChange($event)"
    >
      @if (createModalStep() === 'form') {
        @if (createError()) {
          <div class="form-error-banner">{{ createError() }}</div>
        }
        <form class="ce-form" [formGroup]="createForm" (ngSubmit)="onCreate()">
          <ce-input
            label="Plate"
            inputId="cv-plate"
            placeholder="e.g. ABC-1234"
            formControlName="plate"
            [error]="createForm.get('plate')?.invalid && createForm.get('plate')?.touched ? 'Plate is required' : null"
          />
          <ce-input label="Owner name" inputId="cv-owner" placeholder="e.g. Maria Silva" formControlName="ownerName" />
          <ce-apartment-picker
            formControlName="apartmentId"
            label="Apartment"
            inputId="cv-apartment"
            placeholder="Select block and unit..."
          />
          <ce-input label="Brand" inputId="cv-brand" placeholder="e.g. Toyota" formControlName="brand" />
          <ce-input label="Model" inputId="cv-model" placeholder="e.g. Corolla" formControlName="model" />
          <ce-input label="Color" inputId="cv-color" placeholder="e.g. Silver" formControlName="color" />
          <div class="form-row">
            <label class="form-label" for="cv-type">Vehicle type</label>
            <select id="cv-type" class="vehicle-select" formControlName="vehicleType">
              <option [ngValue]="null">Select type...</option>
              @for (vt of vehicleTypes; track vt.value) {
                <option [ngValue]="vt.value">{{ vt.label }}</option>
              }
            </select>
          </div>
        </form>
      } @else {
        <ce-photo-panel
          entityType="vehicle"
          [entity]="createdVehiclePhotoEntity()"
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
            (click)="onCreate()"
            >Create</ce-button
          >
        } @else {
          <ce-button variant="primary" size="sm" (click)="closeCreateModal()">Done</ce-button>
        }
      </div>
    </ce-modal>
    <ce-modal
      [open]="editModalOpen()"
      [title]="editModalStep() === 'photos' ? 'Photos for ' + (editingVehicle()?.plate ?? 'vehicle') : 'Edit vehicle'"
      [size]="editModalStep() === 'photos' ? 'lg' : 'md'"
      (openChange)="onEditModalOpenChange($event)"
    >
      @if (editModalStep() === 'form') {
        @if (editError()) {
          <div class="form-error-banner">{{ editError() }}</div>
        }
        <form class="ce-form" [formGroup]="editForm" (ngSubmit)="onEditVehicle()">
          <ce-input
            label="Plate"
            inputId="ev-plate"
            placeholder="e.g. ABC-1234"
            formControlName="plate"
            [error]="editForm.get('plate')?.invalid && editForm.get('plate')?.touched ? 'Plate is required' : null"
          />
          <ce-input label="Owner name" inputId="ev-owner" placeholder="e.g. Maria Silva" formControlName="ownerName" />
          <ce-apartment-picker
            formControlName="apartmentId"
            label="Apartment"
            inputId="ev-apartment"
            placeholder="Select block and unit..."
          />
          <ce-input label="Brand" inputId="ev-brand" placeholder="e.g. Toyota" formControlName="brand" />
          <ce-input label="Model" inputId="ev-model" placeholder="e.g. Corolla" formControlName="model" />
          <ce-input label="Color" inputId="ev-color" placeholder="e.g. Silver" formControlName="color" />
          <div class="form-row">
            <label class="form-label" for="ev-type">Vehicle type</label>
            <select id="ev-type" class="vehicle-select" formControlName="vehicleType">
              <option [ngValue]="null">Select type...</option>
              @for (vt of vehicleTypes; track vt.value) {
                <option [ngValue]="vt.value">{{ vt.label }}</option>
              }
            </select>
          </div>
        </form>
      } @else {
        <ce-photo-panel
          entityType="vehicle"
          [entity]="editingVehiclePhotoEntity()"
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
            (click)="onEditVehicle()"
            >Save changes</ce-button
          >
        } @else {
          <ce-button variant="primary" size="sm" (click)="closeEditModal()">Done</ce-button>
        }
      </div>
    </ce-modal>

    <ce-modal
      [open]="photosModalOpen()"
      [title]="photosVehicle() ? 'Vehicle ' + photosVehicle()!.plate + ' — Photos' : 'Vehicle photos'"
      size="lg"
      (openChange)="onPhotosModalOpenChange($event)"
    >
      @if (photosModalOpen()) {
        <ce-photo-panel entityType="vehicle" [entity]="photosEntity()" [canAdd]="canWrite()" [canDelete]="canWrite()" />
      }
      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" (click)="closePhotos()">Close</ce-button>
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
      .page-title {
        font-size: var(--font-size-2xl);
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
      .page-error {
        margin-bottom: var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-lg);
        background: var(--color-danger-light);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
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

      .actions-col {
        width: 1%;
        white-space: nowrap;
      }
      .action-cell {
        display: inline-flex;
        gap: var(--space-1);
      }

      .form-row {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .form-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }
      .vehicle-select {
        width: 100%;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        padding: var(--space-3);
        font-family: inherit;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        outline: none;
        min-height: 2.5rem;
        cursor: pointer;
      }
      .vehicle-select:focus-visible {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 15%, transparent);
      }
      .form-error-banner {
        margin-bottom: var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-lg);
        background: var(--color-danger-light);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehiclesPage {
  private readonly api = inject(VehiclesApiService);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly canWrite = computed(() => this.auth.hasPermission('Vehicles.Write'));
  readonly vehicleTypes = VEHICLE_TYPES;

  vehicles = signal<VehicleResponse[]>([]);
  apartmentLabels = signal<Record<string, string>>({});
  loading = signal(true);
  creating = signal(false);
  saving = signal(false);
  createModalOpen = signal(false);
  editModalOpen = signal(false);
  pageError = signal<string | null>(null);
  createError = signal<string | null>(null);
  editError = signal<string | null>(null);
  editingVehicle = signal<VehicleResponse | null>(null);
  createModalStep = signal<'form' | 'photos'>('form');
  editModalStep = signal<'form' | 'photos'>('form');
  createdVehicle = signal<VehicleResponse | null>(null);

  readonly createdVehiclePhotoEntity = computed(() => {
    const vehicle = this.createdVehicle();
    return vehicle ? { id: vehicle.id, displayName: vehicle.plate } : null;
  });

  readonly editingVehiclePhotoEntity = computed(() => {
    const vehicle = this.editingVehicle();
    return vehicle ? { id: vehicle.id, displayName: vehicle.plate } : null;
  });

  createForm: FormGroup = this.fb.group({
    plate: ['', Validators.required],
    ownerName: [''],
    apartmentId: [null],
    brand: [''],
    model: [''],
    color: [''],
    vehicleType: [null],
  });

  editForm: FormGroup = this.fb.group({
    plate: ['', Validators.required],
    ownerName: [''],
    apartmentId: [null],
    brand: [''],
    model: [''],
    color: [''],
    vehicleType: [null],
  });

  constructor() {
    this.loadApartmentLabels();
    this.load();
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
    if (!apartmentId) return '—';
    return this.apartmentLabels()[apartmentId] ?? apartmentId.slice(0, 8);
  }

  getVehicleTypeLabel(vehicleType: VehicleType): string {
    const found = VEHICLE_TYPES.find((vt) => vt.value === vehicleType);
    return found ? found.label : String(vehicleType);
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.list().subscribe({
      next: (data) => {
        this.vehicles.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.pageError.set(getApiErrorMessage(err, 'Failed to load vehicles'));
        this.loading.set(false);
      },
    });
  }

  refresh(): void {
    this.load();
  }

  openCreateModal(): void {
    this.createForm.reset();
    this.createError.set(null);
    this.createModalStep.set('form');
    this.createdVehicle.set(null);
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
    this.createModalStep.set('form');
    this.createdVehicle.set(null);
  }

  onCreateModalOpenChange(open: boolean): void {
    if (!open && !this.creating()) this.closeCreateModal();
  }

  onCreate(): void {
    if (this.createForm.invalid) return;
    this.creating.set(true);
    this.createError.set(null);
    const v = this.createForm.value;
    this.api
      .create({
        plate: v.plate!,
        ownerName: v.ownerName || null,
        apartmentId: v.apartmentId || null,
        brand: v.brand || null,
        model: v.model || null,
        color: v.color || null,
        vehicleType: v.vehicleType ?? null,
      })
      .subscribe({
        next: (created) => {
          this.creating.set(false);
          this.createdVehicle.set(created);
          this.createModalStep.set('photos');
          this.load();
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(getApiErrorMessage(err, 'Failed to create vehicle'));
        },
      });
  }

  openEditModal(vehicle: VehicleResponse): void {
    this.editingVehicle.set(vehicle);
    this.editForm.patchValue({
      plate: vehicle.plate,
      ownerName: vehicle.ownerName,
      apartmentId: vehicle.apartmentId,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      vehicleType: vehicle.vehicleType,
    });
    this.editError.set(null);
    this.editModalStep.set('form');
    this.editModalOpen.set(true);
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
    this.editingVehicle.set(null);
    this.editModalStep.set('form');
  }

  onEditModalOpenChange(open: boolean): void {
    if (!open && !this.saving()) this.closeEditModal();
  }

  onEditVehicle(): void {
    if (this.editForm.invalid) return;
    const vehicle = this.editingVehicle();
    if (!vehicle) return;
    this.saving.set(true);
    this.editError.set(null);
    const v = this.editForm.value;
    this.api
      .update(vehicle.id, {
        plate: v.plate!,
        ownerName: v.ownerName || null,
        apartmentId: v.apartmentId || null,
        brand: v.brand || null,
        model: v.model || null,
        color: v.color || null,
        vehicleType: v.vehicleType ?? null,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.editingVehicle.set(updated);
          this.editModalStep.set('photos');
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(getApiErrorMessage(err, 'Failed to update vehicle'));
        },
      });
  }

  photosModalOpen = signal(false);
  photosVehicle = signal<VehicleResponse | null>(null);

  readonly photosEntity = computed(() => {
    const v = this.photosVehicle();
    return v ? { id: v.id, displayName: v.plate } : null;
  });

  openPhotos(vehicle: VehicleResponse): void {
    this.photosVehicle.set(vehicle);
    this.photosModalOpen.set(true);
  }

  closePhotos(): void {
    this.photosModalOpen.set(false);
    this.photosVehicle.set(null);
  }

  onPhotosModalOpenChange(open: boolean): void {
    if (!open) this.closePhotos();
  }
}
