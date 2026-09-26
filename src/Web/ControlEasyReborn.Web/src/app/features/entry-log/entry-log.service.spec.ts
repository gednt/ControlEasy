import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EntryLogService } from './entry-log.service';
import type { AuditFilters } from './entry-log.service';

describe('EntryLogService', () => {
  let service: EntryLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EntryLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list GETs with skip/take and optional filters as query params', () => {
    const filters: AuditFilters = {
      skip: 10,
      take: 25,
      entryState: 'entered_override',
      subjectType: 'visitor',
      fromUtc: '2026-02-01T00:00:00.000Z',
      toUtc: '2026-02-15T00:00:00.000Z',
    };
    service.list(filters).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/v1/entry-log');
    expect(req.request.method).toBe('GET');
    const p = req.request.params;
    expect(p.get('skip')).toBe('10');
    expect(p.get('take')).toBe('25');
    expect(p.get('entryState')).toBe('entered_override');
    expect(p.get('subjectType')).toBe('visitor');
    expect(p.get('fromUtc')).toBe('2026-02-01T00:00:00.000Z');
    expect(p.get('toUtc')).toBe('2026-02-15T00:00:00.000Z');
    req.flush([]);
  });

  it('list omits undefined filters from query params', () => {
    service.list({ skip: 0, take: 50 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/v1/entry-log');
    const p = req.request.params;
    expect(p.has('entryState')).toBe(false);
    expect(p.has('subjectType')).toBe(false);
    expect(p.has('fromUtc')).toBe(false);
    expect(p.has('toUtc')).toBe(false);
    req.flush([]);
  });

  it('export GETs /api/v1/entry-log/export with responseType blob', () => {
    const filters: AuditFilters = {
      skip: 0,
      take: 50,
      entryState: 'entered_without_consent',
    };
    service.export(filters).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/v1/entry-log/export');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('entryState')).toBe('entered_without_consent');
    req.flush(new Blob(['id,recorded_at\n']));
  });
});
