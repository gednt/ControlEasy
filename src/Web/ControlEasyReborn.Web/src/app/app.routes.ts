import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { changePasswordGuard } from './core/guards/change-password.guard';
import { demoModeGuard } from './core/guards/demo-mode.guard';
import { platformAdminGuard } from './core/guards/platform-admin.guard';
import { porteiroGuard } from './core/guards/porteiro.guard';
import { syndicGuard } from './core/guards/syndic.guard';
import { tenantAdminGuard } from './core/guards/tenant-admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'change-password',
    canActivate: [changePasswordGuard],
    loadComponent: () => import('./features/auth/change-password.page').then((m) => m.ChangePasswordPage),
  },
  {
    path: 'access-denied',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/access-denied.page').then((m) => m.AccessDeniedPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        data: { breadcrumb: 'Dashboard' },
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'gatehouse',
        canActivate: [porteiroGuard],
        data: { breadcrumb: 'Gatehouse' },
        loadComponent: () => import('./features/gatehouse/gatehouse-panel.page').then((m) => m.GatehousePanelPage),
      },
      {
        path: 'gatehouse/qr',
        canActivate: [porteiroGuard],
        data: { breadcrumb: 'QR scan', initialTab: 'qr' },
        loadComponent: () => import('./features/gatehouse/gatehouse-panel.page').then((m) => m.GatehousePanelPage),
      },
      {
        path: 'gatehouse/manual',
        canActivate: [porteiroGuard],
        data: { breadcrumb: 'Manual lookup', initialTab: 'manual' },
        loadComponent: () => import('./features/gatehouse/gatehouse-panel.page').then((m) => m.GatehousePanelPage),
      },
      {
        path: 'gatehouse/credentials',
        canActivate: [porteiroGuard],
        data: { breadcrumb: 'QR credentials' },
        loadComponent: () =>
          import('./features/access-control/access-credentials.page').then((m) => m.AccessCredentialsPage),
      },
      {
        path: 'audit',
        canActivate: [syndicGuard],
        data: { breadcrumb: 'Audit Log' },
        loadComponent: () => import('./features/audit/audit.page').then((m) => m.AuditPage),
      },
      {
        path: 'reports',
        data: { breadcrumb: 'Reports & History' },
        loadComponent: () => import('./features/reports/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'admin/consent-policy',
        canActivate: [tenantAdminGuard],
        data: { breadcrumb: 'Consent Policy' },
        loadComponent: () =>
          import('./features/consent-policy/consent-policy-editor.page').then((m) => m.ConsentPolicyEditorPage),
      },
      {
        path: 'help/demo',
        canActivate: [demoModeGuard],
        data: { breadcrumb: 'Demo Guide' },
        loadComponent: () => import('./features/help/demo-help.page').then((m) => m.DemoHelpPageComponent),
      },
      {
        path: 'residents',
        data: { breadcrumb: 'Residents' },
        loadComponent: () => import('./features/residents/residents.page').then((m) => m.ResidentsPage),
      },
      {
        path: 'apartments',
        data: { breadcrumb: 'Apartments' },
        loadComponent: () => import('./features/apartments/apartments.page').then((m) => m.ApartmentsPage),
      },
      {
        path: 'visits',
        data: { breadcrumb: 'Visits' },
        loadComponent: () => import('./features/visits/visits.page').then((m) => m.VisitsPage),
      },
      {
        path: 'vehicles',
        data: { breadcrumb: 'Vehicles' },
        loadComponent: () => import('./features/vehicles/vehicles.page').then((m) => m.VehiclesPage),
      },
      {
        path: 'service-providers',
        data: { breadcrumb: 'Service Providers' },
        loadComponent: () =>
          import('./features/service-providers/service-providers.page').then((m) => m.ServiceProvidersPage),
      },
      {
        path: 'administration',
        data: { breadcrumb: 'Administration' },
        loadComponent: () => import('./features/administration/administration.page').then((m) => m.AdministrationPage),
      },
      {
        // Phase 26 (DOOR-13) — device-health dashboard. Visible to TenantAdmin
        // + Porteiro per CONTEXT.md "Permission visibility". Reuses the existing
        // porteiroGuard which already allows both roles (see porteiro.guard.ts).
        path: 'devices',
        canActivate: [porteiroGuard],
        data: { breadcrumb: 'Device health' },
        loadComponent: () =>
          import('./features/devices/devices-health.page').then((m) => m.DevicesHealthPage),
      },
      {
        path: 'platform/condominiums',
        canActivate: [platformAdminGuard],
        data: { breadcrumb: 'Condominiums' },
        loadComponent: () => import('./features/platform/condominiums.page').then((m) => m.CondominiumsPage),
      },
      {
        path: 'design-system/showcase',
        data: { breadcrumb: 'Design System' },
        loadComponent: () => import('./design-system/showcase/showcase.page').then((m) => m.ShowcasePageComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
