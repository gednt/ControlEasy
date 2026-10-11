import { ComponentFixture, TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { CeIconComponent } from './icon.component';
import { CE_LUCIDE_ICONS } from './icon.registry';

describe('CeIconComponent', () => {
  let fixture: ComponentFixture<CeIconComponent>;
  let component: CeIconComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeIconComponent],
      providers: [importProvidersFrom(CE_LUCIDE_ICONS)],
    }).compileComponents();

    fixture = TestBed.createComponent(CeIconComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'search');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should map app icon names to lucide names', () => {
    fixture.componentRef.setInput('name', 'dashboard');
    fixture.detectChanges();
    expect(component.lucideName()).toBe('layout-dashboard');
  });

  it('should pass size to lucide-icon', () => {
    fixture.componentRef.setInput('size', 24);
    fixture.detectChanges();
    const svg: SVGElement | null = fixture.nativeElement.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('should set aria-hidden for decorative icons', () => {
    const host: HTMLElement = fixture.nativeElement.querySelector('lucide-icon');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('aria-label')).toBeNull();
  });

  it('should expose aria-label when label is provided', () => {
    fixture.componentRef.setInput('label', 'Search');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement.querySelector('lucide-icon');
    expect(host.getAttribute('aria-hidden')).toBeNull();
    expect(host.getAttribute('aria-label')).toBe('Search');
    expect(host.getAttribute('role')).toBe('img');
  });

  it('should render a lucide svg for the resolved icon name', () => {
    const svg: SVGElement | null = fixture.nativeElement.querySelector('svg.lucide-search');
    expect(svg).toBeTruthy();
  });

  it('renders the activity icon used by device health navigation', () => {
    fixture.componentRef.setInput('name', 'activity');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('svg.lucide-activity')).toBeTruthy();
  });
});
