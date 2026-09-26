import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CeBreadcrumbsComponent } from './breadcrumbs.component';

describe('CeBreadcrumbsComponent', () => {
  let fixture: ComponentFixture<CeBreadcrumbsComponent>;
  let component: CeBreadcrumbsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeBreadcrumbsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CeBreadcrumbsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render nav with aria-label=Breadcrumb', () => {
    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
  });

  it('should render ordered list', () => {
    const ol: HTMLElement = fixture.nativeElement.querySelector('ol');
    expect(ol).toBeTruthy();
  });

  it('should render crumbs', () => {
    fixture.componentRef.setInput('crumbs', [
      { label: 'Home', route: '/' },
      { label: 'Residents', route: '/residents' },
      { label: 'Joao Silva' },
    ]);
    fixture.detectChanges();
    const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(3);
  });

  it('should render links for non-last items', () => {
    fixture.componentRef.setInput('crumbs', [
      { label: 'Home', route: '/' },
      { label: 'Residents', route: '/residents' },
      { label: 'Joao Silva' },
    ]);
    fixture.detectChanges();
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(links.length).toBe(2);
  });

  it('should set aria-current=page on last item', () => {
    fixture.componentRef.setInput('crumbs', [{ label: 'Home', route: '/' }, { label: 'Joao Silva' }]);
    fixture.detectChanges();
    const last: HTMLElement = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(last).toBeTruthy();
    expect(last.textContent).toContain('Joao Silva');
  });

  it('should render separators between items', () => {
    fixture.componentRef.setInput('crumbs', [
      { label: 'Home', route: '/' },
      { label: 'Residents', route: '/residents' },
      { label: 'Joao Silva' },
    ]);
    fixture.detectChanges();
    const seps: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.ce-breadcrumb-sep');
    expect(seps.length).toBe(2);
  });

  it('should render empty list for empty crumbs', () => {
    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(0);
  });
});
