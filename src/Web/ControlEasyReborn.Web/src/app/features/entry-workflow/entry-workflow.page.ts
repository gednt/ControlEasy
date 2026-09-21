import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CeEntryWorkflowComponent } from '../../design-system';
import { ToastService } from '../../design-system/components/toast/toast.component';

/**
 * Dedicated page for the `/gatehouse` route. Hosts the same workflow modal
 * used by the dashboard FAB, but pinned full-screen so porteiros using a
 * tablet can navigate directly without going through the dashboard. Also
 * surfaces quick links to the new QR scan and manual-lookup flows.
 */
@Component({
  selector: 'ce-entry-workflow-page',
  standalone: true,
  imports: [CeEntryWorkflowComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="gatehouse-shortcuts" aria-label="Gatehouse shortcuts">
      <a routerLink="/gatehouse/qr" class="ce-button variant-secondary size-sm">QR scan</a>
      <a routerLink="/gatehouse/manual" class="ce-button variant-secondary size-sm">Manual lookup</a>
    </nav>
    <ce-entry-workflow
      [open]="true"
      (closed)="goBack()"
      (entryLogged)="onLogged()"
    />
  `,
  styles: [
    `
      .gatehouse-shortcuts {
        display: flex;
        gap: var(--space-2, 8px);
        padding: var(--space-3, 12px) var(--space-4, 16px);
        background: var(--color-surface-muted, #f5f7fb);
        border-bottom: 1px solid var(--color-border, #e5e7eb);
      }
    `,
  ],
})
export class EntryWorkflowPage {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  goBack(): void {
    void this.router.navigate(['/']);
  }

  onLogged(): void {
    this.toast.info('Entry recorded. Tap the button to start another.');
    // Stay on the page so the porteiro can log the next entry without
    // re-navigating; the modal has already reset via its own effect.
  }
}