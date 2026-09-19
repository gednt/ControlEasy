import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GatehousePanelPage } from './gatehouse-panel.page';
import { VisitsApiService } from '../visits/visits-api.service';
import { ApartmentsApiService } from '../apartments/apartments-api.service';
import { GatewayControlService } from '../access-control/gateway-control.service';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

describe('GatehousePanelPage', () => {
  let fixture: ComponentFixture<GatehousePanelPage>;
  let component: GatehousePanelPage;
  let httpMock: HttpTestingController;

  const queryParamsSubject = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    spyOn(BrowserMultiFormatReader.prototype, 'decodeFromVideoDevice').and.returnValue(
      Promise.resolve({ stop: jasmine.createSpy('stop') } as unknown as IScannerControls),
    );

    await TestBed.configureTestingModule({
      imports: [GatehousePanelPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        VisitsApiService,
        ApartmentsApiService,
        GatewayControlService,
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

  it('switches tabs when tab buttons are clicked', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    component.selectTab('manual');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('manual');

    component.selectTab('walkin');
    fixture.detectChanges();
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
});
