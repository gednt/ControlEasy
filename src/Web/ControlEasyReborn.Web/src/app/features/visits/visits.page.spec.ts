import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { VisitsPage } from './visits.page';
import { VisitsApiService } from './visits-api.service';
import { ApartmentsApiService } from '../apartments/apartments-api.service';
import { GatewayControlService } from '../access-control/gateway-control.service';

describe('VisitsPage', () => {
  let fixture: ComponentFixture<VisitsPage>;
  let component: VisitsPage;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisitsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        VisitsApiService,
        ApartmentsApiService,
        GatewayControlService,
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VisitsPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders visits and shows QR pass button for pending visits', () => {
    fixture.detectChanges();

    const aptReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=500');
    aptReq.flush([]);

    const visitsReq = httpMock.expectOne('/api/v1/visits?skip=0&take=50');
    visitsReq.flush([
      {
        id: '00000000-0000-0000-0000-000000000010',
        tenantId: '00000000-0000-0000-0000-000000000001',
        visitorName: 'Maria Santos',
        visitorDocument: '12345678900',
        visitorPhone: '1199999999',
        apartmentId: null,
        purpose: 'Delivery',
        status: 'Pending',
        checkedInAtUtc: null,
        checkedOutAtUtc: null,
        createdAtUtc: '2026-09-18T10:00:00Z',
      },
    ]);

    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Maria Santos');
    expect(html).toContain('QR Pass');
  });

  it('generates a QR pass when QR Pass button is clicked', () => {
    fixture.detectChanges();

    const aptReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=500');
    aptReq.flush([]);

    const visitsReq = httpMock.expectOne('/api/v1/visits?skip=0&take=50');
    const mockVisit = {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: '00000000-0000-0000-0000-000000000001',
      visitorName: 'Maria Santos',
      visitorDocument: '12345678900',
      visitorPhone: '1199999999',
      apartmentId: null,
      purpose: 'Delivery',
      status: 'Pending',
      checkedInAtUtc: null,
      checkedOutAtUtc: null,
      createdAtUtc: '2026-09-18T10:00:00Z',
    };
    visitsReq.flush([mockVisit]);
    fixture.detectChanges();

    component.onGenerateQrPass(mockVisit);

    const issueReq = httpMock.expectOne('/api/v1/access-credentials');
    expect(issueReq.request.method).toBe('POST');
    expect(issueReq.request.body).toEqual({
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-000000000010',
    });
    issueReq.flush({
      id: '00000000-0000-0000-0000-000000000099',
      qrPayload: 'qr-token-for-maria-santos',
      oneTimeDisplay: true,
    });

    fixture.detectChanges();
    expect(component.qrPassModalOpen()).toBeTrue();
    expect(component.activeQrPayload()).toBe('qr-token-for-maria-santos');
    expect(component.activeSubjectName()).toBe('Maria Santos');
  });
});
