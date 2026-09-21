import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { VisitCreateModalComponent } from './visit-create-modal.component';
import { VisitsApiService } from './visits-api.service';
import { GatewayControlService } from '../access-control/gateway-control.service';

describe('VisitCreateModalComponent', () => {
  let fixture: ComponentFixture<VisitCreateModalComponent>;
  let component: VisitCreateModalComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisitCreateModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), VisitsApiService, GatewayControlService],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VisitCreateModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders modal when open is true and has generate QR checkbox', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    // Apartment picker calls /api/v1/apartments
    const aptReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=500');
    aptReq.flush([]);

    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Add visit');
    expect(html).toContain('Generate QR access pass for visitor');
  });

  it('creates a visit and generates a QR pass when checkbox is checked', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const aptReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=500');
    aptReq.flush([]);

    component.form.patchValue({
      visitorName: 'Lucas Lima',
      visitorDocument: '11122233344',
      apartmentId: '00000000-0000-0000-0000-000000000055',
      generateQrPass: true,
    });
    fixture.detectChanges();

    let emittedResult: any = null;
    component.created.subscribe((res) => {
      emittedResult = res;
    });

    component.submit();

    const createReq = httpMock.expectOne('/api/v1/visits');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({
      id: '00000000-0000-0000-0000-000000000077',
      tenantId: '00000000-0000-0000-0000-000000000001',
      visitorName: 'Lucas Lima',
      visitorDocument: '11122233344',
      visitorPhone: null,
      apartmentId: '00000000-0000-0000-0000-000000000055',
      purpose: null,
      status: 'Pending',
      checkedInAtUtc: null,
      checkedOutAtUtc: null,
      createdAtUtc: '2026-09-18T10:00:00Z',
    });

    const issueReq = httpMock.expectOne('/api/v1/access-credentials');
    expect(issueReq.request.method).toBe('POST');
    expect(issueReq.request.body).toEqual({
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-000000000077',
    });
    issueReq.flush({
      id: '00000000-0000-0000-0000-000000000088',
      qrPayload: 'qr-token-for-lucas-lima',
      oneTimeDisplay: true,
    });

    expect(emittedResult).toBeTruthy();
    expect(emittedResult.visit.visitorName).toBe('Lucas Lima');
    expect(emittedResult.qrPayload).toBe('qr-token-for-lucas-lima');
  });
});
