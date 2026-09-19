import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AccessCredentialsPage } from './access-credentials.page';
import { GatewayControlService } from './gateway-control.service';
import { AuthService } from '../../core/services/auth.service';
import { ApartmentsApiService } from '../apartments/apartments-api.service';
import { ResidentsApiService } from '../residents/residents-api.service';
import { VehiclesApiService } from '../vehicles/vehicles-api.service';

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
        ApartmentsApiService,
        ResidentsApiService,
        VehiclesApiService,
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

  function flushInitialRequests(
    credentials: any[] = [],
    apartments: any[] = [],
    residents: any[] = [],
    vehicles: any[] = []
  ): void {
    const credReq = httpMock.expectOne('/api/v1/access-credentials');
    expect(credReq.request.method).toBe('GET');
    credReq.flush(credentials);

    const aptReq = httpMock.expectOne((req) => req.url.includes('/api/v1/apartments'));
    aptReq.flush(apartments);

    const resReq = httpMock.expectOne('/api/v1/residents');
    resReq.flush(residents);

    const vehReq = httpMock.expectOne((req) => req.url.includes('/api/v1/vehicles'));
    vehReq.flush(vehicles);
  }

  it('renders credentials heading and loads credentials list with resolved owner and apartment', () => {
    fixture.detectChanges();

    flushInitialRequests(
      [
        {
          id: '00000000-0000-0000-0000-000000000001',
          subjectType: 'resident',
          subjectId: '00000000-0000-0000-0000-0000000000aa',
          method: 'qr',
          status: 'active',
          validFromUtc: '2026-09-18T12:00:00Z',
          expiresAtUtc: '2026-09-19T12:00:00Z',
          createdAtUtc: '2026-09-18T12:00:00Z',
        },
      ],
      [{ id: 'apt-1', block: '1', unit: '51', active: true }],
      [{ id: '00000000-0000-0000-0000-0000000000aa', name: 'Felipe Silva', apartmentId: 'apt-1', active: true }],
      []
    );

    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Access credentials');
    expect(html).toContain('Felipe Silva');
    expect(html).toContain('Block 1, Unit 51');
    expect(html).toContain('active');
  });

  it('issues a credential and opens QR pass modal with returned token', () => {
    fixture.detectChanges();
    flushInitialRequests();
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

    // Reloads credentials after issuing
    const reloadReq = httpMock.expectOne('/api/v1/access-credentials');
    reloadReq.flush([]);

    fixture.detectChanges();
    expect(component.qrPassModalOpen()).toBeTrue();
    expect(component.activeQrPayload()).toBe('cryptographic-token-abc-1234567890');
  });

  it('pre-fills subjectId with a valid random UUID when opened without prefill', () => {
    fixture.detectChanges();
    flushInitialRequests();

    component.openIssueModal();
    fixture.detectChanges();

    const uuid = component.issueForm.get('subjectId')?.value;
    expect(uuid).toBeTruthy();
    expect(uuid).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
  });

  it('generates a new random UUID when regenerateSubjectId is called', () => {
    fixture.detectChanges();
    flushInitialRequests();

    component.openIssueModal();
    const firstUuid = component.issueForm.get('subjectId')?.value;

    component.regenerateSubjectId();
    const secondUuid = component.issueForm.get('subjectId')?.value;

    expect(secondUuid).toBeTruthy();
    expect(secondUuid).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
    expect(secondUuid).not.toBe(firstUuid);
  });

  it('selects a resident and explicitly displays their apartment in the summary card', () => {
    fixture.detectChanges();
    flushInitialRequests(
      [],
      [{ id: 'apt-1', block: '1', unit: '51', active: true }],
      [
        { id: '00000000-0000-0000-0000-000000000011', name: 'Felipe Silva', apartmentId: 'apt-1', active: true },
        { id: '00000000-0000-0000-0000-000000000022', name: 'Maria Souza', apartmentId: null, active: true },
      ],
      []
    );

    component.openIssueModal({
      subjectType: 'resident',
      subjectId: '00000000-0000-0000-0000-000000000011',
    });
    fixture.detectChanges();

    expect(component.residents().length).toBe(2);
    expect(component.selectedResidentId()).toBe('00000000-0000-0000-0000-000000000011');
    expect(component.selectedResident()?.name).toBe('Felipe Silva');
    expect(component.residentApartmentLabel()).toBe('Block 1, Unit 51');

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Felipe Silva');
    expect(html).toContain('Block 1, Unit 51');
  });

  it('selects a vehicle and explicitly displays vehicle details, owner, and apartment', () => {
    fixture.detectChanges();
    flushInitialRequests(
      [],
      [{ id: 'apt-1', block: '2', unit: '102', active: true }],
      [{ id: 'res-1', name: 'Joao Resident', apartmentId: 'apt-1', active: true }],
      [
        {
          id: 'veh-1',
          plate: 'ABC1D23',
          brand: 'Toyota',
          model: 'Corolla',
          color: 'Silver',
          apartmentId: 'apt-1',
          ownerName: 'Joao Resident',
          ownerResidentId: 'res-1',
          active: true,
        },
      ]
    );

    component.openIssueModal({
      subjectType: 'vehicle',
      subjectId: 'veh-1',
    });
    fixture.detectChanges();

    expect(component.vehicleMode()).toBe('select');
    expect(component.selectedVehicleId()).toBe('veh-1');
    expect(component.selectedVehicle()?.plate).toBe('ABC1D23');
    expect(component.vehicleApartmentLabel()).toBe('Block 2, Unit 102');
    expect(component.vehicleOwnerDisplay()).toBe('Joao Resident');

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('ABC1D23');
    expect(html).toContain('Block 2, Unit 102');
    expect(html).toContain('Joao Resident');
  });

  it('registers a new vehicle inline and issues vehicle credential with owner and apartment', () => {
    fixture.detectChanges();
    flushInitialRequests(
      [],
      [{ id: 'apt-1', block: '1', unit: '51', active: true }],
      [{ id: 'res-1', name: 'Felipe Silva', apartmentId: 'apt-1', active: true }],
      []
    );

    component.openIssueModal();
    component.setSubjectType('vehicle');
    expect(component.vehicleMode()).toBe('new');

    component.newVehicleForm.patchValue({
      plate: 'BRA2E19',
      brand: 'Honda',
      model: 'Civic',
      color: 'Black',
      ownerResidentId: 'res-1',
      ownerName: 'Felipe Silva',
      apartmentId: 'apt-1',
    });
    fixture.detectChanges();

    component.submitIssue();

    // 1. Vehicle creation request
    const createVehReq = httpMock.expectOne('/api/v1/vehicles');
    expect(createVehReq.request.method).toBe('POST');
    expect(createVehReq.request.body).toEqual({
      plate: 'BRA2E19',
      brand: 'Honda',
      model: 'Civic',
      color: 'Black',
      apartmentId: 'apt-1',
      ownerName: 'Felipe Silva',
      vehicleType: 'car',
    });
    createVehReq.flush({
      id: 'veh-new-99',
      plate: 'BRA2E19',
      brand: 'Honda',
      model: 'Civic',
      color: 'Black',
      apartmentId: 'apt-1',
      ownerName: 'Felipe Silva',
      active: true,
    });

    // 2. Issue credential request for the new vehicle ID
    const issueReq = httpMock.expectOne('/api/v1/access-credentials');
    expect(issueReq.request.method).toBe('POST');
    expect(issueReq.request.body.subjectType).toBe('vehicle');
    expect(issueReq.request.body.subjectId).toBe('veh-new-99');
    issueReq.flush({
      id: 'cred-new-99',
      qrPayload: 'veh-qr-payload-token-12345',
      oneTimeDisplay: true,
    });

    // Reloads credentials after issuing
    const reloadReq = httpMock.expectOne('/api/v1/access-credentials');
    reloadReq.flush([]);

    fixture.detectChanges();
    expect(component.qrPassModalOpen()).toBeTrue();
    expect(component.activeSubjectName()).toContain('BRA2E19');
    expect(component.activeDestination()).toBe('Block 1, Unit 51');
  });
});
