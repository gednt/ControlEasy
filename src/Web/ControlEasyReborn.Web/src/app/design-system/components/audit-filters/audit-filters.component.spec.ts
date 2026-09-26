import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeAuditFiltersComponent, type PorteiroOption } from './audit-filters.component';
import type {
  AuditFilters,
  EntryState,
  SubjectType,
} from '../../../features/entry-log/entry-log.service';

describe('CeAuditFiltersComponent', () => {
  let fixture: ComponentFixture<CeAuditFiltersComponent>;
  let component: CeAuditFiltersComponent;

  const baseFilters: AuditFilters = { skip: 0, take: 50 };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeAuditFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeAuditFiltersComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('filters', baseFilters);
    fixture.detectChanges();
  });

  it('exposes 3 dropdowns (category, state, porteiro)', () => {
    const selects = fixture.nativeElement.querySelectorAll('select');
    expect(selects.length).toBe(3);
    expect(component.categoryOptions.length).toBeGreaterThan(1);
    expect(component.stateOptions.length).toBeGreaterThan(1);
  });

  it('emits updated filters with skip=0 when category changes', () => {
    let emitted: AuditFilters | undefined;
    component.filtersChanged.subscribe((f) => (emitted = f));

    const categorySelect =
      fixture.nativeElement.querySelectorAll('select')[0] as HTMLSelectElement;
    categorySelect.value = 'visitor';
    categorySelect.dispatchEvent(new Event('change'));

    expect(emitted).toBeDefined();
    expect(emitted!.subjectType).toBe('visitor' as SubjectType);
    expect(emitted!.skip).toBe(0);
  });

  it('emits updated filters with entryState when state changes', () => {
    let emitted: AuditFilters | undefined;
    component.filtersChanged.subscribe((f) => (emitted = f));

    const stateSelect =
      fixture.nativeElement.querySelectorAll('select')[1] as HTMLSelectElement;
    stateSelect.value = 'entered_override';
    stateSelect.dispatchEvent(new Event('change'));

    expect(emitted).toBeDefined();
    expect(emitted!.entryState).toBe('entered_override' as EntryState);
    expect(emitted!.skip).toBe(0);
  });

  it('emits porteiro (profileId) and skip=0 when porteiro dropdown changes', () => {
    const porteiros: PorteiroOption[] = [
      { profileId: 'p-1111', displayName: 'Synthetic Porteiro One' },
      { profileId: 'p-2222', displayName: 'Synthetic Porteiro Two' },
    ];
    fixture.componentRef.setInput('porteiros', porteiros);
    fixture.detectChanges();

    let emitted: AuditFilters | undefined;
    component.filtersChanged.subscribe((f) => (emitted = f));

    const selects = fixture.nativeElement.querySelectorAll('select');
    const porteiroSelect = selects[2] as HTMLSelectElement;
    expect(porteiroSelect).toBeTruthy();

    porteiroSelect.value = 'p-2222';
    porteiroSelect.dispatchEvent(new Event('change'));

    expect(emitted).toBeDefined();
    expect(emitted!.porteiro).toBe('p-2222');
    expect(emitted!.skip).toBe(0);
  });

  it('emits undefined porteiro when "All porteiros" is selected', () => {
    fixture.componentRef.setInput('porteiros', [{ profileId: 'p-1', displayName: 'Synthetic One' }]);
    fixture.componentRef.setInput('filters', { ...baseFilters, porteiro: 'p-1' });
    fixture.detectChanges();

    let emitted: AuditFilters | undefined;
    component.filtersChanged.subscribe((f) => (emitted = f));

    const selects = fixture.nativeElement.querySelectorAll('select');
    const porteiroSelect = selects[2] as HTMLSelectElement;
    porteiroSelect.value = '';
    porteiroSelect.dispatchEvent(new Event('change'));

    expect(emitted).toBeDefined();
    expect(emitted!.porteiro).toBeUndefined();
  });

  it('emits fromUtc as ISO when From date changes', () => {
    let emitted: AuditFilters | undefined;
    component.filtersChanged.subscribe((f) => (emitted = f));

    const dateInputs =
      fixture.nativeElement.querySelectorAll('input[type=date]');
    const fromInput = dateInputs[0] as HTMLInputElement;
    fromInput.value = '2026-01-15';
    fromInput.dispatchEvent(new Event('change'));

    expect(emitted).toBeDefined();
    expect(emitted!.fromUtc).toBeTruthy();
    expect(new Date(emitted!.fromUtc!).toISOString()).toContain('2026-01-15');
  });

  it('reset emits fresh filter with skip=0 and original take', () => {
    let emitted: AuditFilters | undefined;
    component.filtersChanged.subscribe((f) => (emitted = f));

    const resetBtn = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    resetBtn.click();

    expect(emitted).toBeDefined();
    expect(emitted!.skip).toBe(0);
    expect(emitted!.take).toBe(50);
  });

  it('exposes computed fromDate and toDate as YYYY-MM-DD slices', () => {
    fixture.componentRef.setInput('filters', {
      ...baseFilters,
      fromUtc: '2026-02-01T00:00:00.000Z',
      toUtc: '2026-02-15T23:59:59.000Z',
    });
    fixture.detectChanges();
    expect(component.fromDate()).toBe('2026-02-01');
    expect(component.toDate()).toBe('2026-02-15');
  });
});