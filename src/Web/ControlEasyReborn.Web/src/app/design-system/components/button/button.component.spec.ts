import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeButtonComponent } from './button.component';

describe('CeButtonComponent', () => {
  let fixture: ComponentFixture<CeButtonComponent>;
  let component: CeButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default variant=primary', () => {
    expect(component.variant()).toBe('primary');
  });

  it('should have default size=md', () => {
    expect(component.size()).toBe('md');
  });

  it('should have default loading=false', () => {
    expect(component.loading()).toBe(false);
  });

  it('should have default disabled=false', () => {
    expect(component.disabled()).toBe(false);
  });

  it('should have default type=button', () => {
    expect(component.type()).toBe('button');
  });

  it('should render variant class', () => {
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.classList.contains('primary')).toBe(true);
  });

  it('should render size class', () => {
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.classList.contains('md')).toBe(true);
  });

  ['sm', 'md', 'lg'].forEach((size) => {
    it(`should render size=${size} class`, () => {
      fixture.componentRef.setInput('size', size);
      fixture.detectChanges();
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
      expect(btn.classList.contains(size)).toBe(true);
    });
  });

  ['primary', 'secondary', 'ghost', 'danger'].forEach((variant) => {
    it(`should render variant=${variant} class`, () => {
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
      expect(btn.classList.contains(variant)).toBe(true);
    });
  });

  it('should set aria-busy when loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('should disable button when loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('should set aria-disabled when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('should disable button when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('should set button type', () => {
    fixture.componentRef.setInput('type', 'submit');
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.type).toBe('submit');
  });

  it('should show spinner when loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('.ce-spinner-sm');
    expect(spinner).toBeTruthy();
  });

  it('should not show spinner when not loading', () => {
    const spinner = fixture.nativeElement.querySelector('.ce-spinner-sm');
    expect(spinner).toBeFalsy();
  });
});
