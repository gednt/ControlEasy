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
        data: { breadcrumb: 'New entry' },
        loadComponent: () => import('./features/entry-workflow/entry-workflow.page').then((m) => m.EntryWorkflowPage),
      },
      {
        path: 'gatehouse/qr',
        canActivate: [porteiroGuard],
        data: { breadcrumb: 'QR scan' },
        loadComponent: () => import('./features/access-control/qr-scan.page').then((m) => m.QrScanPage),
      },
      {
        path: 'gatehouse/manual',
        canActivate: [porteiroGuard],
        data: { breadcrumb: 'Manual lookup' },
        loadComponent: () => import('./features/access-control/manual-lookup.page').then((m) => m.ManualLookupPage),
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
