import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { QrScanPage } from './qr-scan.page';
import { AccessScanResultComponent } from './components/access-scan-result.component';
import { GatewayControlService } from './gateway-control.service';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Exception, Result } from '@zxing/library';

type DecodeCallback = (result: Result | undefined, error: Exception | undefined, controls: IScannerControls) => void;

import { provideRouter } from '@angular/router';

describe('QrScanPage', () => {
  let fixture: ComponentFixture<QrScanPage>;
  let component: QrScanPage;
  let httpMock: HttpTestingController;

  let decodeCallback: DecodeCallback | null = null;
  let decodePromise: { resolve: (controls: IScannerControls) => void; reject: (err: unknown) => void } | null = null;

  const makeControls = (): IScannerControls => {
    const localStop = jasmine.createSpy('stop');
    return { stop: localStop } as unknown as IScannerControls;
  };

  const fakeResult = (text: string): Result =>
    ({
      getText: () => text,
    }) as unknown as Result;

  beforeEach(async () => {
    decodeCallback = null;
    decodePromise = null;

    spyOn(BrowserMultiFormatReader.prototype, 'decodeFromVideoDevice').and.callFake(
      (_deviceId: string | undefined, _video: HTMLVideoElement | string | undefined, cb: DecodeCallback) => {
        decodeCallback = cb;
        return new Promise<IScannerControls>((resolve, reject) => {
          decodePromise = { resolve, reject };
        });
      },
    );

    await TestBed.configureTestingModule({
      imports: [QrScanPage, AccessScanResultComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), GatewayControlService],
    }).compileComponents();

    fixture = TestBed.createComponent(QrScanPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function drainPendingScanner(): void {
    for (let i = 0; i < 5 && decodePromise; i++) {
      tick(500);
      decodePromise.resolve(makeControls());
      decodePromise = null;
      tick();
    }
    tick(1000);
  }

  it('renders the QR form', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('QR Scan');
    expect(html).toContain('Submit scan');
  }));

  it('records a successful scan from a decoded QR value', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    decodePromise!.resolve(makeControls());
    tick();

    decodeCallback!(fakeResult('opaque-token'), undefined, makeControls());
    tick();

    const req = httpMock.expectOne('/api/v1/access-events/scans');
    expect(req.request.body).toEqual(jasmine.objectContaining({ qrPayload: 'opaque-token', direction: 'entrance' }));
    req.flush({
      decision: 'recorded',
      accessEventId: '00000000-0000-0000-0000-000000000001',
      subjectType: 'resident',
      subjectId: '00000000-0000-0000-0000-000000000002',
      credentialId: null,
      lookupAuditId: null,
      accessMethod: 'qr',
      direction: 'entrance',
      policyOutcome: 'permit',
      destinationApartmentId: '00000000-0000-0000-0000-000000000003',
      destinationBlock: 'A',
      destinationUnit: '101',
    });
    tick();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Access recorded');
    expect(component.state().qrPayload).toBe('');
    drainPendingScanner();
  }));

  it('surfaces refusal with the safe failure code', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    decodePromise!.resolve(makeControls());
    tick();

    decodeCallback!(fakeResult('revoked-token'), undefined, makeControls());
    tick();

    const req = httpMock.expectOne('/api/v1/access-events/scans');
    req.flush(
      { failureCode: 'credential_inactive', decision: 'refused' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    tick(500);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Access refused');
    expect(html).toContain('credential_inactive');
    drainPendingScanner();
  }));

  it('shows inline permission-denied error and keeps paste input available', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    const notAllowed = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    decodePromise!.reject(notAllowed);
    tick();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Camera permission denied');
    const input = fixture.nativeElement.querySelector('[data-testid="qr-payload-input"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.disabled).toBeFalse();
    httpMock.expectNone(() => true);
    drainPendingScanner();
  }));

  it('ignores decode events while busy', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    decodePromise!.resolve(makeControls());
    tick();

    decodeCallback!(fakeResult('opaque-token-1'), undefined, makeControls());
    tick();

    const req = httpMock.expectOne('/api/v1/access-events/scans');
    decodeCallback!(fakeResult('opaque-token-2'), undefined, makeControls());
    decodeCallback!(fakeResult('opaque-token-3'), undefined, makeControls());
    tick();

    req.flush({
      decision: 'recorded',
      accessEventId: '00000000-0000-0000-0000-000000000001',
      subjectType: 'resident',
      subjectId: '00000000-0000-0000-0000-000000000002',
      credentialId: null,
      lookupAuditId: null,
      accessMethod: 'qr',
      direction: 'entrance',
      policyOutcome: 'permit',
      destinationApartmentId: '00000000-0000-0000-0000-000000000003',
      destinationBlock: 'A',
      destinationUnit: '101',
    });
    tick(500);
    fixture.detectChanges();

    expect(component.state().qrPayload).toBe('');
    httpMock.expectNone(() => true);
    drainPendingScanner();
  }));

  it('tears down the scanner on destroy even when no scan was submitted', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const initialControls = makeControls();
    decodePromise!.resolve(initialControls);
    tick();
    decodeCallback!(undefined, undefined, initialControls);
    tick();

    fixture.destroy();
    drainPendingScanner();

    expect(initialControls.stop).toHaveBeenCalled();
  }));

  it('does not treat an intentional stop as a camera failure', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const controls = makeControls();
    decodePromise!.resolve(controls);
    tick();

    decodeCallback!(fakeResult('opaque-token'), undefined, controls);
    tick();

    const req = httpMock.expectOne('/api/v1/access-events/scans');
    req.flush({
      decision: 'recorded',
      accessEventId: '00000000-0000-0000-0000-000000000001',
      subjectType: 'resident',
      subjectId: '00000000-0000-0000-0000-000000000002',
      credentialId: null,
      lookupAuditId: null,
      accessMethod: 'qr',
      direction: 'entrance',
      policyOutcome: 'permit',
      destinationApartmentId: '00000000-0000-0000-0000-000000000003',
      destinationBlock: 'A',
      destinationUnit: '101',
    });
    tick(500);
    fixture.detectChanges();

    const videoEl = fixture.nativeElement.querySelector('video') as HTMLVideoElement | null;
    if (videoEl) {
      videoEl.dispatchEvent(new Event('ended'));
      tick();
      fixture.detectChanges();
    }

    expect(component.state().cameraStatus).not.toBe('unavailable');
    expect(component.state().error).toBeNull();
    drainPendingScanner();
  }));
});
