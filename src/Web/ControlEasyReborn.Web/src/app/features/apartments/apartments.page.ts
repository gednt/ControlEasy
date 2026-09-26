import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApartmentsApiService, ApartmentResponse, formatApartmentLabel } from './apartments-api.service';
import { ResidentsApiService, ResidentResponse } from '../residents/residents-api.service';
import { cpfValidator } from '../../core/validators/cpf.validator';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'ce-apartments-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Apartments</h1>
        <p class="page-subtitle">{{ apartments().length }} apartments registered in this condominium.</p>
      </div>
      <div class="page-header-actions">
        <button class="ce-button variant-secondary size-md" (click)="refresh()">&#8635; Refresh</button>
        @if (canWrite()) {
          <button class="ce-button variant-primary size-md" (click)="openCreateModal()">&#43; Add apartment</button>
        }
      </div>
    </div>

    @if (pageError()) {
      <div class="page-error">{{ pageError() }}</div>
    }

    @if (loading()) {
      <div class="loading-state">
        <div class="ce-spinner tone-primary size-lg"></div>
        <p>Loading apartments...</p>
      </div>
    } @else if (apartments().length === 0) {
      <div class="ce-empty-state">
        <div class="ce-empty-state-icon">&#127968;</div>
        <div class="ce-empty-state-title">No apartments yet</div>
        <div class="ce-empty-state-description text-secondary">Add your first apartment to get started.</div>
        @if (canWrite()) {
          <button class="ce-button variant-primary size-md" (click)="openCreateModal()">&#43; Add apartment</button>
        }
      </div>
    } @else {
      <div class="ce-card" style="padding: 0;">
        <div class="ce-table-wrapper">
          <table class="ce-table" aria-label="Apartments table">
            <thead>
              <tr>
                <th scope="col">Block</th>
                <th scope="col">Unit</th>
                <th scope="col">Label</th>
                <th scope="col">Status</th>
                <th scope="col" style="width: 1%;"></th>
              </tr>
            </thead>
            <tbody>
              @for (apartment of apartments(); track apartment.id) {
                <tr>
                  <td>{{ apartment.block }}</td>
                  <td>{{ apartment.unit }}</td>
                  <td>{{ formatLabel(apartment) }}</td>
                  <td>
                    <span class="ce-badge tone-success size-sm" [class.tone-neutral]="!apartment.active">
                      {{ apartment.active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>
                    @if (canWrite()) {
                      <div class="action-cell">
                        <button
                          class="icon-btn-sm"
                          aria-label="Edit apartment"
                          title="Edit"
                          (click)="openEditModal(apartment)"
                        >
                          &#9998;
                        </button>
                        @if (apartment.active) {
                          <button
                            class="icon-btn-sm action-deactivate"
                            aria-label="Deactivate apartment"
                            title="Deactivate"
                            (click)="onDeactivate(apartment)"
                          >
                            &#8855;
                          </button>
                        }
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (createModalOpen()) {
      <div class="ce-modal-backdrop" (click)="closeCreateModal()">
        <div class="ce-modal size-md" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="ce-modal-header">
            <h3 class="ce-modal-title">Add apartment</h3>
            <button class="ce-modal-close" (click)="closeCreateModal()" aria-label="Close">&#10005;</button>
          </div>
          <div class="ce-modal-body">
            @if (createError()) {
              <div class="form-error-banner">{{ createError() }}</div>
            }
            <form class="ce-form" [formGroup]="createForm" (ngSubmit)="onCreate()">
              <div class="form-row">
                <div class="ce-input-group" style="flex: 1;">
                  <label class="ce-input-label" for="ap-block">Block</label>
                  <div
                    class="ce-input-wrapper"
                    [class.has-error]="createForm.get('block')?.invalid && createForm.get('block')?.touched"
                  >
                    <input id="ap-block" class="ce-input" placeholder="e.g. A" formControlName="block" />
                  </div>
                  @if (createForm.get('block')?.invalid && createForm.get('block')?.touched) {
                    <div class="ce-input-error">Block is required</div>
                  }
                </div>
                <div class="ce-input-group" style="flex: 1;">
                  <label class="ce-input-label" for="ap-unit">Unit</label>
                  <div
                    class="ce-input-wrapper"
                    [class.has-error]="createForm.get('unit')?.invalid && createForm.get('unit')?.touched"
                  >
                    <input id="ap-unit" class="ce-input" placeholder="e.g. 101" formControlName="unit" />
                  </div>
                  @if (createForm.get('unit')?.invalid && createForm.get('unit')?.touched) {
                    <div class="ce-input-error">Unit is required</div>
                  }
                </div>
              </div>
            </form>
          </div>
          <div class="ce-modal-footer">
            <button class="ce-button variant-ghost size-sm" (click)="closeCreateModal()">Cancel</button>
            <button
              class="ce-button variant-primary size-sm"
              (click)="onCreate()"
              [disabled]="createForm.invalid || creating()"
            >
              @if (creating()) {
                <span class="ce-spinner tone-current size-sm"></span>
              }
              Add apartment
            </button>
          </div>
        </div>
      </div>
    }

    @if (editModalOpen()) {
      <div class="ce-modal-backdrop" (click)="closeEditModal()">
        <div class="ce-modal size-lg" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="ce-modal-header">
            <h3 class="ce-modal-title">Edit apartment</h3>
            <button class="ce-modal-close" (click)="closeEditModal()" aria-label="Close">&#10005;</button>
          </div>
          <div class="ce-modal-body">
            @if (editError()) {
              <div class="form-error-banner">{{ editError() }}</div>
            }
            <form class="ce-form" [formGroup]="editForm" (ngSubmit)="onEdit()">
              <div class="form-row">
                <div class="ce-input-group" style="flex: 1;">
                  <label class="ce-input-label" for="ep-block">Block</label>
                  <div
                    class="ce-input-wrapper"
                    [class.has-error]="editForm.get('block')?.invalid && editForm.get('block')?.touched"
                  >
                    <input id="ep-block" class="ce-input" formControlName="block" />
                  </div>
                </div>
                <div class="ce-input-group" style="flex: 1;">
                  <label class="ce-input-label" for="ep-unit">Unit</label>
                  <div
                    class="ce-input-wrapper"
                    [class.has-error]="editForm.get('unit')?.invalid && editForm.get('unit')?.touched"
                  >
                    <input id="ep-unit" class="ce-input" formControlName="unit" />
                  </div>
                </div>
              </div>
            </form>

            <div class="ce-section-divider"></div>

            <div class="residents-section">
              <div class="residents-section-header">
                <h4 class="residents-section-title">Residents</h4>
                @if (canWriteResidents()) {
                  <button class="ce-button variant-secondary size-sm" (click)="toggleAddResident()">
                    {{ addResidentOpen() ? '&#10005; Cancel' : '&#43; Add resident' }}
                  </button>
                }
              </div>

              @if (residentsLoading()) {
                <div class="loading-state-inline">
                  <div class="ce-spinner tone-primary size-sm"></div>
                  <span class="text-secondary">Loading residents...</span>
                </div>
              } @else if (residentsError()) {
                <div class="form-error-banner">{{ residentsError() }}</div>
              } @else if (activeResidents().length === 0 && !addResidentOpen()) {
                <div class="ce-empty-state-inline">
                  <p class="text-secondary">No active residents in this apartment.</p>
                </div>
              } @else {
                <div class="residents-list">
                  @for (resident of activeResidents(); track resident.id) {
                    <div class="resident-row">
                      <div class="resident-info">
                        <span class="resident-name font-semibold">{{ resident.name }}</span>
                        <span class="resident-cpf text-secondary">{{ resident.cpf }}</span>
                        @if (resident.phone) {
                          <span class="resident-phone text-secondary">{{ resident.phone }}</span>
                        }
                      </div>
                      @if (canWriteResidents()) {
                        <button
                          class="icon-btn-sm action-deactivate"
                          aria-label="Deactivate resident"
                          title="Deactivate"
                          [disabled]="deactivatingResidentId() === resident.id"
                          (click)="onDeactivateResident(resident)"
                        >
                          @if (deactivatingResidentId() === resident.id) {
                            <span class="ce-spinner tone-current size-sm"></span>
                          }
                          &#8855;
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              @if (addResidentOpen() && canWriteResidents()) {
                <div class="add-resident-form">
                  @if (addResidentError()) {
                    <div class="form-error-banner">{{ addResidentError() }}</div>
                  }
                  <form class="ce-form" [formGroup]="addResidentForm" (ngSubmit)="onAddResident()">
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="ar-name">Full name</label>
                      <div
                        class="ce-input-wrapper"
                        [class.has-error]="addResidentForm.get('name')?.invalid && addResidentForm.get('name')?.touched"
                      >
                        <input id="ar-name" class="ce-input" placeholder="e.g. Maria Silva" formControlName="name" />
                      </div>
                      @if (addResidentForm.get('name')?.invalid && addResidentForm.get('name')?.touched) {
                        <div class="ce-input-error">Name is required</div>
                      }
                    </div>
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="ar-cpf">CPF</label>
                      <div
                        class="ce-input-wrapper"
                        [class.has-error]="addResidentForm.get('cpf')?.invalid && addResidentForm.get('cpf')?.touched"
                      >
                        <input id="ar-cpf" class="ce-input" placeholder="000.000.000-00" formControlName="cpf" />
                      </div>
                      @if (addResidentForm.get('cpf')?.hasError('required') && addResidentForm.get('cpf')?.touched) {
                        <div class="ce-input-error">CPF is required</div>
                      } @else if (
                        addResidentForm.get('cpf')?.hasError('invalidCpf') && addResidentForm.get('cpf')?.touched
                      ) {
                        <div class="ce-input-error">CPF check digits are invalid</div>
                      }
                    </div>
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="ar-phone">Phone</label>
                      <div class="ce-input-wrapper">
                        <input id="ar-phone" class="ce-input" placeholder="(11) 99999-0000" formControlName="phone" />
                      </div>
                    </div>
                    <div class="add-resident-actions">
                      <button
                        class="ce-button variant-primary size-sm"
                        type="submit"
                        [disabled]="addResidentForm.invalid || addingResident()"
                      >
                        @if (addingResident()) {
                          <span class="ce-spinner tone-current size-sm"></span>
                        }
                        Add resident
                      </button>
                    </div>
                  </form>
                </div>
              }
            </div>

            @if (confirmDeactivateResidentOpen()) {
              <div class="confirm-deactivate-inline">
                @if (deactivateResidentError()) {
                  <div class="form-error-banner">{{ deactivateResidentError() }}</div>
                }
                <p class="text-secondary">
                  Deactivate <strong>{{ residentToDeactivate()?.name }}</strong
                  >? They will no longer be able to access the condominium.
                </p>
                <div class="confirm-deactivate-actions">
                  <button class="ce-button variant-ghost size-sm" (click)="cancelDeactivateResident()">Cancel</button>
                  <button
                    class="ce-button variant-danger size-sm"
                    (click)="confirmDeactivateResident()"
                    [disabled]="deactivatingResidentId() !== null"
                  >
                    @if (deactivatingResidentId() !== null) {
                      <span class="ce-spinner tone-current size-sm"></span>
                    }
                    Deactivate
                  </button>
                </div>
              </div>
            }
          </div>
          <div class="ce-modal-footer">
            <button class="ce-button variant-ghost size-sm" (click)="closeEditModal()">Cancel</button>
            <button
              class="ce-button variant-primary size-sm"
              (click)="onEdit()"
              [disabled]="editForm.invalid || saving()"
            >
              @if (saving()) {
                <span class="ce-spinner tone-current size-sm"></span>
              }
              Save changes
            </button>
          </div>
        </div>
      </div>
    }

    @if (confirmDeactivateOpen()) {
      <div class="ce-modal-backdrop" (click)="closeDeactivateConfirm()">
        <div class="ce-modal size-sm" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="ce-modal-header">
            <h3 class="ce-modal-title">Deactivate apartment</h3>
            <button class="ce-modal-close" (click)="closeDeactivateConfirm()" aria-label="Close">&#10005;</button>
          </div>
          <div class="ce-modal-body">
            @if (deactivateError()) {
              <div class="form-error-banner">{{ deactivateError() }}</div>
            }
            <p class="text-secondary">
              Deactivate <strong>{{ apartmentToDeactivate() ? formatLabel(apartmentToDeactivate()!) : '' }}</strong
              >? Existing resident and visit records will keep their references.
            </p>
          </div>
          <div class="ce-modal-footer">
            <button class="ce-button variant-ghost size-sm" (click)="closeDeactivateConfirm()">Cancel</button>
            <button
              class="ce-button variant-danger size-sm"
              (click)="onConfirmDeactivate()"
              [disabled]="deactivating()"
            >
              @if (deactivating()) {
                <span class="ce-spinner tone-current size-sm"></span>
              }
              Deactivate
            </button>
          </div>
        </div>
      </div>
    }
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
        padding: var(--space-3) var(--space-4);
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
      .ce-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        font-weight: var(--font-weight-medium);
        border: 1px solid transparent;
        border-radius: var(--radius-lg);
        cursor: pointer;
        font-family: inherit;
      }
      .ce-button.size-sm {
        height: 2rem;
        padding: 0 var(--space-3);
        font-size: var(--font-size-sm);
      }
      .ce-button.size-md {
        height: 2.5rem;
        padding: 0 var(--space-4);
        font-size: var(--font-size-sm);
      }
      .ce-button.variant-primary {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
      }
      .ce-button.variant-secondary {
        background: var(--color-surface);
        color: var(--color-text-primary);
        border-color: var(--color-border);
      }
      .ce-button.variant-ghost {
        background: transparent;
        color: var(--color-text-primary);
      }
      .ce-button.variant-danger {
        background: var(--color-danger);
        color: var(--color-text-on-primary);
      }
      .ce-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .ce-card {
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-card);
        overflow: hidden;
      }
      .ce-table-wrapper {
        overflow-x: auto;
      }
      .ce-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
      }
      .ce-table thead {
        background: var(--color-neutral-light);
      }
      .ce-table th,
      .ce-table td {
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        text-align: left;
      }
      .ce-table th {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
        text-transform: uppercase;
      }
      .ce-badge {
        display: inline-flex;
        align-items: center;
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-full);
        border: 1px solid transparent;
        font-size: 0.7rem;
        padding: var(--space-1) var(--space-2);
      }
      .ce-badge.tone-success {
        background: var(--color-success-light);
        color: var(--color-success);
      }
      .ce-badge.tone-neutral {
        background: var(--color-neutral-light);
        color: var(--color-text-secondary);
      }
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
      .icon-btn-sm:hover {
        background: var(--color-neutral-light);
        color: var(--color-text-primary);
      }
      .icon-btn-sm:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .action-deactivate:hover {
        background: var(--color-danger-light);
        color: var(--color-danger);
      }
      .ce-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: var(--space-12);
        gap: var(--space-3);
      }
      .ce-empty-state-icon {
        font-size: 1.5rem;
        width: 4rem;
        height: 4rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-neutral-light);
        border-radius: var(--radius-full);
      }
      .ce-empty-state-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
      }
      .ce-spinner {
        display: inline-block;
        border-radius: var(--radius-full);
        border: 2px solid currentColor;
        border-top-color: transparent;
        animation: spin 1.4s linear infinite;
      }
      .ce-spinner.size-sm {
        width: 1rem;
        height: 1rem;
      }
      .ce-spinner.size-lg {
        width: 2rem;
        height: 2rem;
        border-width: 3px;
      }
      .ce-spinner.tone-primary {
        color: var(--color-primary);
      }
      .ce-spinner.tone-current {
        color: currentColor;
      }
      .ce-modal-backdrop {
        position: fixed;
        inset: 0;
        background: var(--color-modal-backdrop);
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
      .ce-modal.size-sm {
        max-width: 24rem;
      }
      .ce-modal.size-lg {
        max-width: 42rem;
      }
      .ce-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-5) var(--space-6);
        border-bottom: 1px solid var(--color-border);
      }
      .ce-modal-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
      }
      .ce-modal-close {
        background: transparent;
        border: 0;
        cursor: pointer;
        font-size: 1.25rem;
        color: var(--color-text-muted);
      }
      .ce-modal-close:hover {
        background: var(--color-neutral-light);
        color: var(--color-text-primary);
      }
      .ce-modal-body {
        padding: var(--space-6);
      }
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
      .ce-input-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .ce-input-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
      }
      .ce-input-wrapper {
        display: flex;
        align-items: center;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
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
        width: 100%;
      }
      .ce-input::placeholder {
        color: var(--color-text-muted);
      }
      .ce-input-error {
        font-size: var(--font-size-xs);
        color: var(--color-danger);
      }
      .form-row {
        display: flex;
        gap: var(--space-3);
      }
      .form-error-banner {
        margin-bottom: var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-lg);
        background: var(--color-danger-light);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
      }
      .text-secondary {
        color: var(--color-text-secondary);
      }
      .font-semibold {
        font-weight: var(--font-weight-semibold);
      }

      .ce-section-divider {
        border: 0;
        border-top: 1px solid var(--color-border);
        margin: var(--space-6) 0 var(--space-4);
      }

      .residents-section {
      }
      .residents-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-3);
      }
      .residents-section-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        margin: 0;
      }

      .loading-state-inline {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-4) 0;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
      .ce-empty-state-inline {
        padding: var(--space-4) 0;
        text-align: center;
      }
      .ce-empty-state-inline p {
        margin: 0;
        font-size: var(--font-size-sm);
      }

      .residents-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        margin-bottom: var(--space-3);
      }
      .resident-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        transition: background var(--duration-fast) var(--ease-out);
      }
      .resident-row:hover {
        background: color-mix(in oklch, var(--color-primary) 4%, transparent);
      }
      .resident-info {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-width: 0;
      }
      .resident-name {
        font-size: var(--font-size-sm);
      }
      .resident-cpf {
        font-size: var(--font-size-xs);
      }
      .resident-phone {
        font-size: var(--font-size-xs);
      }

      .add-resident-form {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        margin-top: var(--space-2);
        background: var(--color-surface);
      }
      .add-resident-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--space-2);
      }

      .confirm-deactivate-inline {
        margin-top: var(--space-3);
        padding: var(--space-4);
        border-radius: var(--radius-lg);
        background: var(--color-danger-light);
      }
      .confirm-deactivate-inline p {
        margin: 0 0 var(--space-3) 0;
      }
      .confirm-deactivate-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes zoom-in {
        from {
          opacity: 0;
          transform: scale(0.96);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApartmentsPage {
  private readonly api = inject(ApartmentsApiService);
  private readonly residentsApi = inject(ResidentsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly canWrite = computed(() => this.auth.hasPermission('Apartments.Write'));
  readonly canWriteResidents = computed(() => this.auth.hasPermission('Residents.Write'));

  apartments = signal<ApartmentResponse[]>([]);
  loading = signal(true);
  creating = signal(false);
  saving = signal(false);
  deactivating = signal(false);
  createModalOpen = signal(false);
  editModalOpen = signal(false);
  confirmDeactivateOpen = signal(false);
  pageError = signal<string | null>(null);
  createError = signal<string | null>(null);
  editError = signal<string | null>(null);
  deactivateError = signal<string | null>(null);
  editingApartment = signal<ApartmentResponse | null>(null);
  apartmentToDeactivate = signal<ApartmentResponse | null>(null);

  // Residents section
  residents = signal<ResidentResponse[]>([]);
  residentsLoading = signal(false);
  residentsError = signal<string | null>(null);
  addResidentOpen = signal(false);
  addingResident = signal(false);
  addResidentError = signal<string | null>(null);
  confirmDeactivateResidentOpen = signal(false);
  residentToDeactivate = signal<ResidentResponse | null>(null);
  deactivatingResidentId = signal<string | null>(null);
  deactivateResidentError = signal<string | null>(null);

  activeResidents = computed(() => this.residents().filter((r) => r.active));

  readonly formatLabel = formatApartmentLabel;

  createForm = this.fb.group({
    block: ['', Validators.required],
    unit: ['', Validators.required],
  });

  editForm = this.fb.group({
    block: ['', Validators.required],
    unit: ['', Validators.required],
  });

  addResidentForm = this.fb.group({
    name: ['', [Validators.required]],
    cpf: ['', [Validators.required, cpfValidator()]],
    phone: [null],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.list(undefined, 0, 500).subscribe({
      next: (data) => {
        this.apartments.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.pageError.set(getApiErrorMessage(err, 'Failed to load apartments'));
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
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  onCreate(): void {
    if (this.createForm.invalid) return;
    this.creating.set(true);
    this.createError.set(null);
    const v = this.createForm.value;
    this.api.create({ block: v.block!, unit: v.unit! }).subscribe({
      next: () => {
        this.creating.set(false);
        this.closeCreateModal();
        this.load();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(getApiErrorMessage(err, 'Failed to create apartment'));
      },
    });
  }

  openEditModal(apartment: ApartmentResponse): void {
    this.editingApartment.set(apartment);
    this.editForm.patchValue({ block: apartment.block, unit: apartment.unit });
    this.editError.set(null);
    this.addResidentOpen.set(false);
    this.addResidentError.set(null);
    this.confirmDeactivateResidentOpen.set(false);
    this.residentToDeactivate.set(null);
    this.deactivateResidentError.set(null);
    this.residentsError.set(null);
    this.editModalOpen.set(true);
    this.loadResidents(apartment.id);
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
    this.editingApartment.set(null);
    this.residents.set([]);
  }

  loadResidents(apartmentId: string): void {
    this.residentsLoading.set(true);
    this.residentsError.set(null);
    this.residentsApi.list(undefined, 0, 100, apartmentId).subscribe({
      next: (data) => {
        this.residents.set(data);
        this.residentsLoading.set(false);
      },
      error: (err) => {
        this.residentsError.set(getApiErrorMessage(err, 'Failed to load residents'));
        this.residentsLoading.set(false);
      },
    });
  }

  toggleAddResident(): void {
    const isOpen = this.addResidentOpen();
    this.addResidentOpen.set(!isOpen);
    this.addResidentError.set(null);
    if (!isOpen) {
      this.addResidentForm.reset();
    }
  }

  onAddResident(): void {
    if (this.addResidentForm.invalid) return;
    const apartment = this.editingApartment();
    if (!apartment) return;
    this.addingResident.set(true);
    this.addResidentError.set(null);
    const v = this.addResidentForm.value;
    this.residentsApi
      .create({
        name: v.name!,
        cpf: v.cpf!,
        phone: v.phone ?? null,
        apartmentId: apartment.id,
      })
      .subscribe({
        next: () => {
          this.addingResident.set(false);
          this.addResidentForm.reset();
          this.addResidentOpen.set(false);
          this.loadResidents(apartment.id);
        },
        error: (err) => {
          this.addingResident.set(false);
          this.addResidentError.set(getApiErrorMessage(err, 'Failed to add resident'));
        },
      });
  }

  onDeactivateResident(resident: ResidentResponse): void {
    this.deactivateResidentError.set(null);
    this.residentToDeactivate.set(resident);
    this.confirmDeactivateResidentOpen.set(true);
  }

  cancelDeactivateResident(): void {
    this.confirmDeactivateResidentOpen.set(false);
    this.residentToDeactivate.set(null);
    this.deactivateResidentError.set(null);
    this.deactivatingResidentId.set(null);
  }

  confirmDeactivateResident(): void {
    const resident = this.residentToDeactivate();
    if (!resident) return;
    const apartment = this.editingApartment();
    if (!apartment) return;
    this.deactivatingResidentId.set(resident.id);
    this.deactivateResidentError.set(null);
    this.residentsApi
      .deactivate(resident.id, resident.name, resident.cpf, resident.email, resident.phone, resident.apartmentId)
      .subscribe({
        next: () => {
          this.deactivatingResidentId.set(null);
          this.confirmDeactivateResidentOpen.set(false);
          this.residentToDeactivate.set(null);
          this.loadResidents(apartment.id);
        },
        error: (err) => {
          this.deactivatingResidentId.set(null);
          this.deactivateResidentError.set(getApiErrorMessage(err, 'Failed to deactivate resident'));
        },
      });
  }

  onEdit(): void {
    if (this.editForm.invalid) return;
    const apartment = this.editingApartment();
    if (!apartment) return;
    this.saving.set(true);
    this.editError.set(null);
    const v = this.editForm.value;
    this.api
      .update(apartment.id, {
        block: v.block!,
        unit: v.unit!,
        active: apartment.active,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEditModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(getApiErrorMessage(err, 'Failed to update apartment'));
        },
      });
  }

  onDeactivate(apartment: ApartmentResponse): void {
    this.apartmentToDeactivate.set(apartment);
    this.deactivateError.set(null);
    this.confirmDeactivateOpen.set(true);
  }

  closeDeactivateConfirm(): void {
    this.confirmDeactivateOpen.set(false);
    this.apartmentToDeactivate.set(null);
  }

  onConfirmDeactivate(): void {
    const apartment = this.apartmentToDeactivate();
    if (!apartment) return;
    this.deactivating.set(true);
    this.deactivateError.set(null);
    this.api.deactivate(apartment.id, apartment.block, apartment.unit).subscribe({
      next: () => {
        this.deactivating.set(false);
        this.closeDeactivateConfirm();
        this.load();
      },
      error: (err) => {
        this.deactivating.set(false);
        this.deactivateError.set(getApiErrorMessage(err, 'Failed to deactivate apartment'));
      },
    });
  }
}
