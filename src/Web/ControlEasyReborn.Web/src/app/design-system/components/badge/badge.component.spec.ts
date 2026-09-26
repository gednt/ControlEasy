import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeBadgeComponent } from './badge.component';

describe('CeBadgeComponent', () => {
  let fixture: ComponentFixture<CeBadgeComponent>;
  let component: CeBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default tone=neutral', () => {
    expect(component.tone()).toBe('neutral');
  });

  it('should have default size=md', () => {
    expect(component.size()).toBe('md');
  });

  ['primary', 'success', 'warning', 'danger', 'info', 'neutral'].forEach((tone) => {
    it(`should render tone-${tone} class`, () => {
      fixture.componentRef.setInput('tone', tone as any);
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.ce-badge');
      expect(badge.classList.contains(`tone-${tone}`)).toBe(true);
    });
  });

  ['sm', 'md'].forEach((size) => {
    it(`should render size-${size} class`, () => {
      fixture.componentRef.setInput('size', size as any);
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.ce-badge');
      expect(badge.classList.contains(`size-${size}`)).toBe(true);
    });
  });

  it('should set aria-label to content', () => {
    fixture.componentRef.setInput('content', 'Active');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ce-badge');
    expect(badge.getAttribute('aria-label')).toBe('Active');
  });

  it('should render content text', () => {
    fixture.componentRef.setInput('content', 'In Progress');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ce-badge');
    expect(badge.textContent).toContain('In Progress');
  });
});
