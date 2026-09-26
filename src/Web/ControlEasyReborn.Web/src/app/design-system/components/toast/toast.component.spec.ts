import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CeToastHostComponent, ToastService } from './toast.component';

describe('CeToastHostComponent', () => {
  let fixture: ComponentFixture<CeToastHostComponent>;
  let component: CeToastHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeToastHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeToastHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render aria-live=polite region', () => {
    const host: HTMLElement = fixture.nativeElement.querySelector('.ce-toast-host');
    expect(host).toBeTruthy();
    expect(host.getAttribute('aria-live')).toBe('polite');
    expect(host.getAttribute('aria-label')).toBe('Notifications');
  });

  it('should add a toast and render it', () => {
    component.add({ message: 'Test toast', tone: 'success', duration: 0 });
    fixture.detectChanges();
    const toasts: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.ce-toast');
    expect(toasts.length).toBe(1);
    expect(toasts[0]!.textContent).toContain('Test toast');
  });

  it('should render correct tone class', () => {
    component.add({ message: 'Error!', tone: 'error', duration: 0 });
    fixture.detectChanges();
    const toast: HTMLElement = fixture.nativeElement.querySelector('.ce-toast');
    expect(toast.classList.contains('tone-error')).toBe(true);
  });

  it('should dismiss a toast by id', () => {
    const id = component.add({ message: 'Dismiss me', tone: 'info', duration: 0 });
    fixture.detectChanges();
    component.dismiss(id);
    fixture.detectChanges();
    const toasts = fixture.nativeElement.querySelectorAll('.ce-toast');
    expect(toasts.length).toBe(0);
  });

  it('should auto-dismiss after duration', fakeAsync(() => {
    component.add({ message: 'Auto dismiss', tone: 'success', duration: 1000 });
    fixture.detectChanges();
    expect(component.toasts().length).toBe(1);
    tick(1100);
    expect(component.toasts().length).toBe(0);
  }));

  it('should not auto-dismiss when duration=0', fakeAsync(() => {
    component.add({ message: 'Sticky', tone: 'info', duration: 0 });
    fixture.detectChanges();
    tick(10000);
    expect(component.toasts().length).toBe(1);
  }));

  it('should stack multiple toasts', () => {
    component.add({ message: 'First', tone: 'success', duration: 0 });
    component.add({ message: 'Second', tone: 'error', duration: 0 });
    fixture.detectChanges();
    const toasts = fixture.nativeElement.querySelectorAll('.ce-toast');
    expect(toasts.length).toBe(2);
  });

  it('should render dismiss button with aria-label=Dismiss', () => {
    component.add({ message: 'Test', tone: 'success', duration: 0 });
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.ce-toast-close');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Dismiss');
  });

  it('should return icon for each tone', () => {
    expect(component.iconForTone('success')).toBeTruthy();
    expect(component.iconForTone('error')).toBeTruthy();
    expect(component.iconForTone('warning')).toBeTruthy();
    expect(component.iconForTone('info')).toBeTruthy();
  });
});

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = new ToastService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return 0 when no host registered', () => {
    expect(service.success('test')).toBe(0);
    expect(service.error('test')).toBe(0);
    expect(service.info('test')).toBe(0);
    expect(service.warning('test')).toBe(0);
  });

  it('should delegate to host when registered', () => {
    const host = { add: jasmine.createSpy('add').and.returnValue(1), dismiss: jasmine.createSpy('dismiss') } as any;
    service.registerHost(host);
    service.success('Hello');
    expect(host.add).toHaveBeenCalled();
  });
});
