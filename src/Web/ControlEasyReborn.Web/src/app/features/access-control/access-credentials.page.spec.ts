import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AccessCredentialsPage } from './access-credentials.page';
import { GatewayControlService } from './gateway-control.service';
import { AuthService } from '../../core/services/auth.service';

describe('AccessCredentialsPage', () => {
  let fixture: ComponentFixture<AccessCredentialsPage>;
  let component: AccessCredentialsPage;
  let httpMock: HttpTestingController;
  let authServiceMock: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authServiceMock = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    authServiceMock.hasPermission.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [AccessCredentialsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GatewayControlService,
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccessCredentialsPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders credentials heading and loads credentials list', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/access-credentials');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: '00000000-0000-0000-0000-000000000001',
        subjectType: 'visitor',
        subjectId: '00000000-0000-0000-0000-0000000000aa',
        method: 'qr',
        status: 'active',
        validFromUtc: '2026-09-18T12:00:00Z',
        expiresAtUtc: '2026-09-19T12:00:00Z',
        createdAtUtc: '2026-09-18T12:00:00Z',
      },
    ]);

    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Access credentials');
    expect(html).toContain('Visitor');
    expect(html).toContain('active');
  });

  it('issues a credential and opens QR pass modal with returned token', () => {
    fixture.detectChanges();

    const initialReq = httpMock.expectOne('/api/v1/access-credentials');
    initialReq.flush([]);
    fixture.detectChanges();

    component.openIssueModal({
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-0000000000bb',
    });
    fixture.detectChanges();

    component.submitIssue();

    const issueReq = httpMock.expectOne('/api/v1/access-credentials');
    expect(issueReq.request.method).toBe('POST');
    expect(issueReq.request.body).toEqual({
      subjectType: 'visitor',
      subjectId: '00000000-0000-0000-0000-0000000000bb',
      expiresAtUtc: null,
    });
    issueReq.flush({
      id: '00000000-0000-0000-0000-000000000002',
      qrPayload: 'cryptographic-token-abc-1234567890',
      oneTimeDisplay: true,
    });

    // It reloads credentials
    const reloadReq = httpMock.expectOne('/api/v1/access-credentials');
    reloadReq.flush([]);

    fixture.detectChanges();
    expect(component.qrPassModalOpen()).toBeTrue();
    expect(component.activeQrPayload()).toBe('cryptographic-token-abc-1234567890');
  });

  it('pre-fills subjectId with a valid random UUID when opened without prefill', () => {
    fixture.detectChanges();
    const initialReq = httpMock.expectOne('/api/v1/access-credentials');
    initialReq.flush([]);

    component.openIssueModal();
    fixture.detectChanges();

    const uuid = component.issueForm.get('subjectId')?.value;
    expect(uuid).toBeTruthy();
    expect(uuid).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
  });

  it('generates a new random UUID when regenerateSubjectId is called', () => {
    fixture.detectChanges();
    const initialReq = httpMock.expectOne('/api/v1/access-credentials');
    initialReq.flush([]);

    component.openIssueModal();
    const firstUuid = component.issueForm.get('subjectId')?.value;

    component.regenerateSubjectId();
    const secondUuid = component.issueForm.get('subjectId')?.value;

    expect(secondUuid).toBeTruthy();
    expect(secondUuid).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
    expect(secondUuid).not.toBe(firstUuid);
  });

  it('loads residents and selects a resident when subjectType is resident', () => {
    fixture.detectChanges();
    const initialReq = httpMock.expectOne('/api/v1/access-credentials');
    initialReq.flush([]);

    component.openIssueModal({
      subjectType: 'resident',
      subjectId: '00000000-0000-0000-0000-000000000011',
    });
    const residentsReq = httpMock.expectOne('/api/v1/residents');
    expect(residentsReq.request.method).toBe('GET');
    residentsReq.flush([
      { id: '00000000-0000-0000-0000-000000000011', name: 'Felipe Silva' },
      { id: '00000000-0000-0000-0000-000000000022', name: 'Maria Souza' },
    ]);
    fixture.detectChanges();

    expect(component.residents().length).toBe(2);
    expect(component.selectedResidentId()).toBe('00000000-0000-0000-0000-000000000011');
  });
});
