import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ReportsPage, formatTimestampWithMs, escapeCsvField } from './reports.page';
import { ReportsService } from '../../api/services/reports.service';
import { ApartmentsApiService } from '../apartments/apartments-api.service';
import { CE_LUCIDE_ICONS } from '../../design-system/components/icon/icon.registry';

describe('ReportsPage', () => {
  let fixture: ComponentFixture<ReportsPage>;
  let component: ReportsPage;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        importProvidersFrom(CE_LUCIDE_ICONS),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ReportsService,
        ApartmentsApiService,
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushInitialRequests(rowsCount = 1): void {
    const aptsReq = httpMock.expectOne('/api/v1/apartments?skip=0&take=300');
    aptsReq.flush([]);

    const countsReq = httpMock.expectOne((req) => req.url === '/api/v1/reports/visit-counts-by-day');
    countsReq.flush([
      { date: '2026-09-19', count: 12 },
      { date: '2026-09-18', count: 8 },
    ]);

    const resAptReq = httpMock.expectOne('/api/v1/reports/residents-per-apartment');
    resAptReq.flush([{ apartmentId: '00000000-0000-0000-0000-000000000001', count: 3 }]);

    const historyReq = httpMock.expectOne((req) => req.url === '/api/v1/reports/history');
    historyReq.flush(
      rowsCount > 0
        ? [
            {
              id: '00000000-0000-0000-0000-000000000010',
              occurredAt: '2026-09-19T14:30:15.123Z',
              kind: 'visit',
              source: 'visit-workflow',
              nativeState: 'CheckedIn',
              subjectType: 'visitor',
              subjectName: 'Carlos Silva',
              subjectDocument: '111.222.333-44',
              destinationLabel: 'Apt 101 Block A',
              purpose: 'Delivery',
              packageDescription: '2 boxes',
              packageCarrierCode: 'SEDEX',
            },
          ]
        : [],
      { headers: { 'X-Total-Count': rowsCount.toString() } },
    );
  }

  it('renders reports page with header and initial data', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();
    fixture.detectChanges();

    expect(component.datePreset()).toBe('today');
    expect(component.totalPeriodVisits()).toBe(20);
    expect(component.historyRows().length).toBe(1);

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Reports &amp; shift history');
    expect(html).toContain('Carlos Silva');
    expect(html).toContain('SEDEX');
    expect(html).toContain('2 boxes');
  }));

  it('switches date range preset to 7d and updates queries', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    component.setPreset('7d');
    fixture.detectChanges();

    const countsReq = httpMock.expectOne((req) => req.url === '/api/v1/reports/visit-counts-by-day');
    expect(countsReq.request.params.has('from')).toBeTrue();
    countsReq.flush([]);

    const resAptReq = httpMock.expectOne('/api/v1/reports/residents-per-apartment');
    resAptReq.flush([]);

    const historyReq = httpMock.expectOne((req) => req.url === '/api/v1/reports/history');
    historyReq.flush([], { headers: { 'X-Total-Count': '0' } });

    expect(component.datePreset()).toBe('7d');
  }));

  it('filters history by search query and status', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    component.onSearchChange('Carlos');

    const historyReq1 = httpMock.expectOne((req) => req.url === '/api/v1/reports/history');
    expect(historyReq1.request.params.get('q')).toBe('Carlos');
    historyReq1.flush([], { headers: { 'X-Total-Count': '0' } });

    component.onStatusChange('CheckedIn');
    const historyReq2 = httpMock.expectOne((req) => req.url === '/api/v1/reports/history');
    expect(historyReq2.request.params.get('status')).toBe('CheckedIn');
    historyReq2.flush([], { headers: { 'X-Total-Count': '0' } });
  }));

  it('paginates when total count exceeds page size', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests(50);
    tick();

    expect(component.totalPages()).toBe(2);

    component.changePage(2);
    const pageReq = httpMock.expectOne((req) => req.url === '/api/v1/reports/history');
    expect(pageReq.request.params.get('page')).toBe('2');
    pageReq.flush([], { headers: { 'X-Total-Count': '50' } });

    expect(component.page()).toBe(2);
  }));

  it('formats timestamp with millisecond precision', () => {
    const formatted = formatTimestampWithMs('2026-09-19T14:30:15.123Z');
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
    expect(formatted).toContain('.123');
  });

  it('escapes CSV fields properly', () => {
    expect(escapeCsvField('normal text')).toBe('"normal text"');
    expect(escapeCsvField('text "with quotes" and , comma')).toBe('"text ""with quotes"" and , comma"');
    expect(escapeCsvField(null)).toBe('""');
  });

  it('only offers status options that map to backend NativeState values', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '[data-testid="status-filter-select"]',
    );
    expect(select).withContext('status filter select').not.toBeNull();

    const optionValues = Array.from(select!.options).map((opt) => opt.value);
    expect(optionValues).toEqual(['', 'CheckedIn', 'Pending', 'CheckedOut', 'Cancelled']);
    expect(optionValues).not.toContain('Recorded');
    expect(optionValues).not.toContain('Refused');
  }));

  it('search placeholder aligns to the backend q scope (subject / package description / purpose)', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();
    fixture.detectChanges();

    const searchInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-testid="ledger-search-input"]',
    );
    expect(searchInput).withContext('search input').not.toBeNull();
    const placeholder = searchInput!.placeholder;

    expect(placeholder).toContain('package description');
    expect(placeholder).not.toContain('document');
    expect(placeholder).not.toContain('destination');
  }));
});
