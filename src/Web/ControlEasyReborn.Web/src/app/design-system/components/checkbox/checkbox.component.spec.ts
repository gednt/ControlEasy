import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeCheckboxComponent } from './checkbox.component';

describe('CeCheckboxComponent', () => {
  let fixture: ComponentFixture<CeCheckboxComponent>;
  let component: CeCheckboxComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeCheckboxComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeCheckboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default checked=false', () => {
    expect(component.checked()).toBe(false);
  });

  it('should have default disabled=false', () => {
    expect(component.disabled()).toBe(false);
  });

  it('should have default indeterminate=false', () => {
    expect(component.indeterminate()).toBe(false);
  });

  it('should render label text', () => {
    fixture.componentRef.setInput('label', 'Remember my email');
    fixture.detectChanges();
    const label: HTMLElement = fixture.nativeElement.querySelector('.ce-checkbox-label');
    expect(label.textContent).toContain('Remember my email');
  });

  it('should render unchecked box by default', () => {
    const box: HTMLElement = fixture.nativeElement.querySelector('.ce-checkbox-box');
    expect(box.classList.contains('checked')).toBe(false);
  });

  it('should render checked box when checked=true', () => {
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    const box: HTMLElement = fixture.nativeElement.querySelector('.ce-checkbox-box');
    expect(box.classList.contains('checked')).toBe(true);
  });

  it('should render check SVG when checked', () => {
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    const svg: HTMLElement = fixture.nativeElement.querySelector('.ce-checkbox-check');
    expect(svg).toBeTruthy();
  });

  it('should render indeterminate class when indeterminate=true', () => {
    fixture.componentRef.setInput('indeterminate', true);
    fixture.detectChanges();
    const box: HTMLElement = fixture.nativeElement.querySelector('.ce-checkbox-box');
    expect(box.classList.contains('indeterminate')).toBe(true);
  });

  it('should render indeterminate SVG when indeterminate', () => {
    fixture.componentRef.setInput('indeterminate', true);
    fixture.detectChanges();
    const svgs: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.ce-checkbox-check');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('should have disabled class when disabled=true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const label: HTMLElement = fixture.nativeElement.querySelector('.ce-checkbox');
    expect(label.classList.contains('disabled')).toBe(true);
  });

  it('should set disabled attribute on input when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(input.disabled).toBe(true);
  });

  it('should set aria-checked=true when checked', () => {
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(input.getAttribute('aria-checked')).toBe('true');
  });

  it('should set aria-checked=false when unchecked', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(input.getAttribute('aria-checked')).toBe('false');
  });

  it('should set aria-checked=mixed when indeterminate', () => {
    fixture.componentRef.setInput('indeterminate', true);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(input.getAttribute('aria-checked')).toBe('mixed');
  });

  it('should emit checkedChange on change', () => {
    let emitted = false;
    component.checkedChange.subscribe((val: boolean) => (emitted = val));
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    expect(emitted).toBe(true);
  });

  it('should set name attribute on input', () => {
    fixture.componentRef.setInput('name', 'remember-email');
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(input.name).toBe('remember-email');
  });
});
