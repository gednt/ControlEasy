import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { GatehousePanelPage } from './gatehouse-panel.page';
import { VisitsApiService } from '../visits/visits-api.service';
import { ApartmentsApiService } from '../apartments/apartments-api.service';
import { GatewayControlService } from '../access-control/gateway-control.service';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { CE_LUCIDE_ICONS } from '../../design-system/components/icon/icon.registry';
import { DeviceHealthService, DeviceStatusTransition } from '../devices/device-health.service';
import { DeviceHealthDto } from '../devices/door-unlock.types';

class FakeDeviceHealthService {
  readonly health$ = new BehaviorSubject<DeviceHealthDto[]>([]);
  readonly offlineAlerts$ = new Subject<DeviceStatusTransition>();
  private stopPollingCalls = 0;

  startPolling(): void {
    /* no-op for tests */
  }

  stopPolling(): void {
    this.stopPollingCalls += 1;
  }

  getStopPollingCalls(): number {
    return this.stopPollingCalls;
  }
}

describe('GatehousePanelPage', () => {
  let fixture: ComponentFixture<GatehousePanelPage>;
  let component: GatehousePanelPage;
  let httpMock: HttpTestingController;
  let deviceHealth: FakeDeviceHealthService;

  const queryParamsSubject = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    spyOn(BrowserMultiFormatReader.prototype, 'decodeFromVideoDevice').and.returnValue(
      Promise.resolve({ stop: jasmine.createSpy('stop') } as unknown as IScannerControls),
    );

    deviceHealth = new FakeDeviceHealthService();

    await TestBed.configureTestingModule({
      imports: [GatehousePanelPage],
      providers: [
        importProvidersFrom(CE_LUCIDE_ICONS),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        VisitsApiService,
        ApartmentsApiService,
        GatewayControlService,
        { provide: DeviceHealthService, useValue: deviceHealth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {},
              queryParamMap: convertToParamMap({}),
            },
            queryParamMap: queryParamsSubject.asObservable(),
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GatehousePanelPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushInitialRequests(): void {
    const aptsReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=200');
    aptsReq.flush([]);

    const visitsReq = httpMock.expectOne('/api/v1/visits?skip=0&take=100&status=CheckedIn');
    visitsReq.flush([]);
  }

  it('renders operator panel and defaults to QR scan tab', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    expect(component.activeTab()).toBe('qr');
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Gatehouse operator panel');
    expect(html).toContain('Scan QR');
    expect(html).toContain('Manual lookup');
    expect(html).toContain('Walk-in registration');
    expect(html).toContain('Open visits');
  }));

  it('opens the no-entry package-drop workflow from the gatehouse panel', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    const packageDropButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="package-drop-btn"]',
    );
    expect(packageDropButton).withContext('package-drop action').not.toBeNull();

    packageDropButton?.click();
    fixture.detectChanges();
    flush();

    expect(component.packageDropOpen()).toBeTrue();
  }));

  it('records a package drop against the selected recipient apartment', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    component.openPackageDrop();
    component.packageDropForm.setValue({
      recipientQuery: 'Ana Souza',
      packageDescription: 'Two boxes',
      packageCarrierCode: 'Correios',
    });
    component.searchPackageRecipient();

    const searchRequest = httpMock.expectOne('/api/v1/access-subjects/search');
    expect(searchRequest.request.body).toEqual({ criterion: 'name', value: 'Ana Souza', unit: null });
    searchRequest.flush({
      lookupAuditId: '00000000-0000-0000-0000-000000000020',
      criterion: 'name',
      resultCountBand: 'one',
      items: [
        {
          subjectType: 'resident',
          subjectId: '00000000-0000-0000-0000-000000000010',
          apartmentId: '00000000-0000-0000-0000-000000000001',
          apartmentBlock: 'A',
          apartmentUnit: '101',
          displayName: 'Ana Souza',
        },
      ],
    });
    tick();

    component.selectPackageRecipient(component.packageDropResults()[0]!);
    component.submitPackageDrop();

    const packageDropRequest = httpMock.expectOne('/api/v1/access-events/manual');
    expect(packageDropRequest.request.body).toEqual({
      lookupAuditId: '00000000-0000-0000-0000-000000000020',
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-000000000001',
      direction: 'entrance',
      gatehouseId: null,
      kind: 'package-drop',
      packageDescription: 'Two boxes',
      packageCarrierCode: 'Correios',
    });
    packageDropRequest.flush({
      accessEventId: '00000000-0000-0000-0000-000000000030',
      lookupAuditId: '00000000-0000-0000-0000-000000000020',
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-000000000001',
      accessMethod: 'manual_lookup',
      direction: 'entrance',
      destinationApartmentId: '00000000-0000-0000-0000-000000000001',
      destinationBlock: 'A',
      destinationUnit: '101',
    });
    tick();
    flush();

    expect(component.packageDropOpen()).toBeFalse();
  }));

  it('switches tabs when tab buttons are clicked', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    component.selectTab('manual');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('manual');

    component.selectTab('walkin');
    fixture.detectChanges();

    const walkinApartmentsReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=500');
    walkinApartmentsReq.flush([]);
    expect(component.activeTab()).toBe('walkin');

    component.selectTab('visits');
    fixture.detectChanges();

    const visitsReq = httpMock.expectOne('/api/v1/visits?skip=0&take=100&status=CheckedIn');
    visitsReq.flush([]);
    expect(component.activeTab()).toBe('visits');
  }));

  it('registers walk-in visitor with checkInNow: true', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    component.selectTab('walkin');
    fixture.detectChanges();

    const walkinApartmentsReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=500');
    walkinApartmentsReq.flush([]);

    component.walkinForm.setValue({
      visitorName: 'Carlos Silva',
      visitorDocument: '111.222.333-44',
      visitorPhone: '11988887777',
      apartmentId: '00000000-0000-0000-0000-000000000001',
      purpose: 'Delivery',
      generateQrPass: true,
    });

    component.submitWalkin();

    const createReq = httpMock.expectOne('/api/v1/visits');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      visitorName: 'Carlos Silva',
      visitorDocument: '111.222.333-44',
      visitorPhone: '11988887777',
      apartmentId: '00000000-0000-0000-0000-000000000001',
      purpose: 'Delivery',
      checkInNow: true,
    });

    createReq.flush({
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: '00000000-0000-0000-0000-000000000099',
      visitorName: 'Carlos Silva',
      visitorDocument: '111.222.333-44',
      visitorPhone: '11988887777',
      apartmentId: '00000000-0000-0000-0000-000000000001',
      purpose: 'Delivery',
      status: 'CheckedIn',
      checkedInAtUtc: new Date().toISOString(),
      checkedOutAtUtc: null,
      createdAtUtc: new Date().toISOString(),
    });

    const refreshVisits = httpMock.expectOne('/api/v1/visits?skip=0&take=100&status=CheckedIn');
    refreshVisits.flush([]);

    const credReq = httpMock.expectOne('/api/v1/access-credentials');
    expect(credReq.request.body).toEqual({
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-000000000010',
    });
    credReq.flush({
      id: '00000000-0000-0000-0000-000000000055',
      qrPayload: 'token-for-carlos',
      oneTimeDisplay: true,
    });

    fixture.detectChanges();
    expect(component.walkinSuccess()).toBeTruthy();
    expect(component.walkinSuccess()?.visit.visitorName).toBe('Carlos Silva');
    expect(component.walkinSuccess()?.qrPayload).toBe('token-for-carlos');
  }));

  it('checks out an on-site visit and reloads the list', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    const mockVisit = {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: '00000000-0000-0000-0000-000000000099',
      visitorName: 'Ana Souza',
      visitorDocument: '999.888.777-66',
      visitorPhone: null,
      apartmentId: null,
      purpose: 'Visit',
      status: 'CheckedIn',
      checkedInAtUtc: new Date().toISOString(),
      checkedOutAtUtc: null,
      createdAtUtc: new Date().toISOString(),
    };

    component.checkOutVisit(mockVisit);

    const checkOutReq = httpMock.expectOne('/api/v1/visits/00000000-0000-0000-0000-000000000010/checkout');
    expect(checkOutReq.request.method).toBe('POST');
    checkOutReq.flush({ ...mockVisit, status: 'CheckedOut', checkedOutAtUtc: new Date().toISOString() });

    const reloadReq = httpMock.expectOne('/api/v1/visits?skip=0&take=100&status=CheckedIn');
    reloadReq.flush([]);

    fixture.detectChanges();
    expect(component.actionInFlight()).toBeNull();
  }));

  it('records a condominium-level package drop with an empty subjectId', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    component.openPackageDrop();
    component.packageDropForm.setValue({
      recipientQuery: 'Condo Mailroom',
      packageDescription: 'Mailroom envelope',
      packageCarrierCode: 'Correios',
    });

    component.selectPackageDropCondominium();
    const searchRequest = httpMock.expectOne('/api/v1/access-subjects/search');
    expect(searchRequest.request.body).toEqual({ criterion: 'name', value: 'Condo Mailroom', unit: null });
    searchRequest.flush({
      lookupAuditId: '00000000-0000-0000-0000-000000000040',
      criterion: 'name',
      resultCountBand: 'none',
      items: [],
    });
    tick();
    fixture.detectChanges();

    expect(component.packageDropCondominium()).toBeTrue();

    component.submitPackageDrop();

    const packageDropRequest = httpMock.expectOne('/api/v1/access-events/manual');
    expect(packageDropRequest.request.body).toEqual({
      lookupAuditId: '00000000-0000-0000-0000-000000000040',
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-000000000000',
      direction: 'entrance',
      gatehouseId: null,
      kind: 'package-drop',
      packageDescription: 'Mailroom envelope',
      packageCarrierCode: 'Correios',
    });
    packageDropRequest.flush({
      accessEventId: '00000000-0000-0000-0000-000000000041',
      lookupAuditId: '00000000-0000-0000-0000-000000000040',
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-000000000000',
      accessMethod: 'manual_lookup',
      direction: 'entrance',
      destinationApartmentId: null,
      destinationBlock: 'Gatehouse',
      destinationUnit: 'Reception',
    });
    tick();
    flush();

    expect(component.packageDropOpen()).toBeFalse();
  }));

  // -------- Phase 26 (DOOR-14) offline-alert toast --------

  it('OfflineAlert_Renders_WhenDeviceTransitionsToOffline', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    // Emit an offline transition; the toast wrapper should appear.
    deviceHealth.offlineAlerts$.next({
      kind: 'offline',
      device: {
        deviceId: 'd1',
        vendor: 'Control iD',
        deviceType: 'reader',
        gatehouseId: null,
        gatehouseName: 'Portaria A',
        status: 'Offline',
        statusLabel: 'Offline',
        lastHeartbeatAtUtc: new Date(Date.now() - 5 * 60_000).toISOString(),
        errorCount: 0,
        eventsSinceLastSuccess: 10,
        errorRatePercent: 0,
        offlineAfterSeconds: 60,
        errorRateThresholdPercent: 10,
        isOfflineExceeded: true,
      },
      elapsedMs: 5 * 60_000,
    });
    fixture.detectChanges();
    tick();

    const wrapper = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test="device-offline-toast"]'
    );
    expect(wrapper).withContext('offline-toast wrapper').not.toBeNull();
    const text = wrapper?.textContent ?? '';
    expect(text).toContain('Control iD');
    expect(text).toContain('Portaria A');
    expect(text).toContain("hasn't checked in for");
  }));

  it('Dismiss_ClearsAlertLocally_DoesNotAffectService', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    deviceHealth.offlineAlerts$.next({
      kind: 'offline',
      device: {
        deviceId: 'd1',
        vendor: 'Control iD',
        deviceType: 'reader',
        gatehouseId: null,
        gatehouseName: 'Portaria A',
        status: 'Offline',
        statusLabel: 'Offline',
        lastHeartbeatAtUtc: new Date(Date.now() - 60_000).toISOString(),
        errorCount: 0,
        eventsSinceLastSuccess: 10,
        errorRatePercent: 0,
        offlineAfterSeconds: 60,
        errorRateThresholdPercent: 10,
        isOfflineExceeded: true,
      },
      elapsedMs: 60_000,
    });
    fixture.detectChanges();
    tick();

    // Click dismiss.
    const dismiss = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="device-offline-toast-dismiss"]'
    );
    expect(dismiss).not.toBeNull();
    dismiss?.click();
    fixture.detectChanges();
    tick();

    // The wrapper is gone locally, but the service's offlineAlerts$ has
    // not been touched (the same Subject instance is still in scope).
    // Re-emitting should still surface.
    const wrapperAfter = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test="device-offline-toast"]'
    );
    expect(wrapperAfter).withContext('local toast cleared').toBeNull();

    deviceHealth.offlineAlerts$.next({
      kind: 'offline',
      device: {
        deviceId: 'd2',
        vendor: 'Intelbras',
        deviceType: 'controller',
        gatehouseId: null,
        gatehouseName: 'Portaria B',
        status: 'Offline',
        statusLabel: 'Offline',
        lastHeartbeatAtUtc: new Date().toISOString(),
        errorCount: 0,
        eventsSinceLastSuccess: 1,
        errorRatePercent: 0,
        offlineAfterSeconds: 60,
        errorRateThresholdPercent: 10,
        isOfflineExceeded: true,
      },
      elapsedMs: 0,
    });
    fixture.detectChanges();
    tick();
    const wrapperResurface = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test="device-offline-toast"]'
    );
    expect(wrapperResurface).not.toBeNull();
    expect((wrapperResurface?.textContent ?? '')).toContain('Intelbras');
  }));

  it('NoAlert_WhenAllDevicesOnline', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    // No offlineAlerts$ emit -> the wrapper should NOT appear.
    const wrapper = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test="device-offline-toast"]'
    );
    expect(wrapper).withContext('no offline toast when all online').toBeNull();
  }));
});
