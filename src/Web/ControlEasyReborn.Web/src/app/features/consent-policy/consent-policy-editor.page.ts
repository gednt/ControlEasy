import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CeToggleComponent } from '../../design-system/components/toggle/toggle.component';
import { CeButtonComponent } from '../../design-system/components/button/button.component';
import { CeSpinnerComponent } from '../../design-system/components/spinner/spinner.component';
import { ToastService } from '../../design-system/components/toast/toast.component';
import { ConsentPolicyService, type ConsentPolicyResponse, type SubjectCategory } from './consent-policy.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { formatRuntimeDate } from '../../core/config/runtime-config';

interface CategoryRow {
  value: SubjectCategory;
  label: string;
  description: string;
}

const CATEGORIES: CategoryRow[] = [
  {
    value: 'dwellers',
    label: 'Dwellers',
    description: 'Residents living in the condominium',
  },
  {
    value: 'visitors',
    label: 'Visitors',
    description: 'Visitors and guests',
  },
  {
    value: 'service-providers',
    label: 'Service-Providers',
    description: 'Service providers and contractors',
  },
  {
    value: 'vehicles',
    label: 'Vehicles',
    description: 'Vehicles entering the gate',
  },
];

/**
 * Per-tenant per-category consent policy editor. 4 toggle switches; only
 * Save actually writes. Optimistic local draft; the dirty computation
 * compares draft vs current saved values to enable the Save button.
 */
@Component({
  selector: 'ce-consent-policy-editor',
  standalone: true,
  imports: [CeToggleComponent, CeButtonComponent, CeSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="policy-page">
      <header class="page-header">
        <h1 class="page-title">Consent Policy</h1>
        <p class="page-subtitle">When photo is required, the gatehouse camera opens automatically for that category.</p>
      </header>

      @if (loading()) {
        <div class="loading-state">
          <ce-spinner tone="primary" size="lg" />
          <p>Loading consent policy…</p>
        </div>
      } @else {
        <div class="rows" role="list">
          @for (cat of categories; track cat.value) {
            <div class="row" role="listitem">
              <div class="info">
                <div class="name">{{ cat.label }}</div>
                <div class="desc">{{ cat.description }}</div>
              </div>
              <ce-toggle
                [checked]="isRequired(cat.value)"
                [disabled]="saving()"
                (checkedChange)="onToggle(cat.value, $event)"
              />
            </div>
          }
        </div>

        <footer class="footer">
          <span class="last-updated">{{ lastUpdatedText() }}</span>
          <ce-button
            variant="primary"
            size="md"
            (click)="save()"
            [disabled]="saving() || !dirty()"
            [loading]="saving()"
          >
            Save policy
          </ce-button>
        </footer>
      }
    </div>
  `,
  styles: [
    `
      .policy-page {
        max-width: 720px;
        margin: 0 auto;
        padding: var(--space-6, 24px);
        display: flex;
        flex-direction: column;
        gap: var(--space-6, 24px);
      }
      .page-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
      }
      .page-title {
        font-size: var(--font-size-2xl, 24px);
        font-weight: var(--font-weight-bold, 700);
        margin: 0;
      }
      .page-subtitle {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm, 14px);
        margin: 0;
        max-width: 36rem;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-3, 12px) var(--space-4, 16px);
        background: var(--color-surface-muted);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg, 8px);
        gap: var(--space-4, 16px);
      }
      .info {
        flex: 1;
        min-width: 0;
      }
      .name {
        font-size: var(--font-size-base, 16px);
        font-weight: var(--font-weight-semibold, 600);
        color: var(--color-text-primary);
      }
      .desc {
        font-size: var(--font-size-xs, 13px);
        color: var(--color-text-secondary);
        margin-top: var(--space-1, 4px);
      }
      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: var(--space-4, 16px);
        border-top: 1px solid var(--color-border);
        gap: var(--space-3, 12px);
      }
      .last-updated {
        font-size: var(--font-size-xs, 12px);
        color: var(--color-text-muted);
      }
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3, 12px);
        padding: var(--space-12, 48px) var(--space-4, 16px);
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class ConsentPolicyEditorPage implements OnInit {
  private readonly consentPolicyService = inject(ConsentPolicyService);
  private readonly toast = inject(ToastService);

  readonly categories = CATEGORIES;

  policies = signal<ConsentPolicyResponse[]>([]);
  draft = signal<Map<SubjectCategory, boolean>>(new Map());
  loading = signal(false);
  saving = signal(false);

  isRequired = (cat: SubjectCategory): boolean => this.draft().get(cat) ?? false;

  dirty = computed(() => {
    const draft = this.draft();
    const current = this.policies();
    for (const cat of this.categories) {
      const cur = current.find((p) => p.subjectCategory === cat.value)?.photoRequired ?? false;
      const drf = draft.get(cat.value) ?? false;
      if (cur !== drf) return true;
    }
    return false;
  });

  lastUpdatedText = computed(() => {
    const policies = this.policies();
    if (policies.length === 0) return 'Never updated';
    const latest = policies.reduce((max, p) => {
      const t = p.updatedAtUtc ? new Date(p.updatedAtUtc).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    if (!latest) return 'Never updated';
    return `Last updated ${formatRuntimeDate(latest)}`;
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const policies = await firstValueFrom(this.consentPolicyService.getAll());
      this.policies.set(policies);
      const draft = new Map<SubjectCategory, boolean>();
      for (const cat of this.categories) {
        const existing = policies.find((p) => p.subjectCategory === cat.value);
        draft.set(cat.value, existing?.photoRequired ?? false);
      }
      this.draft.set(draft);
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to load consent policy'));
    } finally {
      this.loading.set(false);
    }
  }

  onToggle(cat: SubjectCategory, value: boolean): void {
    const next = new Map(this.draft());
    next.set(cat, value);
    this.draft.set(next);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const updates = this.categories
        .filter((cat) => {
          const cur = this.policies().find((p) => p.subjectCategory === cat.value)?.photoRequired ?? false;
          const drf = this.draft().get(cat.value) ?? false;
          return cur !== drf;
        })
        .map((cat) => ({
          subjectCategory: cat.value,
          photoRequired: this.draft().get(cat.value) ?? false,
        }));

      if (updates.length === 0) {
        this.toast.info('No changes to save');
        return;
      }

      const results = await firstValueFrom(this.consentPolicyService.updateAll(updates));
      // Merge new policies into the cache.
      const updated = [...this.policies()];
      for (const r of results) {
        const idx = updated.findIndex((p) => p.subjectCategory === r.subjectCategory);
        if (idx >= 0) {
          updated[idx] = r;
        } else {
          updated.push(r);
        }
      }
      this.policies.set(updated);
      this.toast.success('Policy updated');
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to save policy'));
    } finally {
      this.saving.set(false);
    }
  }
}
