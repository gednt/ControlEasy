import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GatewayControlService } from './gateway-control.service';
import { AuthService } from '../../core/services/auth.service';
import { AccessCredentialSummary, IssueCredentialRequest, SubjectKind } from './access-control.types';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { CeButtonComponent, CeIconComponent, CeModalComponent } from '../../design-system';
import { ToastService } from '../../design-system/components/toast/toast.component';
import { QrPassModalComponent } from './components/qr-pass-modal.component';

type CredentialStatusFilter = 'all' | 'active' | 'revoked' | 'replaced' | 'expired';

@Component({
  selector: 'ce-access-credentials-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CeButtonComponent,
    CeIconComponent,
    CeModalComponent,
    QrPassModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Access credentials</h1>
        <p class="page-subtitle">Manage and issue QR access passes for visitors, residents, and vehicles.</p>
      </div>
      @if (canIssue()) {
        <button class="ce-button variant-primary size-md" (click)="openIssueModal()">+ Issue credential</button>
      }
    </div>

    <div class="filter-tabs">
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'all'"
        (click)="setStatusFilter('all')"
      >
        All
      </button>
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'active'"
        (click)="setStatusFilter('active')"
      >
        Active
      </button>
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'replaced'"
        (click)="setStatusFilter('replaced')"
      >
        Replaced
      </button>
      <button
        type="button"
        class="filter-tab"
        [class.active]="statusFilter() === 'revoked'"
        (click)="setStatusFilter('revoked')"
      >
        Revoked
      </button>
    </div>

    @if (pageError()) {
      <div class="page-error" role="alert">{{ pageError() }}</div>
    }

    @if (loading()) {
      <p class="text-secondary">Loading credentials...</p>
    } @else {
      <div class="ce-card">
        <table class="ce-table" aria-label="Credentials table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Subject ID</th>
              <th>Method</th>
              <th>Status</th>
              <th>Valid from</th>
              <th>Expires at</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (cred of filteredCredentials(); track cred.id) {
              <tr>
                <td>
                  <span class="subject-tag" [class]="'tag-' + cred.subjectType">
                    {{ subjectTypeLabel(cred.subjectType) }}
                  </span>
                </td>
                <td>
                  <code class="uuid-label" [title]="cred.subjectId">{{ truncateId(cred.subjectId) }}</code>
                </td>
                <td>
                  <span class="method-tag">{{ cred.method | uppercase }}</span>
                </td>
                <td>
                  <span class="ce-badge" [class]="'badge-' + cred.status">
                    {{ cred.status }}
                  </span>
                </td>
                <td>{{ cred.validFromUtc | date: 'short' }}</td>
                <td>{{ cred.expiresAtUtc ? (cred.expiresAtUtc | date: 'short') : 'Permanent' }}</td>
                <td>
                  <div class="action-cell">
                    @if (cred.status === 'active') {
                      @if (canReplace()) {
                        <button
                          type="button"
                          class="ce-button variant-secondary size-sm"
                          [disabled]="actionInFlight() === cred.id"
                          (click)="onReplace(cred)"
                        >
                          Replace
                        </button>
                      }
                      @if (canRevoke()) {
                        <button
                          type="button"
                          class="ce-button variant-danger size-sm"
                          [disabled]="actionInFlight() === cred.id"
                          (click)="onRevoke(cred)"
                        >
                          Revoke
                        </button>
                      }
                    } @else {
                      <span class="text-muted text-xs">—</span>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="text-secondary empty-cell">No credentials found for this filter.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- Issue Credential Modal -->
    <ce-modal
      [open]="issueModalOpen()"
      title="Issue new QR credential"
      size="md"
      (openChange)="onIssueModalOpenChange($event)"
    >
      @if (issueError()) {
        <div class="form-error-banner" role="alert">{{ issueError() }}</div>
      }
      <form [formGroup]="issueForm" (ngSubmit)="submitIssue()" id="issue-credential-form" class="issue-form">
        <label class="field">
          <span class="field-label">Subject type</span>
          <select class="ce-input" formControlName="subjectType" (change)="onSubjectTypeChange()">
            <option value="visitor">Visitor</option>
            <option value="resident">Resident</option>
            <option value="vehicle">Vehicle</option>
          </select>
        </label>

        @if (issueForm.get('subjectType')?.value === 'resident' && residents().length > 0) {
          <label class="field">
            <span class="field-label">Select resident</span>
            <select class="ce-input" [value]="selectedResidentId()" (change)="onResidentSelect($event)">
              <option value="">-- Standalone / Random UUID --</option>
              @for (r of residents(); track r.id) {
                <option [value]="r.id">{{ r.name }}</option>
              }
            </select>
            <span class="field-hint">Choose an existing resident to link this pass, or keep a standalone UUID below.</span>
          </label>
        }

        <div class="field">
          <label for="credential-subject-id" class="field-label">Subject ID (UUID)</label>
          <div class="input-with-button">
            <input
              id="credential-subject-id"
              class="ce-input font-mono"
              formControlName="subjectId"
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              autocomplete="off"
            />
            <button
              type="button"
              class="ce-button variant-secondary size-sm input-action-btn"
              (click)="regenerateSubjectId()"
              title="Generate another random UUID"
              id="generate-uuid-btn"
            >
              <ce-icon name="refresh" [size]="16" />
              <span>New UUID</span>
            </button>
          </div>
          <span class="field-hint">Pre-filled with a random UUID. Click "New UUID" to generate another one.</span>
        </div>

        <label class="field">
          <span class="field-label">Expires at (optional)</span>
          <span class="field-hint">Leave empty for no automatic expiration.</span>
          <input class="ce-input" type="datetime-local" formControlName="expiresAtUtc" />
        </label>
      </form>

      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" type="button" (click)="closeIssueModal()">Cancel</ce-button>
        <ce-button
          variant="primary"
          size="sm"
          type="button"
          (click)="submitIssue()"
          [disabled]="issueForm.invalid || issuing()"
        >
          {{ issuing() ? 'Generating…' : 'Generate QR pass' }}
        </ce-button>
      </div>
    </ce-modal>

    <!-- QR Pass Display Modal -->
    <ce-qr-pass-modal
      [open]="qrPassModalOpen()"
      [qrPayload]="activeQrPayload()"
      [subjectName]="activeSubjectName()"
      [subjectType]="activeSubjectType()"
      [destination]="activeDestination()"
      [expiresAt]="activeExpiresAt()"
      (closed)="closeQrPassModal()"
    />
  `,
  styles: [
    `
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-4, 16px);
      }
      .page-title {
        font-size: var(--font-size-2xl, 1.5rem);
        margin: 0;
      }
      .page-subtitle {
        color: var(--color-text-secondary, #64748b);
        font-size: var(--font-size-sm, 0.875rem);
      }
      .filter-tabs {
        display: flex;
        gap: var(--space-2, 8px);
        margin-bottom: var(--space-4, 16px);
      }
      .filter-tab {
        border: 1px solid var(--color-border, #cbd5e1);
        background: var(--color-surface, #ffffff);
        border-radius: var(--radius-lg, 8px);
        padding: var(--space-2, 8px) var(--space-4, 16px);
        cursor: pointer;
        font-family: inherit;
        font-size: var(--font-size-sm, 0.875rem);
      }
      .filter-tab.active {
        background: var(--color-primary, #2c5cdc);
        color: var(--color-text-on-primary, #ffffff);
        border-color: var(--color-primary, #2c5cdc);
      }
      .page-error {
        margin-bottom: var(--space-4, 16px);
        padding: var(--space-3, 12px);
        border-radius: var(--radius-lg, 8px);
        background: var(--color-danger-light, #fee2e2);
        color: var(--color-danger, #b91c1c);
        font-size: var(--font-size-sm, 0.875rem);
      }
      .ce-card {
        background: var(--color-surface, #ffffff);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: var(--radius-xl, 12px);
        overflow: hidden;
      }
      .ce-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm, 0.875rem);
      }
      .ce-table th,
      .ce-table td {
        padding: var(--space-3, 12px) var(--space-4, 16px);
        border-bottom: 1px solid var(--color-border, #e2e8f0);
        text-align: left;
        vertical-align: middle;
      }
      .ce-table thead {
        background: var(--color-neutral-light, #f8fafc);
      }
      .empty-cell {
        text-align: center;
        padding: var(--space-6, 24px) !important;
      }
      .subject-tag {
        font-weight: 600;
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 9999px;
      }
      .tag-resident {
        background: #e0e7ff;
        color: #3730a3;
      }
      .tag-visitor {
        background: #fef3c7;
        color: #92400e;
      }
      .tag-vehicle {
        background: #d1fae5;
        color: #065f46;
      }
      .method-tag {
        font-weight: 700;
        font-size: 0.75rem;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .uuid-label {
        font-family: monospace;
        font-size: 0.8rem;
        color: var(--color-text-secondary, #64748b);
      }
      .ce-badge {
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: capitalize;
      }
      .badge-active {
        background: #dcfce7;
        color: #15803d;
      }
      .badge-replaced {
        background: #e2e8f0;
        color: #475569;
      }
      .badge-revoked {
        background: #fee2e2;
        color: #b91c1c;
      }
      .badge-expired {
        background: #fef2f2;
        color: #991b1b;
      }
      .action-cell {
        display: flex;
        gap: var(--space-2, 8px);
      }
      .ce-button.variant-danger {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
      }
      .issue-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
      }
      .field-label {
        font-weight: 600;
        font-size: 0.85rem;
      }
      .field-hint {
        color: var(--color-text-secondary, #64748b);
        font-size: 0.75rem;
      }
      .ce-input {
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 1px solid var(--color-border, #cbd5e1);
        border-radius: var(--radius-md, 6px);
        font-family: inherit;
        font-size: 0.875rem;
      }
      .input-with-button {
        display: flex;
        gap: var(--space-2, 8px);
        align-items: center;
      }
      .input-with-button .ce-input {
        flex: 1;
        font-family: monospace;
      }
      .input-action-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1, 4px);
        white-space: nowrap;
        height: 38px;
        padding: 0 var(--space-3, 12px);
      }
      .form-error-banner {
        margin-bottom: var(--space-3, 12px);
        padding: var(--space-3, 12px);
        border-radius: var(--radius-lg, 8px);
        color: var(--color-danger, #b91c1c);
        background: var(--color-danger-light, #fee2e2);
      }
    `,
  ],
})
export class AccessCredentialsPage implements OnInit {
  private readonly api = inject(GatewayControlService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly http = inject(HttpClient);

  readonly credentials = signal<AccessCredentialSummary[]>([]);
  readonly loading = signal(false);
  readonly pageError = signal<string | null>(null);
  readonly statusFilter = signal<CredentialStatusFilter>('all');
  readonly actionInFlight = signal<string | null>(null);

  // Residents list for selector
  readonly residents = signal<Array<{ id: string; name: string }>>([]);
  readonly selectedResidentId = signal<string>('');

  // Issue modal state
  readonly issueModalOpen = signal(false);
  readonly issuing = signal(false);
  readonly issueError = signal<string | null>(null);

  readonly issueForm = this.fb.group({
    subjectType: ['visitor' as SubjectKind, Validators.required],
    subjectId: [this.generateRandomUuid(), [Validators.required, Validators.pattern(/^[0-9a-fA-F-]{36}$/)]],
    expiresAtUtc: [''],
  });

  // QR pass display state
  readonly qrPassModalOpen = signal(false);
  readonly activeQrPayload = signal<string | null>(null);
  readonly activeSubjectName = signal('');
  readonly activeSubjectType = signal('Visitor');
  readonly activeDestination = signal('');
  readonly activeExpiresAt = signal<string | null>(null);

  readonly filteredCredentials = computed(() => {
    const list = this.credentials();
    const filter = this.statusFilter();
    if (filter === 'all') return list;
    return list.filter((c) => c.status === filter);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.api.listCredentials().subscribe({
      next: (data) => {
        this.loading.set(false);
        this.credentials.set(data);
      },
      error: (err) => {
        this.loading.set(false);
        this.pageError.set(getApiErrorMessage(err, 'Failed to load credentials.'));
      },
    });
  }

  setStatusFilter(filter: CredentialStatusFilter): void {
    this.statusFilter.set(filter);
  }

  subjectTypeLabel(type: SubjectKind): string {
    switch (type) {
      case 'resident':
        return 'Resident';
      case 'visitor':
        return 'Visitor';
      case 'vehicle':
        return 'Vehicle';
      default:
        return type;
    }
  }

  truncateId(id: string): string {
    if (!id || id.length <= 8) return id;
    return `${id.substring(0, 8)}...`;
  }

  canIssue(): boolean {
    return this.auth.hasPermission('Access.Control.Issue');
  }

  canReplace(): boolean {
    return this.auth.hasPermission('Access.Control.Replace');
  }

  canRevoke(): boolean {
    return this.auth.hasPermission('Access.Control.Revoke');
  }

  onSubjectTypeChange(): void {
    const type = this.issueForm.get('subjectType')?.value;
    if (type === 'resident') {
      if (this.residents().length === 0) {
        this.loadResidents();
      }
    } else {
      this.selectedResidentId.set('');
    }
  }

  loadResidents(): void {
    this.http.get<Array<{ id: string; name: string }>>('/api/v1/residents').subscribe({
      next: (data) => this.residents.set(data ?? []),
      error: () => this.residents.set([]),
    });
  }

  onResidentSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedResidentId.set(id);
    if (id) {
      this.issueForm.patchValue({ subjectId: id });
    } else {
      this.regenerateSubjectId();
    }
  }

  regenerateSubjectId(): void {
    this.selectedResidentId.set('');
    this.issueForm.patchValue({ subjectId: this.generateRandomUuid() });
  }

  generateRandomUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  openIssueModal(prefill?: { subjectType: SubjectKind; subjectId: string }): void {
    if (prefill) {
      this.issueForm.patchValue({
        subjectType: prefill.subjectType,
        subjectId: prefill.subjectId,
      });
      if (prefill.subjectType === 'resident') {
        this.selectedResidentId.set(prefill.subjectId);
        if (this.residents().length === 0) {
          this.loadResidents();
        }
      }
    } else {
      this.issueForm.reset({
        subjectType: 'visitor',
        subjectId: this.generateRandomUuid(),
        expiresAtUtc: '',
      });
      this.selectedResidentId.set('');
    }
    this.issueError.set(null);
    this.issueModalOpen.set(true);
  }

  onIssueModalOpenChange(open: boolean): void {
    if (!open) this.closeIssueModal();
  }

  closeIssueModal(): void {
    this.issueModalOpen.set(false);
    this.issuing.set(false);
    this.issueError.set(null);
  }

  submitIssue(): void {
    if (this.issueForm.invalid || this.issuing()) return;
    this.issuing.set(true);
    this.issueError.set(null);

    const val = this.issueForm.getRawValue();
    const req: IssueCredentialRequest = {
      subjectType: val.subjectType as SubjectKind,
      subjectId: val.subjectId!,
      expiresAtUtc: val.expiresAtUtc ? new Date(val.expiresAtUtc).toISOString() : null,
    };

    const residentMatch = this.residents().find((r) => r.id === req.subjectId);
    const displayName = residentMatch ? residentMatch.name : this.truncateId(req.subjectId);

    this.api.issueCredential(req).subscribe({
      next: (res) => {
        this.issuing.set(false);
        this.closeIssueModal();
        this.toast.info('QR credential issued successfully.');
        this.load();

        // Open QR pass display
        this.activeQrPayload.set(res.qrPayload);
        this.activeSubjectName.set(displayName);
        this.activeSubjectType.set(this.subjectTypeLabel(req.subjectType));
        this.activeExpiresAt.set(req.expiresAtUtc ?? null);
        this.qrPassModalOpen.set(true);
      },
      error: (err) => {
        this.issuing.set(false);
        this.issueError.set(getApiErrorMessage(err, 'Failed to issue credential.'));
      },
    });
  }

  onReplace(cred: AccessCredentialSummary): void {
    if (this.actionInFlight()) return;
    this.actionInFlight.set(cred.id);

    this.api.replaceCredential(cred.id).subscribe({
      next: (res) => {
        this.actionInFlight.set(null);
        this.toast.info('Credential replaced.');
        this.load();

        // Open QR pass display with replacement
        this.activeQrPayload.set(res.qrPayload);
        this.activeSubjectName.set(this.truncateId(cred.subjectId));
        this.activeSubjectType.set(this.subjectTypeLabel(cred.subjectType));
        this.activeExpiresAt.set(cred.expiresAtUtc);
        this.qrPassModalOpen.set(true);
      },
      error: (err) => {
        this.actionInFlight.set(null);
        this.toast.error(getApiErrorMessage(err, 'Failed to replace credential.'));
      },
    });
  }

  onRevoke(cred: AccessCredentialSummary): void {
    if (this.actionInFlight()) return;
    if (!confirm('Are you sure you want to revoke this credential? Access will be immediately denied.')) return;

    this.actionInFlight.set(cred.id);
    this.api.revokeCredential(cred.id, 'operator_revocation', 'Revoked by operator').subscribe({
      next: () => {
        this.actionInFlight.set(null);
        this.toast.info('Credential revoked.');
        this.load();
      },
      error: (err) => {
        this.actionInFlight.set(null);
        this.toast.error(getApiErrorMessage(err, 'Failed to revoke credential.'));
      },
    });
  }

  closeQrPassModal(): void {
    this.qrPassModalOpen.set(false);
    this.activeQrPayload.set(null);
  }
}
