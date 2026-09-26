import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { CeInputComponent } from './input.component';

describe('CeInputComponent', () => {
  let fixture: ComponentFixture<CeInputComponent>;
  let component: CeInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeInputComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(CeInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render label', () => {
    fixture.componentRef.setInput('label', 'Email');
    fixture.detectChanges();
    const label: HTMLElement = fixture.nativeElement.querySelector('.ce-input-label');
    expect(label.textContent).toContain('Email');
  });

  it('should set htmlFor on label', () => {
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('inputId', 'email-field');
    fixture.detectChanges();
    const label: HTMLElement = fixture.nativeElement.querySelector('.ce-input-label');
    expect(label.getAttribute('for')).toBe('email-field');
  });

  it('should render helper text when no error', () => {
    fixture.componentRef.setInput('helper', 'Enter your email');
    fixture.detectChanges();
    const helper: HTMLElement = fixture.nativeElement.querySelector('.ce-input-helper');
    expect(helper).toBeTruthy();
    expect(helper.textContent).toContain('Enter your email');
  });

  it('should render error instead of helper', () => {
    fixture.componentRef.setInput('helper', 'Helper text');
    fixture.componentRef.setInput('error', 'This field is required');
    fixture.detectChanges();
    const helper = fixture.nativeElement.querySelector('.ce-input-helper');
    const error: HTMLElement = fixture.nativeElement.querySelector('.ce-input-error');
    expect(helper).toBeFalsy();
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('This field is required');
  });

  it('should set aria-invalid when error exists', () => {
    fixture.componentRef.setInput('error', 'Error');
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('should not set aria-invalid when no error', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBeFalsy();
  });

  it('should set aria-describedby when helper or error exists', () => {
    fixture.componentRef.setInput('helper', 'Help');
    fixture.componentRef.setInput('inputId', 'my-input');
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-describedby')).toBe('my-input-helper');
  });

  it('should render placeholder', () => {
    fixture.componentRef.setInput('placeholder', 'you@example.com');
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.placeholder).toBe('you@example.com');
  });

  it('should set input type', () => {
    fixture.componentRef.setInput('type', 'password');
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('password');
  });

  it('should implement ControlValueAccessor writeValue', () => {
    component.writeValue('test value');
    expect(component.internalValue()).toBe('test value');
  });

  it('should implement ControlValueAccessor onChange', fakeAsync(() => {
    let capturedValue = '';
    component.registerOnChange((v: string) => (capturedValue = v));
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'typed text';
    input.dispatchEvent(new Event('input'));
    tick();
    expect(capturedValue).toBe('typed text');
  }));

  it('should implement ControlValueAccessor onTouched', fakeAsync(() => {
    let touched = false;
    component.registerOnTouched(() => (touched = true));
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.dispatchEvent(new Event('blur'));
    tick();
    expect(touched).toBe(true);
  }));

  it('should have has-error class on group when error exists', () => {
    fixture.componentRef.setInput('error', 'Error');
    fixture.detectChanges();
    const group: HTMLElement = fixture.nativeElement.querySelector('.ce-input-group');
    expect(group.classList.contains('has-error')).toBe(true);
  });

  it('should have has-error class on wrapper when error exists', () => {
    fixture.componentRef.setInput('error', 'Error');
    fixture.detectChanges();
    const wrapper: HTMLElement = fixture.nativeElement.querySelector('.ce-input-wrapper');
    expect(wrapper.classList.contains('has-error')).toBe(true);
  });

  it('should render error with role=alert', () => {
    fixture.componentRef.setInput('error', 'Error');
    fixture.detectChanges();
    const error: HTMLElement = fixture.nativeElement.querySelector('.ce-input-error');
    expect(error.getAttribute('role')).toBe('alert');
  });
});
