import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeDropdownComponent } from './dropdown.component';

describe('CeDropdownComponent', () => {
  let fixture: ComponentFixture<CeDropdownComponent>;
  let component: CeDropdownComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeDropdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default isOpen=false', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should toggle isOpen on toggle()', () => {
    component.toggle();
    expect(component.isOpen()).toBe(true);
    component.toggle();
    expect(component.isOpen()).toBe(false);
  });

  it('should close on close()', () => {
    component.toggle();
    expect(component.isOpen()).toBe(true);
    component.close();
    expect(component.isOpen()).toBe(false);
  });

  it('should emit openChange on toggle', () => {
    let emitted: boolean | null = null;
    component.openChange.subscribe((val: boolean) => (emitted = val));
    component.toggle();
    expect(emitted!).toBeTrue();
  });

  it('should close on outside click', () => {
    component.toggle();
    expect(component.isOpen()).toBe(true);
    const event = new MouseEvent('click', { bubbles: true });
    spyOnProperty(event, 'target').and.returnValue(document.body);
    component.onDocumentClick(event);
    expect(component.isOpen()).toBe(false);
  });

  it('should render dropdown panel when open', () => {
    component.toggle();
    fixture.detectChanges();
    const panel: HTMLElement = fixture.nativeElement.querySelector('.ce-dropdown-panel');
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('role')).toBe('menu');
  });

  it('should not render dropdown panel when closed', () => {
    const panel = fixture.nativeElement.querySelector('.ce-dropdown-panel');
    expect(panel).toBeFalsy();
  });

  it('should close when close() is called', () => {
    component.toggle();
    expect(component.isOpen()).toBe(true);
    component.close();
    expect(component.isOpen()).toBe(false);
  });
});
