import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrPassModalComponent } from './qr-pass-modal.component';

describe('QrPassModalComponent', () => {
  let fixture: ComponentFixture<QrPassModalComponent>;
  let component: QrPassModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrPassModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QrPassModalComponent);
    component = fixture.componentInstance;
  });

  it('renders modal when open is true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('subjectName', 'Carlos Silva');
    fixture.componentRef.setInput('subjectType', 'Visitor');
    fixture.componentRef.setInput('destination', 'Tower A - 104');
    fixture.componentRef.setInput('qrPayload', 'test-token-12345678901234567890');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Access QR Pass');
    expect(compiled.textContent).toContain('Carlos Silva');
    expect(compiled.textContent).toContain('Visitor Pass');
    expect(compiled.textContent).toContain('Tower A - 104');
  });

  it('masks long tokens properly', () => {
    fixture.componentRef.setInput('qrPayload', '12345678abcdefgh12345678');
    expect(component.maskedToken()).toBe('12345678...12345678');
  });

  it('emits closed event when close is called', () => {
    let closedEmitted = false;
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    component.close();
    expect(closedEmitted).toBeTrue();
  });
});
