import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { importProvidersFrom } from '@angular/core';
import { ServiceProvidersPage } from './service-providers.page';
import { ServiceProvidersApiService } from './service-providers-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CE_LUCIDE_ICONS } from '../../design-system/components/icon/icon.registry';

describe('ServiceProvidersPage', () => {
  let fixture: ComponentFixture<ServiceProvidersPage>;
  let component: ServiceProvidersPage;
  let httpMock: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;

  const provider = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000010',
    name: 'Clean Co',
    document: '11222333000181',
    phone: '11999990000',
    email: 'contact@clean.co',
    serviceType: 'Cleaning',
    company: 'Clean Co Ltd',
    active: true,
    createdAtUtc: '2026-09-20T10:00:00Z',
  };

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [ServiceProvidersPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        importProvidersFrom(CE_LUCIDE_ICONS),
        ServiceProvidersApiService,
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServiceProvidersPage);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  function loadProviders(): void {
    fixture.detectChanges();
    const request = httpMock.expectOne('/api/v1/service-providers?skip=0&take=50');
    request.flush([provider]);
    fixture.detectChanges();
  }

  it('prefills the edit form and saves all editable provider details', () => {
    loadProviders();

    component.openEdit(provider);
    expect(component.editForm.getRawValue()).toEqual({
      name: 'Clean Co',
      document: '11222333000181',
      phone: '11999990000',
      email: 'contact@clean.co',
      serviceType: 'Cleaning',
      company: 'Clean Co Ltd',
    });

    component.editForm.patchValue({ phone: '11888880000' });
    component.saveEdit();

    const request = httpMock.expectOne(`/api/v1/service-providers/${provider.id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.phone).toBe('11888880000');
    request.flush({ ...provider, phone: '11888880000' });

    expect(component.providers()[0]!.phone).toBe('11888880000');
  });

  it('requires confirmation and then disables an active provider', () => {
    loadProviders();

    component.openDisableConfirmation(provider);
    expect(component.disableTarget()).toEqual(provider);

    component.confirmDisable();
    const request = httpMock.expectOne(`/api/v1/service-providers/${provider.id}/deactivate`);
    expect(request.request.method).toBe('POST');
    request.flush({ ...provider, active: false });

    expect(component.providers()[0]!.active).toBeFalse();
    expect(component.disableTarget()).toBeNull();
  });
});
