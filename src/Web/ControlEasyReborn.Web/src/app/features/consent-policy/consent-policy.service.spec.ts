import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ConsentPolicyService } from './consent-policy.service';
import type { UpdateConsentPolicyRequest } from './consent-policy.service';

describe('ConsentPolicyService', () => {
  let service: ConsentPolicyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConsentPolicyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByCategory GETs /api/v1/consent-policy/{cat}', () => {
    service.getByCategory('visitors').subscribe();
    const req = httpMock.expectOne('/api/v1/consent-policy/visitors');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'p-1',
      tenantId: 't-1',
      subjectCategory: 'visitors',
      photoRequired: true,
      createdAtUtc: new Date().toISOString(),
    });
  });

  it('getByCategory returns null on 404', (done) => {
    service.getByCategory('vehicles').subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
    const req = httpMock.expectOne('/api/v1/consent-policy/vehicles');
    req.flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('getAll fires 4 parallel GETs and filters 404s', (done) => {
    service.getAll().subscribe((policies) => {
      expect(policies.length).toBe(3); // vehicles -> null
      expect(policies.map((p) => p.subjectCategory).sort()).toEqual(['dwellers', 'service-providers', 'visitors']);
      done();
    });

    const cats = ['dwellers', 'visitors', 'service-providers', 'vehicles'];
    for (const cat of cats) {
      const req = httpMock.expectOne(`/api/v1/consent-policy/${cat}`);
      if (cat === 'vehicles') {
        req.flush(null, { status: 404, statusText: 'Not Found' });
      } else {
        req.flush({
          id: `id-${cat}`,
          tenantId: 't-1',
          subjectCategory: cat,
          photoRequired: false,
          createdAtUtc: new Date().toISOString(),
        });
      }
    }
  });

  it('update PUTs /api/v1/consent-policy', () => {
    const request: UpdateConsentPolicyRequest = {
      subjectCategory: 'visitors',
      photoRequired: true,
    };
    service.update(request).subscribe();
    const req = httpMock.expectOne('/api/v1/consent-policy');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({
      id: 'p-1',
      tenantId: 't-1',
      subjectCategory: 'visitors',
      photoRequired: true,
      createdAtUtc: new Date().toISOString(),
    });
  });

  it('updateAll fires parallel PUTs and returns the array', (done) => {
    const updates: UpdateConsentPolicyRequest[] = [
      { subjectCategory: 'dwellers', photoRequired: true },
      { subjectCategory: 'visitors', photoRequired: false },
    ];
    service.updateAll(updates).subscribe((results) => {
      expect(results.length).toBe(2);
      done();
    });
    const reqs = httpMock.match((r) => r.url === '/api/v1/consent-policy');
    expect(reqs.length).toBe(2);
    for (const r of reqs) {
      r.flush({
        id: 'x',
        tenantId: 't-1',
        subjectCategory: 'x',
        photoRequired: false,
        createdAtUtc: new Date().toISOString(),
      });
    }
  });

  it('updateAll with empty array resolves to []', (done) => {
    service.updateAll([]).subscribe((results) => {
      expect(results).toEqual([]);
      done();
    });
  });
});
