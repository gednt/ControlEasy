import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'ce-demo-banner',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="demo-banner" role="status">
        <span class="ce-badge tone-warning">Demo</span>
        <span class="demo-banner-text"> Modo demonstração — dados de exemplo; alterações podem ser restauradas. </span>
        <button type="button" class="demo-banner-dismiss" (click)="dismiss()" aria-label="Dismiss demo banner">
          &#10005;
        </button>
      </div>
    }
  `,
  styles: [
    `
      .demo-banner {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-6);
        background: color-mix(in oklch, var(--color-warning) 12%, var(--color-surface));
        border-bottom: 1px solid color-mix(in oklch, var(--color-warning) 35%, transparent);
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
      }
      .demo-banner-text {
        flex: 1;
      }
      .demo-banner-dismiss {
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--color-text-secondary);
        font-size: 1rem;
        padding: var(--space-1);
        border-radius: var(--radius-sm);
      }
      .demo-banner-dismiss:hover {
        background: var(--color-neutral-light);
      }
      .ce-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ce-badge.tone-warning {
        background: var(--color-warning-light);
        color: var(--color-warning);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoBannerComponent {
  private readonly auth = inject(AuthService);
  private readonly dismissed = signal(
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ce.demoBanner.dismissed') === '1',
  );

  readonly visible = () => this.auth.isDemoPersona() && !this.dismissed();

  dismiss(): void {
    this.dismissed.set(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('ce.demoBanner.dismissed', '1');
    }
  }
}
