import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CeAuditFiltersComponent, type PorteiroOption } from '../../design-system/components/audit-filters/audit-filters.component';
import { CeAuditRowComponent } from '../../design-system/components/audit-row/audit-row.component';
import { CeTableComponent } from '../../design-system/components/table/table.component';
import { CePaginationComponent } from '../../design-system/components/pagination/pagination.component';
import { CeButtonComponent } from '../../design-system/components/button/button.component';
import { CeEmptyStateComponent } from '../../design-system/components/empty-state/empty-state.component';
import { CeSpinnerComponent } from '../../design-system/components/spinner/spinner.component';
import { CePhotoLightboxComponent } from '../../design-system/components/photo/photo-lightbox.component';
import { CeIconComponent } from '../../design-system/components/icon/icon.component';
import { ToastService } from '../../design-system/components/toast/toast.component';
import {
  EntryLogService,
  type AuditFilters,
  type EntryLogResponse,
} from '../../features/entry-log/entry-log.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { AuthService, type StaffMemberResponse } from '../../core/services/auth.service';

/**
 * Audit review page — append-only log of every entry created via the
 * gatehouse workflow. Phase 13 deviation: backend does not return a total
 * count, so pagination shows entries.length as an approximation. When the
 * backend grows X-Total-Count, switch to reading the header.
 *
 * Edit/delete are intentionally NOT surfaced — the log is enforced as
 * append-only at the DB trigger layer.
 */
