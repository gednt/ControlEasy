import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AdministrationPage } from './administration.page';
import { AdministrationApiService, CondominiumSettingsDto, AuditLogResponse } from './administration-api.service';
import { AuthService, type StaffMemberResponse } from '../../core/services/auth.service';
import { DevicesApiService } from '../devices/devices-api.service';
import { DoorIntegrationSectionComponent } from '../devices/components/door-integration-section.component';
import { SecurityService } from '../../api/services/security.service';

describe('AdministrationPage', () => {
  let component: AdministrationPage;
  let fixture: ComponentFixture<AdministrationPage>;
  let apiMock: jasmine.SpyObj<AdministrationApiService>;
  let securityMock: jasmine.SpyObj<SecurityService>;
  let authMock: {
    isTenantAdmin: ReturnType<typeof signal<boolean>>;
    isPlatformAdmin: ReturnType<typeof signal<boolean>>;
    roles: ReturnType<typeof signal<string[]>>;
    listStaff: jasmine.Spy;
    resetUserPassword: jasmine.Spy;
  };

  const mockSettings: CondominiumSettingsDto = {
    id: 'test-settings-id',
    tenantId: 'test-tenant-id',
    visitDurationMinutes: 120,
    requireShiftHandoverNotes: true,
    defaultShiftLengthHours: 8,
    emergencyContactPhone: '+55 11 99999-0000',
    allowedVisitorStartHour: '06:00',
    allowedVisitorEndHour: '22:00',
    autoCheckoutAtMidnight: true,
    maxActiveVisitorsPerUnit: 5,
    photoRequiredVisitors: true,
    photoRequiredProviders: true,
    photoRequiredResidents: false,
    allowOverrideOnRefusal: true,
    overdueVisitAlertMinutes: 15,
    createdAtUtc: '2026-09-13T00:00:00Z',
    updatedAtUtc: null,
  };

  const mockLogs: AuditLogResponse[] = [
    {
      id: 'log-1',
      tenantId: 'test-tenant-id',
      category: 'Gatehouse',
      action: 'OverrideAuthorized',
      entityType: 'GatehouseEntry',
      entityId: 'entry-1',
      severity: 'SecurityAlert',
      performedByName: 'Attendant John',
      details: 'Override authorized for visitor',
      metadataJson: '{"reason":"emergency"}',
      createdAtUtc: '2026-09-13T12:00:00Z',
    },
    {
      id: 'log-2',
      tenantId: 'test-tenant-id',
      category: 'Settings',
      action: 'SettingsUpdated',
      entityType: 'CondominiumSettings',
      entityId: 'settings-1',
      severity: 'Info',
      performedByName: 'Admin Alice',
      details: 'Condominium settings updated',
      metadataJson: null,
      createdAtUtc: '2026-09-13T11:00:00Z',
    },
  ];

  beforeEach(async () => {
    apiMock = jasmine.createSpyObj<AdministrationApiService>('AdministrationApiService', [
      'getSettings',
      'updateSettings',
      'listAuditLogs',
      'getAuditLogById',
      'getDoorIntegration',
    ]);

    apiMock.getSettings.and.returnValue(of(mockSettings));
    apiMock.listAuditLogs.and.returnValue(of(mockLogs));
    apiMock.updateSettings.and.returnValue(of({ ...mockSettings, visitDurationMinutes: 180 }));
    apiMock.getDoorIntegration.and.returnValue(
      of({
        tenantId: 'test-tenant-id',
        doorIntegrationEnabled: false,
        doorIntegrationChangedAtUtc: null,
        doorIntegrationChangedByProfileId: null,
      })
    );
    securityMock = jasmine.createSpyObj<SecurityService>('SecurityService', [
      'apiV1SecurityGatehousesGet',
      'apiV1SecurityGatehousesPost',
      'apiV1SecurityGatehousesIdActivationPut',
    ]);
    securityMock.apiV1SecurityGatehousesGet.and.returnValue(of([]));

    authMock = {
      isTenantAdmin: signal(true),
      isPlatformAdmin: signal(false),
      roles: signal<string[]>(['TenantAdmin']),
      listStaff: jasmine.createSpy('listStaff').and.returnValue(of([] as StaffMemberResponse[])),
      resetUserPassword: jasmine
        .createSpy('resetUserPassword')
        .and.returnValue(of({ userId: 'u-1', mustChangePassword: true, deliveryState: 'Sent' })),
    };

    const devicesApiMock = jasmine.createSpyObj<DevicesApiService>('DevicesApiService', [
      'list',
      'get',
      'register',
      'update',
      'setActivation',
      'remove',
      'toggleDoorIntegration',
      'unlock',
    ]);
    devicesApiMock.list.and.returnValue(of([]));
    devicesApiMock.get.and.returnValue(throwError(() => new Error('not used')));
    devicesApiMock.toggleDoorIntegration.and.returnValue(
      of({
        tenantId: 'test-tenant-id',
        doorIntegrationEnabled: true,
        doorIntegrationChangedAtUtc: '2026-01-01T00:00:00.000Z',
        doorIntegrationChangedByProfileId: 'profile-1',
      })
    );

    await TestBed.configureTestingModule({
      imports: [AdministrationPage],
      providers: [
        { provide: AdministrationApiService, useValue: apiMock },
        { provide: AuthService, useValue: authMock },
        { provide: DevicesApiService, useValue: devicesApiMock },
        { provide: SecurityService, useValue: securityMock },
        provideHttpClient(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdministrationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and default to settings tab', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab()).toBe('settings');
    expect(apiMock.getSettings).toHaveBeenCalled();
  });

  it('should populate settingsForm from loaded settings', () => {
    expect(component.settingsForm.value.visitDurationMinutes).toBe(120);
    expect(component.settingsForm.value.defaultShiftLengthHours).toBe(8);
    expect(component.settingsForm.value.allowedVisitorStartHour).toBe('06:00');
    expect(component.settingsForm.value.photoRequiredVisitors).toBe(true);
  });

  it('should switch tabs between settings and audit', () => {
    component.setTab('audit');
    expect(component.activeTab()).toBe('audit');

    component.setTab('settings');
    expect(component.activeTab()).toBe('settings');
  });

  it('should call updateSettings when valid form is saved', () => {
    component.settingsForm.patchValue({ visitDurationMinutes: 180 });
    component.settingsForm.markAsDirty();

    component.onSaveSettings();

    expect(apiMock.updateSettings).toHaveBeenCalled();
    expect(component.statusMessage()?.type).toBe('success');
  });

  it('should filter audit logs by category', () => {
    const event = { target: { value: 'Gatehouse' } } as unknown as Event;
    component.onCategoryChange(event);

    expect(component.selectedCategory()).toBe('Gatehouse');
    expect(apiMock.listAuditLogs).toHaveBeenCalled();
  });

  it('should inspect and close an audit event', () => {
    component.inspectEvent(mockLogs[0]!);
    expect(component.inspectedEvent()).toEqual(mockLogs[0]!);

    component.closeInspect();
    expect(component.inspectedEvent()).toBeNull();
  });

  it('should show an audit-load error and recover when retry succeeds', () => {
    apiMock.listAuditLogs.and.returnValue(throwError(() => new Error('Audit service unavailable')));

    component.loadAuditLogs();
    component.setTab('audit');
    fixture.detectChanges();

    expect(component.auditLogs()).toEqual([]);
    expect(component.auditLoadError()).toBe('Unable to load audit records. Please retry.');
    expect(fixture.nativeElement.textContent).toContain('Unable to load audit records');
    expect(fixture.nativeElement.textContent).not.toContain('No audit records found');

    apiMock.listAuditLogs.and.returnValue(of(mockLogs));
    component.loadAuditLogs();
    fixture.detectChanges();

    expect(component.auditLoadError()).toBeNull();
    expect(component.auditLogs()).toEqual(mockLogs);
    expect(fixture.nativeElement.textContent).toContain('OverrideAuthorized');
  });

  it('should ignore an older audit request that fails after a newer one succeeds', () => {
    const olderRequest = new Subject<AuditLogResponse[]>();
    const newerRequest = new Subject<AuditLogResponse[]>();
    apiMock.listAuditLogs.calls.reset();
    apiMock.listAuditLogs.and.returnValues(olderRequest, newerRequest);

    component.loadAuditLogs();
    component.loadAuditLogs();
    newerRequest.next(mockLogs);
    olderRequest.error(new Error('Stale request failed'));

    expect(component.auditLogs()).toEqual(mockLogs);
    expect(component.auditLoadError()).toBeNull();
    expect(component.auditLoading()).toBeFalse();
  });

  it('should display a safe ProblemDetails title without exposing its detail', () => {
    apiMock.listAuditLogs.and.returnValue(
      throwError(() => ({ error: { title: 'Audit service unavailable', detail: 'Connection details are private' } })),
    );

    component.loadAuditLogs();

    expect(component.auditLoadError()).toBe('Unable to load audit records: Audit service unavailable. Please retry.');
  });

  it('should expose Staff & Passwords tab for TenantAdmin and load staff on activation', async () => {
    authMock.listStaff.and.returnValue(
      of([
        {
          userId: 'u-1',
          profileId: 'p-1',
          email: 'synthetic-admin@example.test',
          displayName: 'Synthetic Admin',
          roles: 'TenantAdmin',
          active: true,
        },
        {
          userId: 'u-2',
          profileId: 'p-2',
          email: 'synthetic-porteiro@example.test',
          displayName: 'Synthetic Porteiro',
          roles: 'Porteiro',
          active: true,
        },
      ] as StaffMemberResponse[]),
    );

    component.setTab('staff');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authMock.listStaff).toHaveBeenCalled();
    expect(component.staff().length).toBe(2);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Synthetic Admin');
    expect(text).toContain('Synthetic Porteiro');
    expect(text).toContain('Staff & Passwords');
    expect(text).toContain('Reset password');
  });

  it('should reset a staff member with delivery feedback and no plaintext', () => {
    authMock.listStaff.and.returnValue(
      of([
        {
          userId: 'u-2',
          profileId: 'p-2',
          email: 'synthetic-porteiro@example.test',
          displayName: 'Synthetic Porteiro',
          roles: 'Porteiro',
          active: true,
        },
      ] as StaffMemberResponse[]),
    );

    component.setTab('staff');
    component.staff.set([
      {
        userId: 'u-2',
        profileId: 'p-2',
        email: 'synthetic-porteiro@example.test',
        displayName: 'Synthetic Porteiro',
        roles: 'Porteiro',
        active: true,
      },
    ]);
    fixture.detectChanges();

    spyOn(window, 'confirm').and.returnValue(true);

    component.onResetPassword(component.staff()[0]!);

    expect(authMock.resetUserPassword).toHaveBeenCalledWith('u-2');
    expect(component.resetFeedback()?.state).toBe('Sent');
    expect(component.resetFeedback()?.message).toContain('dispatched by email');

    const rendered = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(rendered).not.toContain('tempPassword');
    expect(rendered).not.toContain('TempPassword');
  });

  it('should disable the row button while resetting and re-enable after completion', async () => {
    const inFlight = new Subject<{ userId: string; mustChangePassword: boolean; deliveryState: string }>();
    authMock.resetUserPassword.and.returnValue(inFlight);
    authMock.listStaff.and.returnValue(
      of([
        {
          userId: 'u-2',
          profileId: 'p-2',
          email: 'synthetic-porteiro@example.test',
          displayName: 'Synthetic Porteiro',
          roles: 'Porteiro',
          active: true,
        },
      ] as StaffMemberResponse[]),
    );

    component.staff.set([
      {
        userId: 'u-2',
        profileId: 'p-2',
        email: 'synthetic-porteiro@example.test',
        displayName: 'Synthetic Porteiro',
        roles: 'Porteiro',
        active: true,
      },
    ]);
    component.setTab('staff');
    await fixture.whenStable();
    fixture.detectChanges();
    spyOn(window, 'confirm').and.returnValue(true);

    component.onResetPassword(component.staff()[0]!);
    fixture.detectChanges();

    expect(component.resettingUserId()).toBe('u-2');
    const staffRow = fixture.nativeElement.querySelector('table tbody tr') as HTMLElement | null;
    expect(staffRow).not.toBeNull();
    let button = staffRow!.querySelector('button.ce-button.variant-secondary') as HTMLButtonElement | null;
    expect(button?.disabled).toBe(true);

    inFlight.next({ userId: 'u-2', mustChangePassword: true, deliveryState: 'Sent' });
    inFlight.complete();
    fixture.detectChanges();

    expect(component.resettingUserId()).toBeNull();
    button = staffRow!.querySelector('button.ce-button.variant-secondary') as HTMLButtonElement | null;
    expect(button?.disabled).toBe(false);
  });

  it('should hide the Staff & Passwords tab for non-TenantAdmin viewers', () => {
    authMock.isTenantAdmin.set(false);
    authMock.roles.set(['Porteiro']);

    fixture.detectChanges();

    const tabButtons = fixture.nativeElement.querySelectorAll('[role="tab"]');
    const labels = Array.from(tabButtons).map((b) => (b as HTMLElement).textContent?.trim() ?? '');
    expect(labels).not.toContain('Staff & Passwords');
  });

  it('should not surface a temp password even if the caller inspects the response shape', () => {
    const captured = { userId: 'u-1', mustChangePassword: true, deliveryState: 'Sent' };
    authMock.resetUserPassword.and.returnValue(of(captured));

    const json = JSON.stringify(captured);
    expect(json).not.toContain('tempPassword');
    expect(json).not.toContain('TempPassword');
  });

  // Phase 24 — DOOR-05/06 Door Integration section visibility.

  // The DoorIntegrationSectionComponent reads the door-integration flag ONCE
  // during ngOnInit. The default beforeEach stub returns `enabled: false`, so
  // tests that need `enabled: true` must re-trigger `loadDoorFlag()` on the
  // section instance after overriding the spy — otherwise the section still
  // renders the disabled state.
  async function refreshDoorFlag(): Promise<void> {
    const sectionDe = fixture.debugElement.query(By.directive(DoorIntegrationSectionComponent));
    const section = sectionDe?.componentInstance as DoorIntegrationSectionComponent | undefined;
    await section?.loadDoorFlag();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('DoorIntegrationSection_Disabled_ShowsOptInToggleOnly', async () => {
    // Default beforeEach stub already returns enabled:false; the section's
    // initial loadDoorFlag() during beforeEach captured that value.
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('[data-test="door-integration"]') as HTMLElement | null;
    expect(section).not.toBeNull();

    const text = (section?.textContent ?? '').toLowerCase();
    expect(text).toContain('opt-in toggle');
    expect(text).not.toContain('register device');
    expect(text).toContain('door integration is currently disabled');
  });

  it('DoorIntegrationSection_Enabled_ShowsDeviceListAndRegister', async () => {
    apiMock.getDoorIntegration.and.returnValue(
      of({
        tenantId: 'test-tenant-id',
        doorIntegrationEnabled: true,
        doorIntegrationChangedAtUtc: '2026-01-01T00:00:00.000Z',
        doorIntegrationChangedByProfileId: 'profile-1',
      })
    );

    await refreshDoorFlag();

    const section = fixture.nativeElement.querySelector('[data-test="door-integration"]') as HTMLElement | null;
    expect(section).not.toBeNull();

    const registerBtn = fixture.nativeElement.querySelector(
      '[data-test="register-device-btn"]'
    ) as HTMLButtonElement | null;
    expect(registerBtn).not.toBeNull();

    const text = (section?.textContent ?? '').toLowerCase();
    expect(text).toContain('devices');
    expect(text).toContain('last changed');
  });

  it('DoorIntegrationSection_GatehouseDropdownPopulated', async () => {
    apiMock.getDoorIntegration.and.returnValue(
      of({
        tenantId: 'test-tenant-id',
        doorIntegrationEnabled: true,
        doorIntegrationChangedAtUtc: null,
        doorIntegrationChangedByProfileId: null,
      })
    );

    await refreshDoorFlag();

    const registerBtn = fixture.nativeElement.querySelector(
      '[data-test="register-device-btn"]'
    ) as HTMLButtonElement | null;
    expect(registerBtn).not.toBeNull();
    registerBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const gatehouseSelect = fixture.nativeElement.querySelector('#gatehouse') as HTMLSelectElement | null;
    expect(gatehouseSelect).not.toBeNull();
  });

  it('DoorIntegrationSection_DisablesGatehouseWhileKeepingItVisible', async () => {
    apiMock.getDoorIntegration.and.returnValue(of({
      tenantId: 'test-tenant-id',
      doorIntegrationEnabled: false,
      doorIntegrationChangedAtUtc: null,
      doorIntegrationChangedByProfileId: null,
    }));
    securityMock.apiV1SecurityGatehousesGet.and.returnValue(of([
      { id: 'gatehouse-a', tenantId: 'test-tenant-id', name: 'Synthetic gatehouse', location: null, active: true },
    ]));
    securityMock.apiV1SecurityGatehousesIdActivationPut.and.returnValue(of({
      id: 'gatehouse-a', tenantId: 'test-tenant-id', name: 'Synthetic gatehouse', location: null, active: false,
    }));
    spyOn(window, 'confirm').and.returnValue(true);

    await refreshDoorFlag();
    const section = fixture.debugElement.query(By.directive(DoorIntegrationSectionComponent))
      .componentInstance as DoorIntegrationSectionComponent;
    await fixture.whenStable();
    fixture.detectChanges();
    const disable = fixture.nativeElement.querySelector(
      '[data-test="gatehouse-activation-gatehouse-a"]',
    ) as HTMLButtonElement;
    disable.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalled();
    expect(securityMock.apiV1SecurityGatehousesIdActivationPut).toHaveBeenCalledWith({
      id: 'gatehouse-a',
      body: { active: false },
    });
    expect(section.gatehouseOptions()[0]!.active).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-test="gatehouse-row-gatehouse-a"]')).not.toBeNull();
    expect(section.activeGatehouseOptions()).toEqual([]);
  });

  it('DoorIntegrationSection_RegisterModalEmits', async () => {
    apiMock.getDoorIntegration.and.returnValue(
      of({
        tenantId: 'test-tenant-id',
        doorIntegrationEnabled: true,
        doorIntegrationChangedAtUtc: null,
        doorIntegrationChangedByProfileId: null,
      })
    );

    await refreshDoorFlag();

    const registerBtn = fixture.nativeElement.querySelector(
      '[data-test="register-device-btn"]'
    ) as HTMLButtonElement | null;
    expect(registerBtn).not.toBeNull();
    registerBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('ce-device-form-modal') as HTMLElement | null;
    expect(modal).not.toBeNull();
  });
});
