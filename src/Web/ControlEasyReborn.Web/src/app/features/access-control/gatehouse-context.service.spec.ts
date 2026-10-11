import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { GatehouseContextService } from './gatehouse-context.service';

class FakeAuthService {
  readonly tenantId = signal('tenant-a');
  readonly profileId = signal('profile-a');
}

describe('GatehouseContextService', () => {
  let service: GatehouseContextService;
  let httpMock: HttpTestingController;
  let auth: FakeAuthService;

  beforeEach(() => {
    auth = new FakeAuthService();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GatehouseContextService,
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(GatehouseContextService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads tenant gatehouses and restores only a still-valid saved selection', () => {
    localStorage.setItem('ce.active_gatehouse.tenant-a:profile-a', 'gatehouse-a');

    service.load();

    const request = httpMock.expectOne('/api/v1/security/gatehouses');
    request.flush([
      { id: 'gatehouse-a', name: 'Main gatehouse', location: 'North gate' },
      { id: 'gatehouse-b', name: 'Service gatehouse', location: null },
    ]);

    expect(service.selectedGatehouseId()).toBe('gatehouse-a');
    expect(service.canRecord()).toBeTrue();
  });

  it('persists the selection beyond the current browser session', () => {
    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush([
      { id: 'gatehouse-a', name: 'Main gatehouse', location: 'North gate' },
    ]);

    service.select('gatehouse-a');

    expect(localStorage.getItem('ce.active_gatehouse.tenant-a:profile-a')).toBe('gatehouse-a');
    expect(sessionStorage.getItem('ce.active_gatehouse.tenant-a:profile-a')).toBeNull();
  });

  it('clears a stale selection after the signed-in tenant changes', () => {
    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush([
      { id: 'gatehouse-a', name: 'Main gatehouse', location: null },
    ]);
    service.select('gatehouse-a');
    expect(service.canRecord()).toBeTrue();

    auth.tenantId.set('tenant-b');
    expect(service.canRecord()).toBeFalse();

    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush([
      { id: 'gatehouse-b', name: 'South gatehouse', location: null },
    ]);

    expect(service.selectedGatehouseId()).toBeNull();
    expect(service.gatehouses().map((gatehouse) => gatehouse.id)).toEqual(['gatehouse-b']);
    expect(localStorage.getItem('ce.active_gatehouse.tenant-a:profile-a')).toBeNull();
  });

  it('clears a stale selection after the signed-in profile changes', () => {
    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush([
      { id: 'gatehouse-a', name: 'Main gatehouse', location: null },
    ]);
    service.select('gatehouse-a');

    auth.profileId.set('profile-b');
    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush([
      { id: 'gatehouse-a', name: 'Main gatehouse', location: null },
    ]);

    expect(service.selectedGatehouseId()).toBeNull();
    expect(service.canRecord()).toBeFalse();
    expect(localStorage.getItem('ce.active_gatehouse.tenant-a:profile-a')).toBeNull();
  });

  it('clears a saved selection when the gatehouse disappears', () => {
    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush([
      { id: 'gatehouse-a', name: 'Main gatehouse', location: null },
      { id: 'gatehouse-b', name: 'Service gatehouse', location: null },
    ]);
    service.select('gatehouse-a');

    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush([
      { id: 'gatehouse-b', name: 'Service gatehouse', location: null },
    ]);

    expect(service.selectedGatehouseId()).toBeNull();
    expect(localStorage.getItem('ce.active_gatehouse.tenant-a:profile-a')).toBeNull();
  });

  it('can load the new session while the previous session request is still in flight', () => {
    service.load();
    const previousRequest = httpMock.expectOne('/api/v1/security/gatehouses');

    auth.tenantId.set('tenant-b');
    service.load();
    const currentRequest = httpMock.expectOne('/api/v1/security/gatehouses');
    currentRequest.flush([{ id: 'gatehouse-b', name: 'South gatehouse', location: null }]);
    previousRequest.flush([{ id: 'gatehouse-a', name: 'Main gatehouse', location: null }]);

    expect(service.gatehouses().map((gatehouse) => gatehouse.id)).toEqual(['gatehouse-b']);
    expect(service.loading()).toBeFalse();
  });

  it('marks recording unavailable when gatehouse retrieval fails', () => {
    service.load();
    httpMock.expectOne('/api/v1/security/gatehouses').flush(
      { detail: 'Unavailable' },
      { status: 503, statusText: 'Unavailable' },
    );

    expect(service.canRecord()).toBeFalse();
    expect(service.error()).toContain('could not be loaded');
  });
});
