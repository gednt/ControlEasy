import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeSpinnerComponent } from './spinner.component';

describe('CeSpinnerComponent', () => {
  let fixture: ComponentFixture<CeSpinnerComponent>;
  let component: CeSpinnerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeSpinnerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeSpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default size=md', () => {
    expect(component.size()).toBe('md');
  });

  it('should have default tone=current', () => {
    expect(component.tone()).toBe('current');
  });

  ['sm', 'md', 'lg'].forEach((size) => {
    it(`should render size-${size} class`, () => {
      fixture.componentRef.setInput('size', size as any);
      fixture.detectChanges();
      const spinner: HTMLElement = fixture.nativeElement.querySelector('.ce-spinner');
      expect(spinner.classList.contains(`size-${size}`)).toBe(true);
    });
  });

  ['primary', 'current'].forEach((tone) => {
    it(`should render tone-${tone} class`, () => {
      fixture.componentRef.setInput('tone', tone as any);
      fixture.detectChanges();
      const spinner: HTMLElement = fixture.nativeElement.querySelector('.ce-spinner');
      expect(spinner.classList.contains(`tone-${tone}`)).toBe(true);
    });
  });

  it('should have role=status', () => {
    const spinner: HTMLElement = fixture.nativeElement.querySelector('.ce-spinner');
    expect(spinner.getAttribute('role')).toBe('status');
  });

  it('should have aria-label=Loading', () => {
    const spinner: HTMLElement = fixture.nativeElement.querySelector('.ce-spinner');
    expect(spinner.getAttribute('aria-label')).toBe('Loading');
  });
});
