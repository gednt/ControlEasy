import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TenantsApiService, TenantResponse, TenantAdminResponse, PorteiroResponse } from './tenants-api.service';
import { AuthService } from '../../core/services/auth.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { formatRuntimeDate } from '../../core/config/runtime-config';

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

@Component({
  selector: 'ce-condominiums-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Condominiums</h1>
        <p class="page-subtitle">{{ tenants().length }} condominiums registered on this platform.</p>
      </div>
      <div class="page-header-actions">
        <button class="ce-button variant-secondary size-md" (click)="refresh()">&#8635; Refresh</button>
        <button class="ce-button variant-primary size-md" (click)="openCreateModal()">&#43; Register condominium</button>
      </div>
    </div>

    @if (pageError()) {
      <div class="page-error">{{ pageError() }}</div>
    }

    @if (loading()) {
      <div class="loading-state">
        <div class="ce-spinner tone-primary size-lg"></div>
        <p>Loading condominiums...</p>
      </div>
    } @else if (tenants().length === 0) {
      <div class="ce-empty-state">
        <div class="ce-empty-state-icon">&#127970;</div>
        <div class="ce-empty-state-title">No condominiums yet</div>
        <div class="ce-empty-state-description text-secondary">Register your first condominium to start onboarding tenant administrators.</div>
        <button class="ce-button variant-primary size-md" (click)="openCreateModal()">&#43; Register condominium</button>
      </div>
    } @else {
      <div class="ce-card" style="padding: 0;">
        <div class="ce-table-wrapper">
          <table class="ce-table" aria-label="Condominiums table">
            <thead>
              <tr>
                <th scope="col">Display name</th>
                <th scope="col">Slug</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col" style="width: 1%;"></th>
              </tr>
            </thead>
            <tbody>
              @for (tenant of tenants(); track tenant.id) {
                <tr>
                  <td>{{ tenant.displayName }}</td>
                  <td><code class="slug-code">{{ tenant.slug }}</code></td>
                  <td>
                    <span class="ce-badge size-sm"
                          [class.tone-success]="tenant.status === 'Active'"
                          [class.tone-neutral]="tenant.status !== 'Active'">
                      {{ tenant.status }}
                    </span>
                  </td>
                  <td>{{ formatDate(tenant.createdAtUtc) }}</td>
                  <td>
                    <div class="action-cell">
                      <button class="ce-button variant-ghost size-sm"
                              (click)="openManageModal(tenant)">
                        Manage
                      </button>
                      @if (tenant.status === 'Active') {
                        <button class="ce-button variant-ghost size-sm"
                                (click)="onSuspend(tenant)"
                                [disabled]="actionTenantId() === tenant.id">
                          Suspend
                        </button>
                      } @else {
                        <button class="ce-button variant-ghost size-sm"
                                (click)="onResume(tenant)"
                                [disabled]="actionTenantId() === tenant.id">
                          Resume
                        </button>
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

    @if (createModalOpen()) {
      <div class="ce-modal-backdrop" (click)="closeCreateModal()">
        <div class="ce-modal size-md" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="ce-modal-header">
            <h3 class="ce-modal-title">Register condominium</h3>
            <button class="ce-modal-close" (click)="closeCreateModal()" aria-label="Close">&#10005;</button>
          </div>
          <div class="ce-modal-body">
            @if (createError()) {
              <div class="form-error-banner">{{ createError() }}</div>
            }
            <form class="ce-form" [formGroup]="createForm" (ngSubmit)="onCreate()">
              <div class="ce-input-group">
                <label class="ce-input-label" for="tenant-display-name">Display name</label>
                <div class="ce-input-wrapper" [class.has-error]="createForm.get('displayName')?.invalid && createForm.get('displayName')?.touched">
                  <input id="tenant-display-name" class="ce-input" placeholder="e.g. Residencial Aurora" formControlName="displayName" />
                </div>
                @if (createForm.get('displayName')?.invalid && createForm.get('displayName')?.touched) {
                  <div class="ce-input-error">Display name is required</div>
                }
              </div>
              <div class="ce-input-group">
                <label class="ce-input-label" for="tenant-slug">Slug</label>
                <div class="ce-input-wrapper" [class.has-error]="createForm.get('slug')?.invalid && createForm.get('slug')?.touched">
                  <input id="tenant-slug" class="ce-input" placeholder="e.g. residencial-aurora" formControlName="slug" />
                </div>
                @if (createForm.get('slug')?.invalid && createForm.get('slug')?.touched) {
                  <div class="ce-input-error">Lowercase letters, numbers, and dashes only (1-32 chars)</div>
                }
              </div>

              <div class="admin-fields">
                <p class="admin-fields-title">First administrator</p>
                <div class="ce-input-group">
                  <label class="ce-input-label" for="admin-email">Admin email</label>
                  <div class="ce-input-wrapper" [class.has-error]="createForm.get('adminEmail')?.invalid && createForm.get('adminEmail')?.touched">
                    <input id="admin-email" class="ce-input" type="email" formControlName="adminEmail" />
                  </div>
                </div>
                <div class="ce-input-group">
                  <label class="ce-input-label" for="admin-display-name">Admin display name</label>
                  <div class="ce-input-wrapper" [class.has-error]="createForm.get('adminDisplayName')?.invalid && createForm.get('adminDisplayName')?.touched">
                    <input id="admin-display-name" class="ce-input" formControlName="adminDisplayName" />
                  </div>
                </div>
                <div class="ce-input-group">
                  <label class="ce-input-label" for="admin-password">Temporary password</label>
                  <div class="ce-input-wrapper" [class.has-error]="createForm.get('adminPassword')?.invalid && createForm.get('adminPassword')?.touched">
                    <input id="admin-password" class="ce-input" type="password" formControlName="adminPassword" />
                  </div>
                  @if (createForm.get('adminPassword')?.invalid && createForm.get('adminPassword')?.touched) {
                    <div class="ce-input-error">Password must be at least 8 characters</div>
                  }
                </div>
              </div>
            </form>
          </div>
          <div class="ce-modal-footer">
            <button class="ce-button variant-ghost size-sm" (click)="closeCreateModal()">Cancel</button>
            <button class="ce-button variant-primary size-sm"
                    (click)="onCreate()"
                    [disabled]="createForm.invalid || creating()">
              @if (creating()) { <span class="ce-spinner tone-current size-sm"></span> }
              Register
            </button>
          </div>
        </div>
      </div>
    }

    @if (manageModalOpen()) {
      <div class="ce-modal-backdrop" (click)="closeManageModal()">
        <div class="ce-modal size-lg" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="ce-modal-header">
            <h3 class="ce-modal-title">Manage {{ manageTenant()?.displayName }}</h3>
            <button class="ce-modal-close" (click)="closeManageModal()" aria-label="Close">&#10005;</button>
          </div>
          <div class="ce-modal-body">
            @if (manageError()) {
              <div class="form-error-banner">{{ manageError() }}</div>
            }

            @if (manageLoading()) {
              <div class="loading-inline">
                <span class="ce-spinner tone-primary size-sm"></span>
                Loading staff...
              </div>
            } @else {
              <section class="manage-section">
                <div class="manage-section-header">
                  <h4>Administrators</h4>
                </div>
                @if (admins().length === 0) {
                  <p class="manage-empty">No administrators registered for this condominium. Add the first one below.</p>
                } @else {
                  <div class="manage-table-wrap">
                    <table class="manage-table" aria-label="Administrators">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Display name</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (admin of admins(); track admin.userId) {
                          <tr>
                            @if (editingAdminId() === admin.userId) {
                              <td colspan="4">
                                <form class="inline-edit-form" [formGroup]="adminEditForm" (ngSubmit)="saveAdminEdit(admin)">
                                  <div class="inline-edit-fields">
                                    <input class="ce-input" type="email" formControlName="email" placeholder="Email" />
                                    <input class="ce-input" formControlName="displayName" placeholder="Display name" />
                                  </div>
                                  <div class="inline-edit-actions">
                                    <button type="button" class="ce-button variant-ghost size-sm" (click)="cancelAdminEdit()">Cancel</button>
                                    <button type="submit" class="ce-button variant-primary size-sm"
                                            [disabled]="adminEditForm.invalid || savingAdmin()">
                                      @if (savingAdmin()) { <span class="ce-spinner tone-current size-sm"></span> }
                                      Save
                                    </button>
                                  </div>
                                </form>
                              </td>
                            } @else {
                              <td>{{ admin.email }}</td>
                              <td>{{ admin.displayName }}</td>
                              <td>
                                <span class="ce-badge size-sm"
                                      [class.tone-success]="admin.active"
                                      [class.tone-neutral]="!admin.active">
                                  {{ admin.active ? 'Active' : 'Suspended' }}
                                </span>
                              </td>
                              <td>
                                <div class="action-cell">
                                  <button class="ce-button variant-ghost size-sm" (click)="startAdminEdit(admin)">Edit</button>
                                  @if (admin.active) {
                                    <button class="ce-button variant-ghost size-sm"
                                            (click)="onSuspendAdmin(admin)"
                                            [disabled]="actingAdminId() === admin.userId">
                                      Suspend
                                    </button>
                                  } @else {
                                    <button class="ce-button variant-ghost size-sm"
                                            (click)="onResumeAdmin(admin)"
                                            [disabled]="actingAdminId() === admin.userId">
                                      Resume
                                    </button>
                                  }
                                  <button class="ce-button variant-ghost size-sm"
                                          (click)="onRevokeAdmin(admin)"
                                          [disabled]="actingAdminId() === admin.userId">
                                    Revoke
                                  </button>
                                  <button class="ce-button variant-ghost size-sm"
                                          (click)="onResetUserPassword(admin.userId, admin.displayName || admin.email)"
                                          [disabled]="resettingUserId() === admin.userId">
                                    Reset pw
                                  </button>
                                  <button class="ce-button variant-ghost size-sm danger-action"
                                          (click)="onDeleteAdmin(admin)"
                                          [disabled]="actingAdminId() === admin.userId">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                <form class="porteiro-form" [formGroup]="adminCreateForm" (ngSubmit)="onCreateAdmin()">
                  <p class="porteiro-form-title">Add administrator</p>
                  <div class="porteiro-form-grid">
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="admin-create-email">Email</label>
                      <div class="ce-input-wrapper" [class.has-error]="adminCreateForm.get('email')?.invalid && adminCreateForm.get('email')?.touched">
                        <input id="admin-create-email" class="ce-input" type="email" formControlName="email" />
                      </div>
                    </div>
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="admin-create-display-name">Display name</label>
                      <div class="ce-input-wrapper" [class.has-error]="adminCreateForm.get('displayName')?.invalid && adminCreateForm.get('displayName')?.touched">
                        <input id="admin-create-display-name" class="ce-input" formControlName="displayName" />
                      </div>
                    </div>
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="admin-create-password">Temporary password</label>
                      <div class="ce-input-wrapper" [class.has-error]="adminCreateForm.get('password')?.invalid && adminCreateForm.get('password')?.touched">
                        <input id="admin-create-password" class="ce-input" type="password" formControlName="password" />
                      </div>
                      @if (adminCreateForm.get('password')?.invalid && adminCreateForm.get('password')?.touched) {
                        <div class="ce-input-error">Password must be at least 8 characters</div>
                      }
                    </div>
                  </div>
                  <button type="submit" class="ce-button variant-primary size-sm"
                          [disabled]="adminCreateForm.invalid || creatingAdmin()">
                    @if (creatingAdmin()) { <span class="ce-spinner tone-current size-sm"></span> }
                    Add administrator
                  </button>
                </form>
              </section>

              <section class="manage-section">
                <div class="manage-section-header">
                  <h4>Porteiros (gatekeepers)</h4>
                </div>
                @if (porteiros().length > 0) {
                  <div class="manage-table-wrap">
                    <table class="manage-table" aria-label="Porteiros">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Display name</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (porteiro of porteiros(); track porteiro.userId) {
                          <tr>
                            @if (editingPorteiroId() === porteiro.userId) {
                              <td colspan="4">
                                <form class="inline-edit-form" [formGroup]="porteiroEditForm" (ngSubmit)="savePorteiroEdit(porteiro)">
                                  <div class="inline-edit-fields">
                                    <input class="ce-input" type="email" formControlName="email" placeholder="Email" />
                                    <input class="ce-input" formControlName="displayName" placeholder="Display name" />
                                  </div>
                                  <div class="inline-edit-actions">
                                    <button type="button" class="ce-button variant-ghost size-sm" (click)="cancelPorteiroEdit()">Cancel</button>
                                    <button type="submit" class="ce-button variant-primary size-sm"
                                            [disabled]="porteiroEditForm.invalid || savingPorteiro()">
                                      @if (savingPorteiro()) { <span class="ce-spinner tone-current size-sm"></span> }
                                      Save
                                    </button>
                                  </div>
                                </form>
                              </td>
                            } @else {
                              <td>{{ porteiro.email }}</td>
                              <td>{{ porteiro.displayName }}</td>
                              <td>
                                <span class="ce-badge size-sm"
                                      [class.tone-success]="porteiro.active"
                                      [class.tone-neutral]="!porteiro.active">
                                  {{ porteiro.active ? 'Active' : 'Suspended' }}
                                </span>
                              </td>
                              <td>
                                <div class="action-cell">
                                  <button class="ce-button variant-ghost size-sm" (click)="startPorteiroEdit(porteiro)">Edit</button>
                                  @if (porteiro.active) {
                                    <button class="ce-button variant-ghost size-sm"
                                            (click)="onSuspendPorteiro(porteiro)"
                                            [disabled]="actingPorteiroId() === porteiro.userId">
                                      Suspend
                                    </button>
                                  } @else {
                                    <button class="ce-button variant-ghost size-sm"
                                            (click)="onResumePorteiro(porteiro)"
                                            [disabled]="actingPorteiroId() === porteiro.userId">
                                      Resume
                                    </button>
                                  }
                                  <button class="ce-button variant-ghost size-sm"
                                          (click)="onResetUserPassword(porteiro.userId, porteiro.displayName || porteiro.email)"
                                          [disabled]="resettingUserId() === porteiro.userId">
                                    Reset pw
                                  </button>
                                  <button class="ce-button variant-ghost size-sm danger-action"
                                          (click)="onDeletePorteiro(porteiro)"
                                          [disabled]="actingPorteiroId() === porteiro.userId">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <p class="manage-empty">No porteiros yet. Add one below.</p>
                }

                <form class="porteiro-form" [formGroup]="porteiroForm" (ngSubmit)="onCreatePorteiro()">
                  <p class="porteiro-form-title">Add porteiro</p>
                  <div class="porteiro-form-grid">
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="porteiro-email">Email</label>
                      <div class="ce-input-wrapper" [class.has-error]="porteiroForm.get('email')?.invalid && porteiroForm.get('email')?.touched">
                        <input id="porteiro-email" class="ce-input" type="email" formControlName="email" />
                      </div>
                    </div>
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="porteiro-display-name">Display name</label>
                      <div class="ce-input-wrapper" [class.has-error]="porteiroForm.get('displayName')?.invalid && porteiroForm.get('displayName')?.touched">
                        <input id="porteiro-display-name" class="ce-input" formControlName="displayName" />
                      </div>
                    </div>
                    <div class="ce-input-group">
                      <label class="ce-input-label" for="porteiro-password">Temporary password</label>
                      <div class="ce-input-wrapper" [class.has-error]="porteiroForm.get('password')?.invalid && porteiroForm.get('password')?.touched">
                        <input id="porteiro-password" class="ce-input" type="password" formControlName="password" />
                      </div>
                      @if (porteiroForm.get('password')?.invalid && porteiroForm.get('password')?.touched) {
                        <div class="ce-input-error">Password must be at least 8 characters</div>
                      }
                    </div>
                  </div>
                  <button type="submit" class="ce-button variant-primary size-sm"
                          [disabled]="porteiroForm.invalid || creatingPorteiro()">
                    @if (creatingPorteiro()) { <span class="ce-spinner tone-current size-sm"></span> }
                    Add porteiro
                  </button>
                </form>
              </section>
            }
          </div>
          <div class="ce-modal-footer">
            <button class="ce-button variant-ghost size-sm" (click)="closeManageModal()">Close</button>
          </div>
        </div>
      </div>
    }

    @if (resetResultModalOpen()) {
      <div class="ce-modal-backdrop" (click)="closeResetResultModal()">
        <div class="ce-modal size-sm" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title" (click)="$event.stopPropagation()">
          <div class="ce-modal-header">
            <h3 id="reset-modal-title" class="ce-modal-title">Password Reset</h3>
            <button class="ce-modal-close" (click)="closeResetResultModal()" aria-label="Close">&#10005;</button>
          </div>
          <div class="ce-modal-body">
            <p class="reset-modal-desc">
              Temporary password for <strong>{{ resetResultUser() }}</strong>:
            </p>
            <div class="temp-password-box">
              <code class="temp-password-text">{{ resetResultPassword() }}</code>
              <button type="button" class="ce-button variant-ghost size-sm copy-btn" (click)="copyTempPassword()">
                {{ passwordCopied() ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <p class="reset-modal-notice text-secondary">
              The user will be required to choose a new password upon sign-in. This password will not be shown again.
            </p>
          </div>
          <div class="ce-modal-footer">
            <button class="ce-button variant-primary size-sm" (click)="closeResetResultModal()">Done</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-6); }
    .page-title-block { min-width: 0; }
    .page-title { font-size: var(--font-size-2xl); margin-bottom: var(--space-1); }
    .page-subtitle { color: var(--color-text-secondary); font-size: var(--font-size-sm); }
    .page-header-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .page-error {
      margin-bottom: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--color-danger-light);
      color: var(--color-danger);
      font-size: var(--font-size-sm);
    }
    .loading-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: var(--space-12); gap: var(--space-4); color: var(--color-text-secondary);
    }
    .ce-button {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
      font-weight: var(--font-weight-medium); border: 1px solid transparent; border-radius: var(--radius-lg);
      cursor: pointer; font-family: inherit;
    }
    .ce-button.size-sm { height: 2rem; padding: 0 var(--space-3); font-size: var(--font-size-sm); }
    .ce-button.size-md { height: 2.5rem; padding: 0 var(--space-4); font-size: var(--font-size-sm); }
    .ce-button.variant-primary { background: var(--color-primary); color: var(--color-text-on-primary); }
    .ce-button.variant-secondary { background: var(--color-surface); color: var(--color-text-primary); border-color: var(--color-border); }
    .ce-button.variant-ghost { background: transparent; color: var(--color-text-primary); border-color: var(--color-border); }
    .ce-button:disabled { opacity: 0.6; cursor: not-allowed; }
    .ce-card { background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-card); overflow: hidden; }
    .ce-table-wrapper { overflow-x: auto; }
    .ce-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .ce-table thead { background: var(--color-neutral-light); }
    .ce-table th, .ce-table td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); text-align: left; }
    .ce-table th { font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); font-size: var(--font-size-xs); text-transform: uppercase; }
    .ce-badge { display: inline-flex; align-items: center; font-weight: var(--font-weight-medium); border-radius: var(--radius-full); border: 1px solid transparent; font-size: 0.7rem; padding: var(--space-1) var(--space-2); }
    .ce-badge.tone-success { background: var(--color-success-light); color: var(--color-success); }
    .ce-badge.tone-neutral { background: var(--color-neutral-light); color: var(--color-text-secondary); }
    .slug-code { font-size: var(--font-size-xs); background: var(--color-neutral-light); padding: 0.1rem 0.35rem; border-radius: var(--radius-sm); }
    .action-cell { display: flex; gap: var(--space-1); }
    .ce-empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--space-12); gap: var(--space-3); }
    .ce-empty-state-icon { font-size: 1.5rem; width: 4rem; height: 4rem; display: inline-flex; align-items: center; justify-content: center; background: var(--color-neutral-light); border-radius: var(--radius-full); }
    .ce-empty-state-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); }
    .ce-spinner { display: inline-block; border-radius: var(--radius-full); border: 2px solid currentColor; border-top-color: transparent; animation: spin 1.4s linear infinite; }
    .ce-spinner.size-sm { width: 1rem; height: 1rem; }
    .ce-spinner.size-lg { width: 2rem; height: 2rem; border-width: 3px; }
    .ce-spinner.tone-primary { color: var(--color-primary); }
    .ce-spinner.tone-current { color: currentColor; }
    .ce-modal-backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: var(--space-4); }
    .ce-modal { background: var(--color-surface-elevated); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); width: 100%; max-width: 32rem; }
    .ce-modal.size-lg { max-width: 42rem; }
    .ce-modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--color-border); }
    .ce-modal-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); }
    .ce-modal-close { background: transparent; border: 0; cursor: pointer; font-size: 1.25rem; color: var(--color-text-muted); }
    .ce-modal-body { padding: var(--space-6); }
    .ce-modal-footer { display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--color-border); }
    .ce-form { display: flex; flex-direction: column; gap: var(--space-4); }
    .ce-input-group { display: flex; flex-direction: column; gap: var(--space-1); }
    .ce-input-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); }
    .ce-input-wrapper { display: flex; align-items: center; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; }
    .ce-input-wrapper.has-error { border-color: var(--color-danger); }
    .ce-input { flex: 1; border: 0; background: transparent; padding: var(--space-3); font-family: inherit; font-size: var(--font-size-sm); outline: none; min-height: 2.5rem; width: 100%; }
    .ce-input-error { font-size: var(--font-size-xs); color: var(--color-danger); }
    .ce-checkbox { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); cursor: pointer; }
    .ce-checkbox input { position: absolute; opacity: 0; pointer-events: none; }
    .ce-checkbox-box {
      width: 1rem; height: 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .ce-checkbox input:checked + .ce-checkbox-box { background: var(--color-primary); border-color: var(--color-primary); }
    .admin-fields { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3); border: 1px dashed var(--color-border); border-radius: var(--radius-lg); }
    .admin-fields-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); margin: 0; }
    .danger-action { color: var(--color-danger); border-color: var(--color-danger-light); }
    .form-error-banner {
      margin-bottom: var(--space-4); padding: var(--space-3); border-radius: var(--radius-lg);
      background: var(--color-danger-light); color: var(--color-danger); font-size: var(--font-size-sm);
    }
    .text-secondary { color: var(--color-text-secondary); }
    .loading-inline { display: flex; align-items: center; gap: var(--space-2); color: var(--color-text-secondary); font-size: var(--font-size-sm); }
    .manage-section { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6); }
    .manage-section:last-child { margin-bottom: 0; }
    .manage-section-header h4 { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); margin: 0; }
    .manage-empty { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0; }
    .manage-table-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
    .manage-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .manage-table th, .manage-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border); text-align: left; }
    .manage-table th { font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase; background: var(--color-neutral-light); }
    .manage-table tr:last-child td { border-bottom: 0; }
    .inline-edit-form { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2) 0; }
    .inline-edit-fields { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .inline-edit-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .porteiro-form { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); border: 1px dashed var(--color-border); border-radius: var(--radius-lg); }
    .porteiro-form-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); margin: 0; }
    .porteiro-form-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
    @media (min-width: 640px) {
      .porteiro-form-grid { grid-template-columns: 1fr 1fr; }
      .porteiro-form-grid .ce-input-group:last-child { grid-column: 1 / -1; }
    }
    .temp-password-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-4);
      margin: var(--space-3) 0;
    }
    .temp-password-text {
      font-family: monospace;
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
      color: var(--color-primary);
      letter-spacing: 0.05em;
    }
    .reset-modal-desc {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      margin: 0;
    }
    .reset-modal-notice {
      font-size: var(--font-size-xs);
      line-height: 1.4;
      margin-top: var(--space-2);
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CondominiumsPage {
  private readonly api = inject(TenantsApiService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  resettingUserId = signal<string | null>(null);
  resetResultModalOpen = signal(false);
  resetResultUser = signal('');
  resetResultPassword = signal('');
  passwordCopied = signal(false);

  tenants = signal<TenantResponse[]>([]);
  loading = signal(true);
  creating = signal(false);
  actionTenantId = signal<string | null>(null);
  createModalOpen = signal(false);
  manageModalOpen = signal(false);
  manageTenant = signal<TenantResponse | null>(null);
  manageLoading = signal(false);
  manageError = signal<string | null>(null);
  admins = signal<TenantAdminResponse[]>([]);
  porteiros = signal<PorteiroResponse[]>([]);
  editingAdminId = signal<string | null>(null);
  savingAdmin = signal(false);
  actingAdminId = signal<string | null>(null);
  creatingAdmin = signal(false);
  editingPorteiroId = signal<string | null>(null);
  savingPorteiro = signal(false);
  actingPorteiroId = signal<string | null>(null);
  creatingPorteiro = signal(false);
  pageError = signal<string | null>(null);
  createError = signal<string | null>(null);

  createForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN)]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminDisplayName: ['', [Validators.required]],
    adminPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  adminEditForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required, Validators.maxLength(200)]],
  });

  adminCreateForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required, Validators.maxLength(200)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  porteiroEditForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required, Validators.maxLength(200)]],
  });

  porteiroForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required, Validators.maxLength(200)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.load();
  }

  formatDate(value: string): string {
    return formatRuntimeDate(value, { dateStyle: 'short' });
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.list().subscribe({
      next: (data) => {
        this.tenants.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.pageError.set(getApiErrorMessage(err, 'Failed to load condominiums'));
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

  openManageModal(tenant: TenantResponse): void {
    this.manageTenant.set(tenant);
    this.manageError.set(null);
    this.editingAdminId.set(null);
    this.editingPorteiroId.set(null);
    this.actingAdminId.set(null);
    this.actingPorteiroId.set(null);
    this.savingAdmin.set(false);
    this.savingPorteiro.set(false);
    this.creatingAdmin.set(false);
    this.adminCreateForm.reset();
    this.porteiroForm.reset();
    this.manageModalOpen.set(true);
    this.loadManageData(tenant.id);
  }

  closeManageModal(): void {
    this.manageModalOpen.set(false);
    this.manageTenant.set(null);
    this.admins.set([]);
    this.porteiros.set([]);
    this.editingAdminId.set(null);
    this.editingPorteiroId.set(null);
    this.actingAdminId.set(null);
    this.actingPorteiroId.set(null);
    this.savingAdmin.set(false);
    this.savingPorteiro.set(false);
    this.creatingAdmin.set(false);
  }

  loadManageData(tenantId: string): void {
    this.manageLoading.set(true);
    this.manageError.set(null);

    let adminsLoaded = false;
    let porteirosLoaded = false;
    const finish = () => {
      if (adminsLoaded && porteirosLoaded) {
        this.manageLoading.set(false);
      }
    };

    this.api.listAdmins(tenantId).subscribe({
      next: (data) => {
        this.admins.set(data);
        adminsLoaded = true;
        finish();
      },
      error: (err) => {
        this.manageLoading.set(false);
        this.manageError.set(getApiErrorMessage(err, 'Failed to load administrators'));
      },
    });

    this.api.listPorteiros(tenantId).subscribe({
      next: (data) => {
        this.porteiros.set(data);
        porteirosLoaded = true;
        finish();
      },
      error: (err) => {
        this.manageLoading.set(false);
        this.manageError.set(getApiErrorMessage(err, 'Failed to load porteiros'));
      },
    });
  }

  startAdminEdit(admin: TenantAdminResponse): void {
    this.editingAdminId.set(admin.userId);
    this.adminEditForm.reset({
      email: admin.email,
      displayName: admin.displayName,
    });
  }

  cancelAdminEdit(): void {
    this.editingAdminId.set(null);
  }

  saveAdminEdit(admin: TenantAdminResponse): void {
    if (this.adminEditForm.invalid) return;
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.savingAdmin.set(true);
    this.manageError.set(null);
    const v = this.adminEditForm.value;

    this.api.updateAdmin(tenant.id, admin.userId, {
      email: v.email!.trim(),
      displayName: v.displayName!.trim(),
    }).subscribe({
      next: (updated) => {
        this.admins.update((list) =>
          list.map((a) => (a.userId === updated.userId ? updated : a)));
        this.savingAdmin.set(false);
        this.editingAdminId.set(null);
      },
      error: (err) => {
        this.savingAdmin.set(false);
        this.manageError.set(getApiErrorMessage(err, 'Failed to update administrator'));
      },
    });
  }

  onCreateAdmin(): void {
    if (this.adminCreateForm.invalid) return;
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.creatingAdmin.set(true);
    this.manageError.set(null);
    const v = this.adminCreateForm.value;

    this.api.createAdmin(tenant.id, {
      email: v.email!.trim(),
      displayName: v.displayName!.trim(),
      password: v.password!,
    }).subscribe({
      next: (created) => {
        this.admins.update((list) => [...list, created]);
        this.adminCreateForm.reset();
        this.creatingAdmin.set(false);
      },
      error: (err) => {
        this.creatingAdmin.set(false);
        this.manageError.set(getApiErrorMessage(err, 'Failed to create administrator'));
      },
    });
  }

  onSuspendAdmin(admin: TenantAdminResponse): void {
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.actingAdminId.set(admin.userId);
    this.manageError.set(null);
    this.api.suspendAdmin(tenant.id, admin.userId).subscribe({
      next: () => {
        this.admins.update((list) =>
          list.map((a) => (a.userId === admin.userId ? { ...a, active: false } : a)));
        this.actingAdminId.set(null);
      },
      error: (err) => {
        this.actingAdminId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to suspend administrator'));
      },
    });
  }

  onResumeAdmin(admin: TenantAdminResponse): void {
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.actingAdminId.set(admin.userId);
    this.manageError.set(null);
    this.api.resumeAdmin(tenant.id, admin.userId).subscribe({
      next: () => {
        this.admins.update((list) =>
          list.map((a) => (a.userId === admin.userId ? { ...a, active: true } : a)));
        this.actingAdminId.set(null);
      },
      error: (err) => {
        this.actingAdminId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to resume administrator'));
      },
    });
  }

  onRevokeAdmin(admin: TenantAdminResponse): void {
    const tenant = this.manageTenant();
    if (!tenant) return;
    if (!confirm(`Revoke administrator '${admin.email}'? They will lose the administrator role and their access immediately.`)) return;

    this.actingAdminId.set(admin.userId);
    this.manageError.set(null);
    this.api.revokeAdmin(tenant.id, admin.userId).subscribe({
      next: () => {
        this.admins.update((list) => list.filter((a) => a.userId !== admin.userId));
        this.actingAdminId.set(null);
      },
      error: (err) => {
        this.actingAdminId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to revoke administrator'));
      },
    });
  }

  onDeleteAdmin(admin: TenantAdminResponse): void {
    const tenant = this.manageTenant();
    if (!tenant) return;
    if (!confirm(`Delete administrator '${admin.email}' permanently? This removes their account, profile, and sessions. This cannot be undone.`)) return;

    this.actingAdminId.set(admin.userId);
    this.manageError.set(null);
    this.api.deleteAdmin(tenant.id, admin.userId).subscribe({
      next: () => {
        this.admins.update((list) => list.filter((a) => a.userId !== admin.userId));
        this.actingAdminId.set(null);
      },
      error: (err) => {
        this.actingAdminId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to delete administrator'));
      },
    });
  }

  onCreatePorteiro(): void {
    if (this.porteiroForm.invalid) return;
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.creatingPorteiro.set(true);
    this.manageError.set(null);
    const v = this.porteiroForm.value;

    this.api.createPorteiro(tenant.id, {
      email: v.email!.trim(),
      displayName: v.displayName!.trim(),
      password: v.password!,
    }).subscribe({
      next: (created) => {
        this.porteiros.update((list) => [...list, created]);
        this.porteiroForm.reset();
        this.creatingPorteiro.set(false);
      },
      error: (err) => {
        this.creatingPorteiro.set(false);
        this.manageError.set(getApiErrorMessage(err, 'Failed to create porteiro'));
      },
    });
  }

  startPorteiroEdit(porteiro: PorteiroResponse): void {
    this.editingPorteiroId.set(porteiro.userId);
    this.porteiroEditForm.reset({
      email: porteiro.email,
      displayName: porteiro.displayName,
    });
  }

  cancelPorteiroEdit(): void {
    this.editingPorteiroId.set(null);
  }

  savePorteiroEdit(porteiro: PorteiroResponse): void {
    if (this.porteiroEditForm.invalid) return;
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.savingPorteiro.set(true);
    this.manageError.set(null);
    const v = this.porteiroEditForm.value;

    this.api.updatePorteiro(tenant.id, porteiro.userId, {
      email: v.email!.trim(),
      displayName: v.displayName!.trim(),
    }).subscribe({
      next: (updated) => {
        this.porteiros.update((list) =>
          list.map((p) => (p.userId === updated.userId ? updated : p)));
        this.savingPorteiro.set(false);
        this.editingPorteiroId.set(null);
      },
      error: (err) => {
        this.savingPorteiro.set(false);
        this.manageError.set(getApiErrorMessage(err, 'Failed to update porteiro'));
      },
    });
  }

  onSuspendPorteiro(porteiro: PorteiroResponse): void {
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.actingPorteiroId.set(porteiro.userId);
    this.manageError.set(null);
    this.api.suspendPorteiro(tenant.id, porteiro.userId).subscribe({
      next: () => {
        this.porteiros.update((list) =>
          list.map((p) => (p.userId === porteiro.userId ? { ...p, active: false } : p)));
        this.actingPorteiroId.set(null);
      },
      error: (err) => {
        this.actingPorteiroId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to suspend porteiro'));
      },
    });
  }

  onResumePorteiro(porteiro: PorteiroResponse): void {
    const tenant = this.manageTenant();
    if (!tenant) return;

    this.actingPorteiroId.set(porteiro.userId);
    this.manageError.set(null);
    this.api.resumePorteiro(tenant.id, porteiro.userId).subscribe({
      next: () => {
        this.porteiros.update((list) =>
          list.map((p) => (p.userId === porteiro.userId ? { ...p, active: true } : p)));
        this.actingPorteiroId.set(null);
      },
      error: (err) => {
        this.actingPorteiroId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to resume porteiro'));
      },
    });
  }

  onDeletePorteiro(porteiro: PorteiroResponse): void {
    const tenant = this.manageTenant();
    if (!tenant) return;
    if (!confirm(`Delete porteiro '${porteiro.email}' permanently? This removes their account, profile, and sessions. This cannot be undone.`)) return;

    this.actingPorteiroId.set(porteiro.userId);
    this.manageError.set(null);
    this.api.deletePorteiro(tenant.id, porteiro.userId).subscribe({
      next: () => {
        this.porteiros.update((list) => list.filter((p) => p.userId !== porteiro.userId));
        this.actingPorteiroId.set(null);
      },
      error: (err) => {
        this.actingPorteiroId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to delete porteiro'));
      },
    });
  }

  onCreate(): void {
    if (this.createForm.invalid) return;
    this.creating.set(true);
    this.createError.set(null);
    const v = this.createForm.value;

    this.api.create({
      slug: v.slug!.trim().toLowerCase(),
      displayName: v.displayName!.trim(),
    }).subscribe({
      next: (tenant) => {
        this.api.createAdmin(tenant.id, {
          email: v.adminEmail!.trim(),
          displayName: v.adminDisplayName!.trim(),
          password: v.adminPassword!,
        }).subscribe({
          next: () => {
            this.creating.set(false);
            this.closeCreateModal();
            this.load();
          },
          error: (err) => {
            this.creating.set(false);
            this.createError.set(getApiErrorMessage(err, 'Condominium created but failed to create tenant admin'));
            this.load();
          },
        });
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(getApiErrorMessage(err, 'Failed to register condominium'));
      },
    });
  }

  onSuspend(tenant: TenantResponse): void {
    this.actionTenantId.set(tenant.id);
    this.api.suspend(tenant.id).subscribe({
      next: () => {
        this.actionTenantId.set(null);
        this.load();
      },
      error: (err) => {
        this.actionTenantId.set(null);
        this.pageError.set(getApiErrorMessage(err, 'Failed to suspend condominium'));
      },
    });
  }

  onResume(tenant: TenantResponse): void {
    this.actionTenantId.set(tenant.id);
    this.api.resume(tenant.id).subscribe({
      next: () => {
        this.actionTenantId.set(null);
        this.load();
      },
      error: (err) => {
        this.actionTenantId.set(null);
        this.pageError.set(getApiErrorMessage(err, 'Failed to resume condominium'));
      },
    });
  }

  onResetUserPassword(userId: string, userName: string): void {
    if (!confirm(`Are you sure you want to reset the password for ${userName}? A new temporary password will be generated.`)) {
      return;
    }
    this.resettingUserId.set(userId);
    this.manageError.set(null);
    this.authService.resetUserPassword(userId).subscribe({
      next: (res) => {
        this.resettingUserId.set(null);
        this.resetResultUser.set(userName);
        this.resetResultPassword.set(res.tempPassword);
        this.passwordCopied.set(false);
        this.resetResultModalOpen.set(true);
      },
      error: (err) => {
        this.resettingUserId.set(null);
        this.manageError.set(getApiErrorMessage(err, 'Failed to reset user password'));
      },
    });
  }

  copyTempPassword(): void {
    const pwd = this.resetResultPassword();
    if (pwd) {
      navigator.clipboard.writeText(pwd).then(() => {
        this.passwordCopied.set(true);
        setTimeout(() => this.passwordCopied.set(false), 2000);
      });
    }
  }

  closeResetResultModal(): void {
    this.resetResultModalOpen.set(false);
    this.resetResultUser.set('');
    this.resetResultPassword.set('');
    this.passwordCopied.set(false);
  }
}
