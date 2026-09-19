import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ManualLookupPage } from './manual-lookup.page';
import { GatewayControlService } from './gateway-control.service';

describe('ManualLookupPage', () => {
  let fixture: ComponentFixture<ManualLookupPage>;
  let component: ManualLookupPage;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualLookupPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), GatewayControlService],
    }).compileComponents();

    fixture = TestBed.createComponent(ManualLookupPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the manual lookup heading', () => {
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Manual lookup');
    expect(html).toContain('Search');
  });

  it('blocks search until the criterion is specific enough (CPF must be 11 digits)', () => {
    fixture.detectChanges();
    component.state.update((s) => ({ ...s, activeCriterion: 'cpf', cpf: '12345' }));
    fixture.detectChanges();
    expect(component.canSearch()).toBeFalse();

    component.state.update((s) => ({ ...s, cpf: '12345678901' }));
    fixture.detectChanges();
    expect(component.canSearch()).toBeTrue();
  });

  it('runs a search and renders masked results', () => {
    fixture.detectChanges();

    component.state.update((s) => ({ ...s, activeCriterion: 'cpf', cpf: '12345678901' }));
    fixture.detectChanges();

    component.search();

    const req = httpMock.expectOne('/api/v1/access-subjects/search');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      criterion: 'cpf',
      value: '12345678901',
      unit: null,
    });
    req.flush({
      lookupAuditId: '00000000-0000-0000-0000-0000000000aa',
      criterion: 'cpf',
      resultCountBand: '1',
      items: [
        {
          subjectType: 'resident',
          subjectId: '00000000-0000-0000-0000-0000000000bb',
          displayName: 'Jane Doe',
          documentMasked: '***.***789-01',
          apartmentBlock: 'A',
          apartmentUnit: '101',
        },
      ],
    });

    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Jane Doe');
    expect(html).toContain('A/101');
    expect(component.state().lookupAuditId).toBe('00000000-0000-0000-0000-0000000000aa');
  });

  it('selects a result and confirms the manual event', () => {
    fixture.detectChanges();

    component.state.update((s) => ({
      ...s,
      activeCriterion: 'cpf',
      cpf: '12345678901',
      lookupAuditId: '00000000-0000-0000-0000-0000000000aa',
      results: [
        {
          subjectType: 'resident',
          subjectId: '00000000-0000-0000-0000-0000000000bb',
          displayName: 'Jane Doe',
          documentMasked: '***.***789-01',
          apartmentBlock: 'A',
          apartmentUnit: '101',
        },
      ],
    }));

    component.select(component.state().results[0]!);
    expect(component.state().mode).toBe('confirm');

    component.confirm();

    const req = httpMock.expectOne('/api/v1/access-events/manual');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      lookupAuditId: '00000000-0000-0000-0000-0000000000aa',
      subjectType: 'resident',
      subjectId: '00000000-0000-0000-0000-0000000000bb',
      direction: 'entrance',
      gatehouseId: null,
    });
    req.flush({
      decision: 'recorded',
      accessEventId: '00000000-0000-0000-0000-0000000000cc',
      accessMethod: 'manual_lookup',
      subjectType: 'resident',
      subjectId: '00000000-0000-0000-0000-0000000000bb',
      direction: 'entrance',
      destinationApartmentId: '00000000-0000-0000-0000-0000000000dd',
      destinationBlock: 'A',
      destinationUnit: '101',
    });

    fixture.detectChanges();
    expect(component.state().mode).toBe('recorded');
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Access recorded');
    expect(html).toContain('A/101');
  });

  it('surfaces a server-side refusal without leaving the confirm step', () => {
    fixture.detectChanges();

    component.state.update((s) => ({
      ...s,
      mode: 'confirm',
      lookupAuditId: '00000000-0000-0000-0000-0000000000aa',
      selected: {
        subjectType: 'resident',
        subjectId: '00000000-0000-0000-0000-0000000000bb',
        displayName: 'Jane Doe',
        documentMasked: '***.***789-01',
        apartmentBlock: 'A',
        apartmentUnit: '101',
      },
      direction: 'exit',
    }));

    component.confirm();

    const req = httpMock.expectOne('/api/v1/access-events/manual');
    req.flush(
      { failureCode: 'destination_inactive', detail: 'No active destination for this resident.' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    fixture.detectChanges();
    expect(component.state().mode).toBe('confirm');
    expect(component.state().error).toContain('No active destination');
  });

  it('surfaces a 403 without losing the search state', () => {
    fixture.detectChanges();

    component.state.update((s) => ({ ...s, activeCriterion: 'cpf', cpf: '12345678901' }));
    fixture.detectChanges();

    component.search();

    const req = httpMock.expectOne('/api/v1/access-subjects/search');
    req.flush({ detail: 'Caller lacks Access.Access.Operate.' }, { status: 403, statusText: 'Forbidden' });

    fixture.detectChanges();
    expect(component.state().mode).toBe('search');
    expect(component.state().busy).toBeFalse();
    expect(component.state().error).toBeTruthy();
  });

  it('handles visitor search and displays Visitor badge', () => {
    fixture.detectChanges();

    component.state.update((s) => ({ ...s, activeCriterion: 'name', name: 'John Guest' }));
    fixture.detectChanges();

    component.search();

    const req = httpMock.expectOne('/api/v1/access-subjects/search');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      criterion: 'name',
      value: 'John Guest',
      unit: null,
    });
    req.flush({
      lookupAuditId: '00000000-0000-0000-0000-0000000000aa',
      criterion: 'name',
      resultCountBand: '1',
      items: [
        {
          subjectType: 'visitor',
          subjectId: '00000000-0000-0000-0000-0000000000ee',
          displayName: 'John Guest',
          documentMasked: '***.***123-45',
          apartmentBlock: 'B',
          apartmentUnit: '202',
        },
      ],
    });

    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('John Guest');
    expect(html).toContain('Visitor');
    expect(html).toContain('B/202');
  });
});
