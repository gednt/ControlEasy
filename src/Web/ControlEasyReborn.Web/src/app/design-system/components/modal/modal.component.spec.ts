import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeModalComponent } from './modal.component';

describe('CeModalComponent', () => {
  let fixture: ComponentFixture<CeModalComponent>;
  let component: CeModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default open=false', () => {
    expect(component.open()).toBe(false);
  });

  it('should have default title=""', () => {
    expect(component.title()).toBe('');
  });

  it('should have default size=md', () => {
    expect(component.size()).toBe('md');
  });

  it('should emit openChange=false on close', () => {
    let emitted: boolean | undefined;
    component.openChange.subscribe((val: boolean) => (emitted = val));
    component.close();
    expect(emitted!).toBeFalse();
  });

  it('should emit closed on close', () => {
    let closedEmitted = false;
    component.closed.subscribe(() => (closedEmitted = true));
    component.close();
    expect(closedEmitted).toBeTrue();
  });

  it('should emit openChange=false on backdrop click', () => {
    let emitted: boolean | undefined;
    component.openChange.subscribe((val: boolean) => (emitted = val));
    component.onBackdropClick();
    expect(emitted!).toBeFalse();
  });

  it('should emit closed on backdrop click', () => {
    let closedEmitted = false;
    component.closed.subscribe(() => (closedEmitted = true));
    component.onBackdropClick();
    expect(closedEmitted).toBeTrue();
  });
});
