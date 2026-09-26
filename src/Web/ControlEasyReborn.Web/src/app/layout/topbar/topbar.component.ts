import { Component, ChangeDetectionStrategy, computed, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CeIconComponent,
  CeAvatarComponent,
  CeBreadcrumbsComponent,
  CeDropdownComponent,
  CeTooltipDirective,
  ThemeService,
} from '../../design-system';
import { AuthService } from '../../core/services/auth.service';
import { TenantSessionService } from '../../core/services/tenant-session.service';
import { DrawerService } from '../../core/services/drawer.service';

const BRAND_GRADIENT = 'var(--color-primary)';

@Component({
  selector: 'ce-topbar',
  standalone: true,
  imports: [
    RouterLink,
    CeIconComponent,
    CeAvatarComponent,
    CeBreadcrumbsComponent,
    CeDropdownComponent,
    CeTooltipDirective,
  ],
  template: `
    <header class="topbar" role="banner">
      <button
        class="topbar-menu-btn icon-btn"
        type="button"
        aria-label="Open menu"
        data-mobile-menu
        (click)="drawerService.toggle()"
      >
        <ce-icon name="menu" [size]="20" />
      </button>

      <ce-breadcrumbs [crumbs]="breadcrumbs()" />

      <div class="topbar-search">
        <span class="topbar-search-icon" aria-hidden="true">
          <ce-icon name="search" [size]="18" />
        </span>
        <input
          type="search"
          placeholder="Search residents, visits, vehicles…"
          aria-label="Global search"
          [value]="searchQuery()"
          (input)="onSearchInput($event)"
        />
      </div>

      <div class="topbar-actions">
        @if (auth.isDemoPersona()) {
          <a class="topbar-help-link" routerLink="/help/demo"
            ><span class="help-full">Help → Demo guide</span><span class="help-short">Demo</span></a
          >
        }

        <button class="icon-btn" type="button" aria-label="Notifications" ceTooltip="Notifications">
          <ce-icon name="bell" [size]="20" />
        </button>

        <button
          class="icon-btn"
          type="button"
          aria-label="Toggle theme"
          ceTooltip="Toggle theme"
          (click)="themeService.toggle()"
        >
          @if (themeService.resolvedTheme() === 'dark') {
            <ce-icon name="moon" [size]="20" />
          } @else {
            <ce-icon name="sun" [size]="20" />
          }
        </button>

        <ce-dropdown class="topbar-profile-dropdown">
          <button
            ceDropdownTrigger
            class="topbar-profile-trigger"
            type="button"
            aria-label="Open profile menu"
            aria-haspopup="menu"
          >
            <ce-avatar [name]="displayName()" size="sm" [background]="brandGradient" />
          </button>

          <div class="profile-menu-header">
            <div class="profile-menu-name">{{ displayName() }}</div>
            <div class="profile-menu-role">{{ roleLabel() }}</div>
            @if (!auth.isPlatformAdmin() && tenantSession.tenantDisplayName()) {
              <div class="profile-menu-tenant">{{ tenantSession.tenantDisplayName() }}</div>
            }
          </div>

          @if (!auth.isPlatformAdmin() && tenantSession.canSwitchTenant()) {
            <label class="profile-menu-tenant-switch" for="profile-tenant-switcher">
              <span>Condominium</span>
              <select
                id="profile-tenant-switcher"
                [disabled]="switchingTenant()"
                [value]="tenantSession.tenantId() ?? ''"
                (change)="onTenantChange($event)"
                (click)="$event.stopPropagation()"
              >
                @for (tenant of tenantSession.switchableTenants(); track tenant.tenantId) {
                  <option [value]="tenant.tenantId">{{ tenant.displayName }}</option>
                }
              </select>
            </label>
          }

          <a class="profile-menu-item" routerLink="/design-system/showcase" role="menuitem">
            <ce-icon name="settings" [size]="16" />
            Design System
          </a>

          <button class="profile-menu-item danger" type="button" role="menuitem" (click)="logout()">
            <ce-icon name="log-out" [size]="16" />
            Sign out
          </button>
        </ce-dropdown>
      </div>
    </header>
  `,
  styles: [
    `
      .topbar {
        position: sticky;
        top: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        gap: var(--space-4);
        height: var(--topbar-height);
        padding: 0 var(--space-6);
        background: color-mix(in oklch, var(--color-surface) 92%, var(--color-background));
        border-bottom: 1px solid var(--color-border);
      }
      @media (max-width: 639px) {
        .topbar {
          padding: 0 var(--space-3);
          gap: var(--space-2);
        }
        .topbar-search {
          display: none;
        }
        .topbar-help-link {
          white-space: nowrap;
          padding-inline: var(--space-1);
          font-size: var(--font-size-xs);
        }
        .help-full {
          display: none;
        }
        .help-short {
          display: inline;
        }
      }
      .help-short {
        display: none;
      }
      .topbar-menu-btn {
        display: none;
        background: transparent;
        border: 0;
        width: 44px;
        height: 44px;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        cursor: pointer;
        color: var(--color-text-primary);
      }
      @media (max-width: 639px) {
        .topbar-menu-btn {
          display: inline-flex;
        }
      }
      .topbar-menu-btn:hover {
        background: var(--color-neutral-light);
      }
      .topbar-search {
        flex: 1;
        max-width: 28rem;
        position: relative;
      }
      .topbar-search input {
        width: 100%;
        height: 2.5rem;
        padding: 0 var(--space-3) 0 2.5rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        font-family: inherit;
      }
      .topbar-search input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 15%, transparent);
      }
      .topbar-search-icon {
        position: absolute;
        left: var(--space-3);
        top: 50%;
        transform: translateY(-50%);
        color: var(--color-text-muted);
        pointer-events: none;
        display: inline-flex;
      }
      .topbar-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-left: auto;
      }
      .topbar-help-link {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        text-decoration: none;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-md);
      }
      .topbar-help-link:hover {
        color: var(--color-primary);
        background: var(--color-neutral-light);
      }
      .icon-btn {
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 0;
        border-radius: var(--radius-md);
        cursor: pointer;
        color: var(--color-text-primary);
        transition: background var(--duration-fast);
      }
      .icon-btn:hover {
        background: var(--color-neutral-light);
      }
      .topbar-profile-trigger {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        border: 0;
        background: transparent;
        padding: var(--space-1);
        border-radius: var(--radius-md);
        cursor: pointer;
        color: var(--color-text-primary);
      }
      .topbar-profile-trigger:hover {
        background: var(--color-neutral-light);
      }
      .topbar-profile-dropdown {
        display: inline-flex;
      }
      :host ::ng-deep .topbar-profile-dropdown .ce-dropdown-panel {
        left: auto;
        right: 0;
        width: 14rem;
        padding: var(--space-2);
      }
      .profile-menu-header {
        padding: var(--space-2) var(--space-3) var(--space-3);
        border-bottom: 1px solid var(--color-border);
        margin-bottom: var(--space-1);
      }
      .profile-menu-name {
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
      }
      .profile-menu-role,
      .profile-menu-tenant {
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
        margin-top: var(--space-1);
      }
      .profile-menu-tenant-switch {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-3);
        margin-bottom: var(--space-1);
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }
      .profile-menu-tenant-switch select {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-family: inherit;
        font-size: var(--font-size-sm);
        padding: var(--space-1) var(--space-2);
      }
      :host ::ng-deep .profile-menu-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--color-text-primary);
        cursor: pointer;
        border-radius: var(--radius-md);
        font-family: inherit;
        font-size: var(--font-size-sm);
        padding: var(--space-2) var(--space-3);
        text-align: left;
        text-decoration: none;
        transition:
          background var(--duration-fast) var(--ease-out),
          color var(--duration-fast) var(--ease-out);
      }
      :host ::ng-deep .profile-menu-item:hover,
      :host ::ng-deep .profile-menu-item:focus-visible {
        background: var(--color-neutral-light);
      }
      :host ::ng-deep .profile-menu-item.danger {
        color: var(--color-danger);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  readonly themeService = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly tenantSession = inject(TenantSessionService);
  readonly drawerService = inject(DrawerService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly brandGradient = BRAND_GRADIENT;
  readonly searchQuery = signal('');
  readonly switchingTenant = signal(false);
  readonly breadcrumbs = signal<Array<{ label: string; route?: string }>>([{ label: 'Home', route: '/' }]);

  readonly displayName = computed(
    () => this.tenantSession.userDisplayName() ?? this.auth.userDisplayName() ?? this.fallbackDisplayName(),
  );
  readonly roleLabel = computed(() => this.formatRole(this.auth.roles()[0]));

  private searchDebounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.breadcrumbs.set(this.buildBreadcrumbs());
      });

    this.breadcrumbs.set(this.buildBreadcrumbs());
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.searchQuery.set(value);
    }, 250);
  }

  logout(): void {
    this.auth.logout();
  }

  onTenantChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const tenantId = select.value;
    if (!tenantId || tenantId === this.tenantSession.tenantId()) return;

    this.switchingTenant.set(true);
    this.auth.switchTenant(tenantId).subscribe({
      next: () => {
        this.switchingTenant.set(false);
        this.router.navigate(['/']);
      },
      error: () => {
        this.switchingTenant.set(false);
        select.value = this.tenantSession.tenantId() ?? '';
      },
    });
  }

  private buildBreadcrumbs(): Array<{ label: string; route?: string }> {
    const crumbs: Array<{ label: string; route?: string }> = [{ label: 'Home', route: '/' }];
    let route = this.activatedRoute.root;
    let url = '';

    while (route.firstChild) {
      route = route.firstChild;
      const segment = (route.snapshot?.url ?? []).map((part) => part.path).join('/');
      if (segment) {
        url += `/${segment}`;
      }
      const label = route.snapshot?.data['breadcrumb'] as string | undefined;
      if (label) {
        crumbs.push({ label, route: url || '/' });
      }
    }

    return crumbs;
  }

  private formatRole(role: string | undefined): string {
    if (!role) return 'Signed in';
    if (role === 'AttendantProfile') return 'Porteiro';
    if (role === 'TenantAdmin') return 'Administrador';
    if (role === 'PlatformAdmin') return 'Platform Admin';
    return role;
  }

  private fallbackDisplayName(): string {
    const roles = this.auth.roles();
    if (roles.includes('PlatformAdmin')) return 'Platform Admin';
    if (roles.includes('TenantAdmin')) return 'Admin';
    if (roles.includes('AttendantProfile')) return 'Porteiro';
    if (roles.includes('Morador')) return 'Morador';
    return 'Account';
  }
}
