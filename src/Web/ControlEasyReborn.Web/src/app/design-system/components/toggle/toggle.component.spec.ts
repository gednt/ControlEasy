import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeToggleComponent } from './toggle.component';

describe('CeToggleComponent', () => {
  let fixture: ComponentFixture<CeToggleComponent>;
  let component: CeToggleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeToggleComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('checked', false);
    fixture.detectChanges();
  });

  it('renders role="switch" with aria-checked="false" when unchecked', () => {
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.getAttribute('role')).toBe('switch');
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('aria-checked="true" when checked', () => {
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('emits !checked on click', () => {
    const checkedChange = jasmine.createSpy('checkedChange');
    component.checkedChange.subscribe(checkedChange);

    fixture.componentRef.setInput('checked', false);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(checkedChange).toHaveBeenCalledWith(true);
  });

  it('does NOT emit when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const checkedChange = jasmine.createSpy('checkedChange');
    component.checkedChange.subscribe(checkedChange);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(checkedChange).not.toHaveBeenCalled();
  });

  it('label updates between "On" and "Off"', () => {
    expect(fixture.nativeElement.textContent).toContain('Off');
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('On');
  });
});
