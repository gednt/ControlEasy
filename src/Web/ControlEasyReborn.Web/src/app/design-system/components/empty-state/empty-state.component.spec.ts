import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeEmptyStateComponent } from './empty-state.component';

describe('CeEmptyStateComponent', () => {
  let fixture: ComponentFixture<CeEmptyStateComponent>;
  let component: CeEmptyStateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeEmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeEmptyStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render icon when provided', () => {
    fixture.componentRef.setInput('icon', '\u2709');
    fixture.detectChanges();
    const icon: HTMLElement = fixture.nativeElement.querySelector('.ce-empty-state-icon');
    expect(icon).toBeTruthy();
  });

  it('should not render icon when empty', () => {
    const icon = fixture.nativeElement.querySelector('.ce-empty-state-icon');
    expect(icon).toBeFalsy();
  });

  it('should render title', () => {
    fixture.componentRef.setInput('title', 'No messages');
    fixture.detectChanges();
    const title: HTMLElement = fixture.nativeElement.querySelector('.ce-empty-state-title');
    expect(title.textContent).toContain('No messages');
  });

  it('should render description when provided', () => {
    fixture.componentRef.setInput('description', 'Start a conversation!');
    fixture.detectChanges();
    const desc: HTMLElement = fixture.nativeElement.querySelector('.ce-empty-state-desc');
    expect(desc).toBeTruthy();
    expect(desc.textContent).toContain('Start a conversation!');
  });

  it('should not render description when empty', () => {
    const desc = fixture.nativeElement.querySelector('.ce-empty-state-desc');
    expect(desc).toBeFalsy();
  });

  it('should render action button when actionLabel provided', () => {
    fixture.componentRef.setInput('actionLabel', 'New Message');
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.ce-empty-state-action');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('New Message');
  });

  it('should not render action button when actionLabel is empty', () => {
    const btn = fixture.nativeElement.querySelector('.ce-empty-state-action');
    expect(btn).toBeFalsy();
  });

  it('should emit action when action button clicked', () => {
    fixture.componentRef.setInput('actionLabel', 'Create');
    fixture.detectChanges();
    let emitted = false;
    component.action.subscribe(() => (emitted = true));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.ce-empty-state-action');
    btn.click();
    expect(emitted).toBe(true);
  });
});
