import { Component, input, output, ChangeDetectionStrategy, computed } from '@angular/core';

@Component({
  selector: 'ce-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="ce-pagination" aria-label="Pagination">
      <button class="ce-page-btn" type="button" [disabled]="page() <= 1" aria-label="First page" (click)="goToPage(1)">
        &laquo;&laquo;
      </button>
      <button
        class="ce-page-btn"
        type="button"
        [disabled]="page() <= 1"
        aria-label="Previous page"
        (click)="goToPage(page() - 1)"
      >
        &laquo;
      </button>
      @for (p of pageList(); track p) {
        @if (p === -1) {
          <span class="ce-page-ellipsis">&hellip;</span>
        } @else {
          <button
            class="ce-page-btn"
            [class.active]="p === page()"
            type="button"
            [attr.aria-current]="p === page() ? 'page' : null"
            (click)="goToPage(p)"
          >
            {{ p }}
          </button>
        }
      }
      <button
        class="ce-page-btn"
        type="button"
        [disabled]="page() >= totalPages()"
        aria-label="Next page"
        (click)="goToPage(page() + 1)"
      >
        &raquo;
      </button>
      <button
        class="ce-page-btn"
        type="button"
        [disabled]="page() >= totalPages()"
        aria-label="Last page"
        (click)="goToPage(totalPages())"
      >
        &raquo;&raquo;
      </button>
      @if (pageSizeOptions().length > 1) {
        <select
          class="ce-page-size"
          [value]="pageSize()"
          (change)="onPageSizeChange($event)"
          aria-label="Rows per page"
        >
          @for (opt of pageSizeOptions(); track opt) {
            <option [value]="opt">{{ opt }} / page</option>
          }
        </select>
      }
    </nav>
  `,
  styles: [
    `
      .ce-pagination {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--font-size-sm);
      }
      .ce-page-btn {
        min-width: 2rem;
        height: 2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-family: inherit;
        font-size: var(--font-size-sm);
        padding: 0 var(--space-2);
        transition: background var(--duration-fast) var(--ease-out);
      }
      .ce-page-btn:hover:not(:disabled) {
        background: var(--color-neutral-light);
      }
      .ce-page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .ce-page-btn.active {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        border-color: var(--color-primary);
      }
      .ce-page-ellipsis {
        display: inline-flex;
        align-items: center;
        padding: 0 var(--space-1);
        color: var(--color-text-muted);
      }
      .ce-page-size {
        margin-left: var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-family: inherit;
        font-size: var(--font-size-sm);
        padding: var(--space-1) var(--space-2);
      }
    `,
  ],
})
export class CePaginationComponent {
  page = input(1);
  pageSize = input(10);
  total = input(0);
  pageSizeOptions = input<number[]>([10, 25, 50, 100]);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  pageList = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (current > 3) pages.push(-1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.pageChange.emit(p);
  }

  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSizeChange.emit(Number(select.value));
  }
}
