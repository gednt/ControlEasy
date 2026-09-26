import { ComponentFixture, TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ApartmentsApiService } from '../apartments/apartments-api.service';
import { VehiclesApiService } from './vehicles-api.service';
import { VehiclesPage } from './vehicles.page';
import { CE_LUCIDE_ICONS } from '../../design-system/components/icon/icon.registry';

describe('VehiclesPage', () => {
  let fixture: ComponentFixture<VehiclesPage>;
  let component: VehiclesPage;
  let vehiclesApi: jasmine.SpyObj<VehiclesApiService>;

  beforeEach(async () => {
    vehiclesApi = jasmine.createSpyObj<VehiclesApiService>('VehiclesApiService', ['list', 'create', 'get', 'update']);
    vehiclesApi.list.and.returnValue(of([]));
    vehiclesApi.create.and.returnValue(
      of({
        id: 'vehicle-1',
        tenantId: 'tenant-1',
        plate: 'ABC1D23',
        brand: null,
        model: null,
        color: null,
        apartmentId: null,
        ownerName: null,
        vehicleType: 2,
        active: true,
        createdAtUtc: '2026-09-20T00:00:00Z',
      }),
    );

    const apartmentsApi = jasmine.createSpyObj<ApartmentsApiService>('ApartmentsApiService', ['list']);
    apartmentsApi.list.and.returnValue(of([]));
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [VehiclesPage],
      providers: [
        importProvidersFrom(CE_LUCIDE_ICONS),
        { provide: VehiclesApiService, useValue: vehiclesApi },
        { provide: ApartmentsApiService, useValue: apartmentsApi },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehiclesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('posts a numeric vehicle type when creating a vehicle', () => {
    component.openCreateModal();
    component.createForm.patchValue({ plate: 'ABC1D23', vehicleType: 2 });

    component.onCreate();

    expect(vehiclesApi.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        plate: 'ABC1D23',
        vehicleType: 2,
      }),
    );
  });

  it('renders no Unicode decimal-entity icon glyphs (uses ce-icon)', () => {
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('&#128663;');
    expect(html).not.toContain('&#8635;');
    expect(html).not.toContain('&#43;');
    expect(html).not.toContain('&#128247;');
    expect(html).not.toContain('&#9998;');
    expect(fixture.nativeElement.querySelector('ce-icon')).not.toBeNull();
  });
});