@Component({
  selector: 'ce-audit-page',
  standalone: true,
  imports: [
    CeAuditFiltersComponent,
    CeAuditRowComponent,
    CeTableComponent,
    CePaginationComponent,
    CeButtonComponent,
    CeEmptyStateComponent,
    CeSpinnerComponent,
    CePhotoLightboxComponent,
    CeIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="audit-page">
      <header class="page-header">
        <div class="page-title-block">
          <h1 class="page-title">Audit Log</h1>
          <p class="page-subtitle">
            Append-only record of every entry. Read-only — entries cannot be edited or deleted.
          </p>
        </div>
        <ce-button
          variant="secondary"
          size="md"
          (click)="exportCsv()"
          [loading]="exporting()"
          [disabled]="exporting() || entries().length === 0"
        >
          <ce-icon name="download" [size]="16" />
          Export CSV
        </ce-button>
      </header>

      <ce-audit-filters
        [filters]="filters()"
        [porteiros]="porteiroOptions()"
        (filtersChanged)="onFiltersChanged($event)"
      />

      @if (loading()) {
        <div class="loading-state">
          <ce-spinner tone="primary" size="lg" />
          <p>Loading entries…</p>
        </div>
      } @else if (entries().length === 0) {
        <ce-empty-state
          icon="📋"
          title="No entries"
          description="No entries match the current filters."
        />
      } @else {
        <ce-table>
          <thead>
            <tr>
              <th scope="col">Recorded at</th>
              <th scope="col">State</th>
              <th scope="col">Category</th>
              <th scope="col">Subject</th>
              <th scope="col">Photo</th>
              <th scope="col">Override reason</th>
              <th scope="col">Porteiro</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of entries(); track entry.id) {
              <ce-audit-row
                [entry]="entry"
                [porteiroName]="porteiroNameById().get(entry.performedByProfileId ?? '')"
                (photoClicked)="openLightbox($event)"
              />
            }
          </tbody>
        </ce-table>

        <div class="pagination-row">
          <span class="page-summary">
            Showing {{ entries().length }} entries
          </span>
          <ce-pagination
            [page]="page()"
            [pageSize]="filters().take"
            [total]="totalCount()"
            [pageSizeOptions]="[25, 50, 100]"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      }

      <ce-photo-lightbox
        [photos]="lightboxPhotos()"
        [open]="lightboxOpen()"
        [startIndex]="lightboxIndex()"
        (closed)="lightboxOpen.set(false)"
      />
    </div>
  `,
  styles: [
    `
      .audit-page {
        padding: var(--space-4, 16px);
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-4, 16px);
        flex-wrap: wrap;
      }
      .page-title {
        font-size: var(--font-size-2xl, 24px);
        font-weight: var(--font-weight-bold, 700);
        margin: 0 0 var(--space-1, 4px) 0;
      }
      .page-subtitle {
        color: var(--color-text-secondary, #6b7280);
        font-size: var(--font-size-sm, 14px);
        margin: 0;
        max-width: 48rem;
      }
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-3, 12px);
        padding: var(--space-12, 48px) var(--space-4, 16px);
        color: var(--color-text-secondary, #6b7280);
      }
      .pagination-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3, 12px);
      }
      .page-summary {
        font-size: var(--font-size-sm, 14px);
        color: var(--color-text-secondary, #6b7280);
      }
    `,
  ],
})
export class AuditPage implements OnInit {
  private readonly entryLogService = inject(EntryLogService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  filters = signal<AuditFilters>({ skip: 0, take: 50 });
  entries = signal<EntryLogResponse[]>([]);
  totalCount = signal(0);
  loading = signal(false);
  exporting = signal(false);
  lightboxOpen = signal(false);
  lightboxIndex = signal(0);

  private readonly porteiros = signal<StaffMemberResponse[]>([]);

  readonly porteiroOptions = computed<PorteiroOption[]>(() =>
    this.porteiros()
      .filter((p) => p.profileId !== null && p.profileId !== undefined)
      .map((p) => ({ profileId: p.profileId as string, displayName: p.displayName }))
  );

  readonly porteiroNameById = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const member of this.porteiros()) {
      if (member.profileId) {
        map.set(member.profileId, member.displayName);
      }
    }
    return map;
  });

  /** Phase 13 lightbox input requires PhotoResponse shape — synthesize from entry. */
  lightboxPhotos = computed(() =>
    this.entries()
      .filter((e) => !!e.photoId)
      .map((e) => ({
        id: e.photoId!,
        tenantId: e.tenantId,
        filePath: '',
        thumbnailPath: null,
        mimeType: 'image/jpeg',
        sizeBytes: 0,
        capturedAtUtc: null,
        createdAtUtc: e.recordedAt,
        deletedAtUtc: null,
      })),
  );

  page = computed(() =>
    Math.floor(this.filters().skip / this.filters().take) + 1,
  );

  ngOnInit(): void {
    void this.loadEntries();
    void this.loadPorteiros();
  }

  private async loadPorteiros(): Promise<void> {
    try {
      const staff = await firstValueFrom(this.authService.listStaff());
      this.porteiros.set(staff);
    } catch {
      this.porteiros.set([]);
    }
  }

  private async loadEntries(): Promise<void> {
    this.loading.set(true);
    try {
      const entries = await firstValueFrom(
        this.entryLogService.list(this.filters()),
      );
      this.entries.set(entries);
      // Phase 13 deviation: backend has no X-Total-Count. Use entries.length
      // so the pagination component still renders.
      this.totalCount.set(entries.length);
    } catch (err) {
      this.entries.set([]);
      this.totalCount.set(0);
      this.toast.error(getApiErrorMessage(err, 'Failed to load audit log'));
    } finally {
      this.loading.set(false);
    }
  }

  onFiltersChanged(filters: AuditFilters): void {
    this.filters.set(filters);
    void this.loadEntries();
  }

  onPageChange(page: number): void {
    this.filters.update((f) => ({
      ...f,
      skip: (page - 1) * f.take,
    }));
    void this.loadEntries();
  }

  onPageSizeChange(size: number): void {
    this.filters.update((f) => ({
      ...f,
      take: size,
      skip: 0,
    }));
    void this.loadEntries();
  }

  openLightbox(entryId: string): void {
    const idx = this.entries().findIndex((e) => e.id === entryId);
    if (idx >= 0) {
      this.lightboxIndex.set(idx);
      this.lightboxOpen.set(true);
    }
  }

  async exportCsv(): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await firstValueFrom(
        this.entryLogService.export(this.filters()),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entry-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast.success('CSV downloaded');
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'CSV export failed'));
    } finally {
      this.exporting.set(false);
    }
  }
}