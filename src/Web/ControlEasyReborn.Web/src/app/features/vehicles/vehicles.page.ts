import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VehiclesApiService, VehicleResponse } from './vehicles-api.service';
import { ApartmentPickerComponent } from '../../shared/apartment-picker/apartment-picker.component';
import {
  ApartmentsApiService,
  formatApartmentLabel,
} from '../apartments/apartments-api.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { AuthService } from '../../core/services/auth.service';
import { CeButtonComponent, CeModalComponent, CePhotoPanelComponent, CePhotoThumbComponent } from '../../design-system';
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
  imports: [CommonModule, ReactiveFormsModule, ApartmentPickerComponent, CeButtonComponent, CeModalComponent, CePhotoPanelComponent, CePhotoThumbComponent],
  template: `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Vehicles</h1>
        <p class="page-subtitle">{{ vehicles().length }} registered vehicles</p>
      </div>
      <div class="page-header-actions">
        <button class="ce-button variant-secondary size-md" (click)="refresh()">&#8635; Refresh</button>
        @if (canWrite()) {
          <button class="ce-button variant-primary size-md" (click)="openCreateModal()">&#43; Add vehicle</button>
        }
      </div>
    </div>

    @if (pageError()) {
      <div class="page-error">{{ pageError() }}</div>
    }

    @if (loading()) {
      <div class="loading-state">
        <div class="ce-spinner tone-primary size-lg"></div>
        <p>Loading vehicles...</p>
      </div>
    } @else if (vehicles().length === 0) {
      <div class="ce-empty-state">
        <div class="ce-empty-state-icon">&#128663;</div>
        <div class="ce-empty-state-title">No vehicles yet</div>
        <div class="ce-empty-state-description text-secondary">
          Add your first vehicle to get started.
        </div>
        @if (canWrite()) {
          <button class="ce-button variant-primary size-md" (click)="openCreateModal()">&#43; Add vehicle</button>
        }
      </div>
    } @else {
      <div class="ce-card" style="padding: 0;">
        <div class="ce-table-wrapper">
          <table class="ce-table" aria-label="Vehicles table">
            <thead>
              <tr>
                <th scope="col">Photo</th>
                <th scope="col">Plate</th>
                <th scope="col">Owner</th>
                <th scope="col">Apartment</th>
                <th scope="col">Brand / Model</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col" style="width: 1%;"></th>
              </tr>
            </thead>
            <tbody>
              @for (vehicle of vehicles(); track vehicle.id) {
                <tr>
                  <td><ce-photo-thumb entityType="vehicle" [entityId]="vehicle.id" /></td>
                  <td>{{ vehicle.plate }}</td>
                  <td>{{ vehicle.ownerName ?? '\u2014' }}</td>
                  <td>{{ getApartmentLabel(vehicle.apartmentId) }}</td>
                  <td>{{ vehicle.brand ?? '\u2014' }} {{ vehicle.model ?? '' }}</td>
                  <td>{{ getVehicleTypeLabel(vehicle.vehicleType) }}</td>
                  <td>
                    <span class="ce-badge tone-success size-sm">{{ vehicle.active ? 'Active' : 'Inactive' }}</span>
                  </td>
                  <td>
                    <div class="action-cell">
                      <button class="icon-btn-sm" aria-label="Vehicle photos" title="Photos" (click)="openPhotos(vehicle)">&#128247;</button>
                      @if (canWrite()) {
                        <button class="icon-btn-sm" aria-label="Edit vehicle" title="Edit" (click)="openEditModal(vehicle)">&#9998;</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <div class="ce-empty-state" style="padding: var(--space-8) var(--space-4);">
                      <div class="ce-empty-state-icon">&#128663;</div>
                      <div class="ce-empty-state-title">No vehicles found</div>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <ce-modal
      [open]="createModalOpen()"
      [title]="createModalStep() === 'photos' ? 'Add photos for ' + (createdVehicle()?.plate ?? 'vehicle') : 'Add vehicle'"
      [size]="createModalStep() === 'photos' ? 'lg' : 'md'"
      (openChange)="onCreateModalOpenChange($event)"
    >
      @if (createModalStep() === 'form') {
        @if (createError()) {
          <div class="form-error-banner">{{ createError() }}</div>
        }
        <form class="ce-form" [formGroup]="createForm" (ngSubmit)="onCreate()">
          <div class="ce-input-group">
            <label class="ce-input-label" for="cv-plate">Plate</label>
            <div class="ce-input-wrapper" [class.has-error]="createForm.get('plate')?.invalid && createForm.get('plate')?.touched">
              <input id="cv-plate" class="ce-input" placeholder="e.g. ABC-1234" formControlName="plate" />
            </div>
            @if (createForm.get('plate')?.invalid && createForm.get('plate')?.touched) {
              <div class="ce-input-error">Plate is required</div>
            }
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="cv-owner">Owner name</label>
            <div class="ce-input-wrapper">
              <input id="cv-owner" class="ce-input" placeholder="e.g. Maria Silva" formControlName="ownerName" />
            </div>
          </div>
          <ce-apartment-picker formControlName="apartmentId" label="Apartment" inputId="cv-apartment" placeholder="Select block and unit..." />
          <div class="ce-input-group">
            <label class="ce-input-label" for="cv-brand">Brand</label>
            <div class="ce-input-wrapper">
              <input id="cv-brand" class="ce-input" placeholder="e.g. Toyota" formControlName="brand" />
            </div>
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="cv-model">Model</label>
            <div class="ce-input-wrapper">
              <input id="cv-model" class="ce-input" placeholder="e.g. Corolla" formControlName="model" />
            </div>
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="cv-color">Color</label>
            <div class="ce-input-wrapper">
              <input id="cv-color" class="ce-input" placeholder="e.g. Silver" formControlName="color" />
            </div>
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="cv-type">Vehicle type</label>
            <div class="ce-input-wrapper">
              <select id="cv-type" class="ce-input" formControlName="vehicleType">
                <option [ngValue]="null">Select type...</option>
                @for (vt of vehicleTypes; track vt.value) {
                  <option [ngValue]="vt.value">{{ vt.label }}</option>
                }
              </select>
            </div>
          </div>
        </form>
      } @else {
        <ce-photo-panel entityType="vehicle" [entity]="createdVehiclePhotoEntity()" [canAdd]="canWrite()" [canDelete]="canWrite()" />
      }
      <div ce-modal-footer>
        @if (createModalStep() === 'form') {
          <ce-button variant="ghost" size="sm" (click)="closeCreateModal()">Cancel</ce-button>
          <ce-button variant="primary" size="sm" [disabled]="createForm.invalid || creating()" [loading]="creating()" (click)="onCreate()">Create</ce-button>
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
          <div class="ce-input-group">
            <label class="ce-input-label" for="ev-plate">Plate</label>
            <div class="ce-input-wrapper" [class.has-error]="editForm.get('plate')?.invalid && editForm.get('plate')?.touched">
              <input id="ev-plate" class="ce-input" placeholder="e.g. ABC-1234" formControlName="plate" />
            </div>
            @if (editForm.get('plate')?.invalid && editForm.get('plate')?.touched) {
              <div class="ce-input-error">Plate is required</div>
            }
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="ev-owner">Owner name</label>
            <div class="ce-input-wrapper">
              <input id="ev-owner" class="ce-input" placeholder="e.g. Maria Silva" formControlName="ownerName" />
            </div>
          </div>
          <ce-apartment-picker formControlName="apartmentId" label="Apartment" inputId="ev-apartment" placeholder="Select block and unit..." />
          <div class="ce-input-group">
            <label class="ce-input-label" for="ev-brand">Brand</label>
            <div class="ce-input-wrapper">
              <input id="ev-brand" class="ce-input" placeholder="e.g. Toyota" formControlName="brand" />
            </div>
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="ev-model">Model</label>
            <div class="ce-input-wrapper">
              <input id="ev-model" class="ce-input" placeholder="e.g. Corolla" formControlName="model" />
            </div>
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="ev-color">Color</label>
            <div class="ce-input-wrapper">
              <input id="ev-color" class="ce-input" placeholder="e.g. Silver" formControlName="color" />
            </div>
          </div>
          <div class="ce-input-group">
            <label class="ce-input-label" for="ev-type">Vehicle type</label>
            <div class="ce-input-wrapper">
              <select id="ev-type" class="ce-input" formControlName="vehicleType">
                <option [ngValue]="null">Select type...</option>
                @for (vt of vehicleTypes; track vt.value) {
                  <option [ngValue]="vt.value">{{ vt.label }}</option>
                }
              </select>
            </div>
          </div>
        </form>
      } @else {
        <ce-photo-panel entityType="vehicle" [entity]="editingVehiclePhotoEntity()" [canAdd]="canWrite()" [canDelete]="canWrite()" />
      }
      <div ce-modal-footer>
        @if (editModalStep() === 'form') {
          <ce-button variant="ghost" size="sm" (click)="closeEditModal()">Cancel</ce-button>
          <ce-button variant="primary" size="sm" [disabled]="editForm.invalid || saving()" [loading]="saving()" (click)="onEditVehicle()">Save changes</ce-button>
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
        <ce-photo-panel
          entityType="vehicle"
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
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      margin-bottom: var(--space-6);
    }
    .page-title-block { min-width: 0; }
    .page-title { font-size: var(--font-size-2xl); margin-bottom: var(--space-1); }
    .page-subtitle { color: var(--color-text-secondary); font-size: var(--font-size-sm); }
    .page-header-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .page-error {
      margin-bottom: var(--space-4); padding: var(--space-3); border-radius: var(--radius-lg);
      background: var(--color-danger-light); color: var(--color-danger); font-size: var(--font-size-sm);
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

    .ce-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      font-weight: var(--font-weight-medium);
      border: 1px solid transparent;
      border-radius: var(--radius-lg);
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      transition: transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out), background-color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out);
      text-decoration: none;
      font-family: inherit;
    }
    .ce-button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .ce-button.size-sm { height: 2rem; padding: 0 var(--space-3); font-size: var(--font-size-sm); }
    .ce-button.size-md { height: 2.5rem; padding: 0 var(--space-4); font-size: var(--font-size-sm); }
    .ce-button.variant-primary { background: var(--color-primary); color: var(--color-text-on-primary); box-shadow: var(--shadow-sm); }
    .ce-button.variant-primary:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); box-shadow: var(--shadow-primary-glow); }
    .ce-button.variant-secondary { background: var(--color-surface); color: var(--color-text-primary); border-color: var(--color-border); }
    .ce-button.variant-secondary:hover:not(:disabled) { background: var(--color-surface-elevated); }
    .ce-button.variant-ghost { background: transparent; color: var(--color-text-primary); }
    .ce-button.variant-ghost:hover:not(:disabled) { background: var(--color-neutral-light); }
    .ce-button.variant-danger { background: var(--color-danger); color: var(--color-text-on-primary); }
    .ce-button.variant-danger:hover:not(:disabled) { background: var(--color-danger-hover); }
    .ce-button:disabled, .ce-button[aria-busy="true"] { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
    .ce-button.disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }

    .ce-card {
      background: var(--color-surface-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-card);
      overflow: hidden;
    }

    .ce-table-wrapper { overflow-x: auto; }
    .ce-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }
    .ce-table thead { background: var(--color-neutral-light); position: sticky; top: 0; }
    .ce-table th {
      text-align: left;
      padding: var(--space-3) var(--space-4);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-secondary);
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--color-border);
    }
    .ce-table td {
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text-primary);
    }
    .ce-table tbody tr:last-child td { border-bottom: 0; }
    .ce-table tbody tr:hover { background: color-mix(in oklch, var(--color-primary) 3%, transparent); }

    .action-cell {
      display: flex;
      gap: var(--space-1);
    }

    .icon-btn-sm {
      width: 2rem;
      height: 2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 0;
      border-radius: var(--radius-md);
      cursor: pointer;
      color: var(--color-text-muted);
      font-size: 1rem;
    }
    .icon-btn-sm:hover { background: var(--color-neutral-light); color: var(--color-text-primary); }

    .ce-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-weight: var(--font-weight-medium);
      border-radius: var(--radius-full);
      border: 1px solid transparent;
      font-size: var(--font-size-xs);
      line-height: 1;
    }
    .ce-badge.size-sm { padding: var(--space-1) var(--space-2); font-size: 0.7rem; }
    .ce-badge.tone-success { background: var(--color-success-light); color: var(--color-success); border-color: color-mix(in oklch, var(--color-success) 30%, transparent); }
    .ce-badge.tone-neutral { background: var(--color-neutral-light); color: var(--color-text-secondary); border-color: var(--color-border); }

    .ce-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-12) var(--space-6);
      gap: var(--space-3);
      color: var(--color-text-secondary);
    }
    .ce-empty-state-icon {
      width: 4rem;
      height: 4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-neutral-light);
      color: var(--color-text-muted);
      border-radius: var(--radius-full);
      margin-bottom: var(--space-2);
      font-size: 1.5rem;
    }
    .ce-empty-state-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
    .ce-empty-state-description { max-width: 24rem; }

    .ce-spinner {
      display: inline-block;
      border-radius: var(--radius-full);
      border: 2px solid currentColor;
      border-top-color: transparent;
      animation: spin-slow 1.4s linear infinite;
    }
    .ce-spinner.size-sm { width: 1rem; height: 1rem; border-width: 2px; }
    .ce-spinner.size-lg { width: 2rem; height: 2rem; border-width: 3px; }
    .ce-spinner.tone-primary { color: var(--color-primary); }
    .ce-spinner.tone-current { color: currentColor; }

    .ce-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: var(--space-4);
      animation: fade-in var(--duration-base) var(--ease-out);
    }
    .ce-modal {
      background: var(--color-surface-elevated);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      width: 100%;
      max-width: 32rem;
      max-height: calc(100vh - var(--space-8));
      overflow: auto;
      animation: zoom-in var(--duration-base) var(--ease-out);
    }
    .ce-modal.size-sm { max-width: 24rem; }
    .ce-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--color-border);
    }
    .ce-modal-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); }
    .ce-modal-close {
      background: transparent;
      border: 0;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: var(--space-1);
      border-radius: var(--radius-md);
      display: inline-flex;
      font-size: 1.25rem;
    }
    .ce-modal-close:hover { background: var(--color-neutral-light); color: var(--color-text-primary); }
    .ce-modal-body { padding: var(--space-6); }
    .ce-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--color-border);
    }

    .ce-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .ce-input-group { display: flex; flex-direction: column; gap: var(--space-1); }
    .ce-input-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .ce-input-wrapper {
      display: flex;
      align-items: center;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
      overflow: hidden;
    }
    .ce-input-wrapper:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 15%, transparent);
    }
    .ce-input-wrapper.has-error {
      border-color: var(--color-danger);
      box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-danger) 15%, transparent);
    }
    .ce-input {
      flex: 1;
      border: 0;
      background: transparent;
      padding: var(--space-3);
      font-family: inherit;
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      outline: none;
      min-height: 2.5rem;
    }
    .ce-input::placeholder { color: var(--color-text-muted); }
    select.ce-input { appearance: none; cursor: pointer; }
    .ce-input-error {
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

    .text-secondary { color: var(--color-text-secondary); }

    @keyframes spin-slow { to { transform: rotate(360deg); } }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes zoom-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  `],
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
    if (!apartmentId) return '\u2014';
    return this.apartmentLabels()[apartmentId] ?? apartmentId.slice(0, 8);
  }

  getVehicleTypeLabel(vehicleType: VehicleType): string {
    const found = VEHICLE_TYPES.find(vt => vt.value === vehicleType);
    return found ? found.label : String(vehicleType);
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.list().subscribe({
      next: (data) => { this.vehicles.set(data); this.loading.set(false); },
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
    this.api.create({
      plate: v.plate!,
      ownerName: v.ownerName || null,
      apartmentId: v.apartmentId || null,
      brand: v.brand || null,
      model: v.model || null,
      color: v.color || null,
      vehicleType: v.vehicleType ?? null,
    }).subscribe({
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
    this.api.update(vehicle.id, {
      plate: v.plate!,
      ownerName: v.ownerName || null,
      apartmentId: v.apartmentId || null,
      brand: v.brand || null,
      model: v.model || null,
      color: v.color || null,
      vehicleType: v.vehicleType ?? null,
    }).subscribe({
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

  // ---------- Photo gallery (Phase 12) ----------

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
