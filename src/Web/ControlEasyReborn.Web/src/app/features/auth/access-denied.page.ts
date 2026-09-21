import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'ce-access-denied-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="access-denied" tabindex="-1">
      <section class="card" aria-labelledby="access-denied-title">
        <h1 id="access-denied-title">Access denied</h1>
        <p class="message">
          You don't have permission to use this feature. Ask your administrator
          to grant the required access for your account.
        </p>
        <div class="actions">
          <a class="ce-button variant-primary size-md" [routerLink]="returnLink()">Back</a>
          <button class="ce-button variant-secondary size-md" type="button" (click)="signOut()">Sign out</button>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      :host { display: block; min-height: 100vh; background: var(--color-surface-muted, #f6f7fb); }
      .access-denied {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: var(--space-6, 24px);
      }
      .card {
        background: var(--color-surface, #fff);
        border-radius: var(--radius-md, 8px);
        padding: var(--space-6, 24px);
        max-width: 480px;
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
        text-align: center;
      }
      h1 { margin: 0 0 var(--space-3, 12px); font-size: 1.5rem; }
      .message { color: var(--color-text-secondary, #555); margin: 0 0 var(--space-4, 16px); }
      .actions { display: flex; justify-content: center; gap: var(--space-3, 12px); }
      .ce-button {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2, 8px);
        padding: var(--space-2, 8px) var(--space-4, 16px);
        border-radius: var(--radius-sm, 4px);
        text-decoration: none;
        font-weight: var(--font-weight-semibold, 600);
        cursor: pointer;
        border: none;
      }
      .ce-button.variant-primary {
        background: var(--color-primary, #2c5cdc);
        color: var(--color-text-on-primary, #fff);
      }
      .ce-button.variant-secondary {
        background: var(--color-surface-muted, #f1f5f9);
        color: var(--color-text-primary, #1e293b);
        border: 1px solid var(--color-border, #cbd5e1);
      }
    `,
  ],
})
export class AccessDeniedPage {
  private readonly auth = inject(AuthService);

  readonly returnLink = computed<string[]>(() => {
    const roles = this.auth.roles();
    if (roles.includes('AttendantProfile')) {
      return ['/gatehouse'];
    }
    if (roles.includes('TenantAdmin')) {
      return ['/administration'];
    }
    return ['/'];
  });

  signOut(): void {
    this.auth.logout();
  }
}
