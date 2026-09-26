import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CePaginationComponent } from './pagination.component';

describe('CePaginationComponent', () => {
  let fixture: ComponentFixture<CePaginationComponent>;
  let component: CePaginationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CePaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CePaginationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default page=1', () => {
    expect(component.page()).toBe(1);
  });

  it('should have default pageSize=10', () => {
    expect(component.pageSize()).toBe(10);
  });

  it('should have default total=0', () => {
    expect(component.total()).toBe(0);
  });

  it('should render nav with aria-label=Pagination', () => {
    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('aria-label')).toBe('Pagination');
  });

  it('should compute totalPages=1 when total=0', () => {
    expect(component.totalPages()).toBe(1);
  });

  it('should compute totalPages correctly', () => {
    fixture.componentRef.setInput('total', 95);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();
    expect(component.totalPages()).toBe(10);
  });

  it('should disable first/prev buttons on page 1', () => {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.ce-page-btn'));
    const firstBtn = buttons[0]!;
    const prevBtn = buttons[1]!;
    expect(firstBtn.disabled).toBe(true);
    expect(prevBtn.disabled).toBe(true);
  });

  it('should enable first/prev buttons on page > 1', () => {
    fixture.componentRef.setInput('total', 50);
    fixture.componentRef.setInput('page', 3);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.ce-page-btn'));
    expect(buttons[0]!.disabled).toBe(false);
    expect(buttons[1]!.disabled).toBe(false);
  });

  it('should emit pageChange on goToPage', () => {
    fixture.componentRef.setInput('total', 100);
    fixture.detectChanges();
    let emitted = 0;
    component.pageChange.subscribe((p: number) => (emitted = p));
    component.goToPage(3);
    expect(emitted).toBe(3);
  });

  it('should not emit pageChange for invalid page', () => {
    let emitted = false;
    component.pageChange.subscribe(() => (emitted = true));
    component.goToPage(0);
    expect(emitted).toBe(false);
  });

  it('should emit pageSizeChange', () => {
    let emitted = 0;
    component.pageSizeChange.subscribe((s: number) => (emitted = s));
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.ce-page-size');
    if (select) {
      select.value = '25';
      select.dispatchEvent(new Event('change'));
      expect(emitted).toBe(25);
    }
  });

  it('should show ellipsis for large totals', () => {
    fixture.componentRef.setInput('total', 1000);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('page', 50);
    fixture.detectChanges();
    const pageList = component.pageList();
    expect(pageList).toContain(-1);
  });

  it('should render all pages for small totals', () => {
    fixture.componentRef.setInput('total', 50);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();
    const pageList = component.pageList();
    expect(pageList).toEqual([1, 2, 3, 4, 5]);
    expect(pageList).not.toContain(-1);
  });

  it('should mark active page with aria-current', () => {
    fixture.componentRef.setInput('total', 50);
    fixture.componentRef.setInput('page', 2);
    fixture.detectChanges();
    const activeBtn: HTMLElement = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(activeBtn).toBeTruthy();
  });
});
