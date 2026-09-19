import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TenantSessionService } from '../../core/services/tenant-session.service';
import { DrawerService } from '../../core/services/drawer.service';
import { CeIconComponent } from '../../design-system/components/icon/icon.component';
import { CeAvatarComponent } from '../../design-system/components/avatar/avatar.component';
import type { LucideIconName } from '../../design-system/components/icon/icon.types';

const BRAND_GRADIENT = 'var(--color-primary)';

@Component({
  selector: 'ce-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CeIconComponent, CeAvatarComponent],
  template: `
    <aside
      id="primary-sidebar"
      class="sidebar is-drawer"
      [class.is-open]="drawerService.isOpen()"
      aria-label="Main navigation"
    >
      <div class="sidebar-brand">
        <div class="sidebar-brand-mark">CE</div>
        <div class="sidebar-brand-text">ControlEasy</div>
      </div>
      <nav class="sidebar-nav">
        @if (auth.isPlatformAdmin()) {
          <div class="sidebar-nav-section">
            <div class="sidebar-nav-title">Platform</div>
            <a
              class="sidebar-nav-item"
              routerLink="/platform/condominiums"
              routerLinkActive="active"
              (click)="closeDrawer()"
            >
              <span class="sidebar-nav-icon"><ce-icon name="building" [size]="20" /></span>
              <span class="sidebar-nav-text">Condominiums</span>
            </a>
          </div>
        } @else {
          <div class="sidebar-nav-section">
            <div class="sidebar-nav-title">Overview</div>
            <a
              class="sidebar-nav-item"
              routerLink="/"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="closeDrawer()"
            >
              <span class="sidebar-nav-icon"><ce-icon name="dashboard" [size]="20" /></span>
              <span class="sidebar-nav-text">Dashboard</span>
            </a>
          </div>
          <div class="sidebar-nav-section">
            <div class="sidebar-nav-title">Modules</div>
            @for (item of navItems; track item.route) {
              <a class="sidebar-nav-item" [routerLink]="item.route" routerLinkActive="active" (click)="closeDrawer()">
                <span class="sidebar-nav-icon"><ce-icon [name]="item.icon" [size]="20" /></span>
                <span class="sidebar-nav-text">{{ item.label }}</span>
              </a>
            }
          </div>
          @if (showGatehouseNav()) {
            <div class="sidebar-nav-section">
              <div class="sidebar-nav-title">Gatehouse</div>
              @for (item of gatehouseItems; track item.route) {
                <a class="sidebar-nav-item" [routerLink]="item.route" routerLinkActive="active" (click)="closeDrawer()">
                  <span class="sidebar-nav-icon"><ce-icon [name]="item.icon" [size]="20" /></span>
                  <span class="sidebar-nav-text">{{ item.label }}</span>
                </a>
              }
            </div>
          }
          <div class="sidebar-nav-section">
            <div class="sidebar-nav-title">Settings</div>
            <a class="sidebar-nav-item" routerLink="/administration" routerLinkActive="active" (click)="closeDrawer()">
              <span class="sidebar-nav-icon"><ce-icon name="settings" [size]="20" /></span>
              <span class="sidebar-nav-text">Administration</span>
            </a>
          </div>
        }
      </nav>
      <div class="sidebar-footer">
        <ce-avatar class="sidebar-footer-avatar" [name]="displayName()" size="md" [background]="brandGradient" />
        <div class="sidebar-footer-text">
          <div class="sidebar-footer-name">{{ displayName() }}</div>
          <div class="sidebar-footer-role">{{ roleLabel() }}</div>
          @if (!auth.isPlatformAdmin() && tenantSession.tenantDisplayName()) {
            <div class="sidebar-footer-tenant">{{ tenantSession.tenantDisplayName() }}</div>
          }
        </div>
      </div>
    </aside>
  `,
  styles: [
    `
      .sidebar {
        background: var(--color-sidebar-bg);
        color: var(--color-sidebar-text);
        border-right: 1px solid var(--color-sidebar-border);
        display: flex;
        flex-direction: column;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow: hidden;
      }
      @media (max-width: 639px) {
        .sidebar.is-drawer {
          position: fixed;
          top: 0;
          left: 0;
          width: var(--sidebar-width);
          z-index: 60;
          transform: translateX(-100%);
          transition: transform var(--duration-base) var(--ease-out);
        }
        .sidebar.is-drawer.is-open {
          transform: translateX(0);
        }
      }
      .sidebar-brand {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-5) var(--space-4) var(--space-4);
        border-bottom: 1px solid var(--color-sidebar-border);
        min-height: var(--topbar-height);
      }
      .sidebar-brand-mark {
        width: 2rem;
        height: 2rem;
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: var(--font-weight-bold);
        font-size: 1.1rem;
        flex-shrink: 0;
      }
      .sidebar-brand-text {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-on-primary);
        white-space: nowrap;
      }
      @media (max-width: 1023px) {
        .sidebar-brand-text,
        .sidebar-nav-text,
        .sidebar-nav-title,
        .sidebar-footer-text {
          display: none;
        }
      }
      .sidebar-nav {
        flex: 1;
        padding: var(--space-3);
        overflow-y: auto;
      }
      .sidebar-nav-section {
        margin-top: var(--space-4);
      }
      .sidebar-nav-section:first-child {
        margin-top: 0;
      }
      .sidebar-nav-title {
        font-size: 0.65rem;
        font-weight: var(--font-weight-semibold);
        color: var(--color-sidebar-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: var(--space-2) var(--space-3);
      }
      .sidebar-nav-item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
        color: var(--color-sidebar-text);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        text-decoration: none;
        margin-bottom: 2px;
        transition:
          background var(--duration-fast) var(--ease-out),
          color var(--duration-fast) var(--ease-out),
          transform var(--duration-fast) var(--ease-out);
      }
      .sidebar-nav-item:hover {
        background: var(--color-sidebar-hover-bg);
        color: var(--color-text-on-primary);
      }
      .sidebar-nav-item.active {
        background: var(--color-sidebar-active-bg);
        color: var(--color-sidebar-active-text);
        transform: translateX(2px);
      }
      .sidebar-nav-icon {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .sidebar-footer {
        padding: var(--space-3);
        border-top: 1px solid var(--color-sidebar-border);
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .sidebar-footer-name {
        color: var(--color-text-on-primary);
        font-size: 0.85rem;
        font-weight: var(--font-weight-medium);
      }
      .sidebar-footer-role {
        color: var(--color-sidebar-text-muted);
        font-size: 0.7rem;
      }
      .sidebar-footer-tenant {
        color: var(--color-sidebar-text-muted);
        font-size: 0.65rem;
        margin-top: var(--space-1);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  readonly auth = inject(AuthService);
  readonly tenantSession = inject(TenantSessionService);
  readonly drawerService = inject(DrawerService);
  readonly brandGradient = BRAND_GRADIENT;

  readonly navItems: ReadonlyArray<{ route: string; label: string; icon: LucideIconName }> = [
    { route: '/residents', label: 'Residents', icon: 'users' },
    { route: '/apartments', label: 'Apartments', icon: 'building' },
    { route: '/visits', label: 'Visits', icon: 'calendar' },
    { route: '/vehicles', label: 'Vehicles', icon: 'car' },
    { route: '/service-providers', label: 'Service Providers', icon: 'briefcase' },
  ];

  readonly gatehouseItems: ReadonlyArray<{ route: string; label: string; icon: LucideIconName }> = [
    { route: '/gatehouse', label: 'New entry', icon: 'check-circle' },
    { route: '/gatehouse/qr', label: 'QR scan', icon: 'camera' },
    { route: '/gatehouse/manual', label: 'Manual lookup', icon: 'search' },
    { route: '/gatehouse/credentials', label: 'QR credentials', icon: 'user-check' },
  ];

  showGatehouseNav(): boolean {
    return (
      this.auth.hasPermission('Access.Access.Operate') ||
      this.auth.roles().includes('AttendantProfile') ||
      this.auth.roles().includes('TenantAdmin')
    );
  }

  readonly displayName = computed(() => this.tenantSession.userDisplayName() ?? this.fallbackDisplayName());
  readonly roleLabel = computed(() => this.formatRole(this.auth.roles()[0]));

  closeDrawer(): void {
    this.drawerService.close();
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
    if (roles.includes('TenantAdmin')) return 'Administrador';
    if (roles.includes('AttendantProfile')) return 'Porteiro';
    if (roles.includes('Morador')) return 'Morador';
    return 'Account';
  }
}
