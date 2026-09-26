import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, importProvidersFrom, signal } from '@angular/core';
import { CePhotoCaptureComponent } from './photo-capture.component';
import { ToastService } from '../toast/toast.component';
import { PhotosApiService, type PhotoResponse } from '../../../features/photos/photos-api.service';
import { of, throwError } from 'rxjs';
import { CE_LUCIDE_ICONS } from '../icon/icon.registry';

class StubToastService {
  success = jasmine.createSpy('success').and.returnValue(0);
  error = jasmine.createSpy('error').and.returnValue(0);
  warning = jasmine.createSpy('warning').and.returnValue(0);
  info = jasmine.createSpy('info').and.returnValue(0);
}

class StubPhotosApiService {
  upload = jasmine.createSpy('upload').and.returnValue(of(makePhoto('photo-1')));
}

function makePhoto(id: string): PhotoResponse {
  return {
    id,
    tenantId: 'tenant-1',
    filePath: `/photos/${id}.jpg`,
    thumbnailPath: null,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    capturedAtUtc: null,
    createdAtUtc: '2026-09-12T10:00:00Z',
    deletedAtUtc: null,
  };
}

@Component({
  standalone: true,
  imports: [CePhotoCaptureComponent],
  template: `
    <ce-photo-capture
      [entityType]="entity"
      [entityId]="id"
      [open]="open()"
      [mode]="mode"
      (photoUploaded)="onUploaded($event)"
      (closed)="onClosed()"
    />
  `,
})
class HostComponent {
  entity = 'resident' as const;
  id = 'resident-1';
  mode: 'camera' | 'upload' = 'upload';
  open = signal(true);
  uploaded: PhotoResponse | null = null;
  closedCount = 0;

  onUploaded(p: PhotoResponse) {
    this.uploaded = p;
  }
  onClosed() {
    this.closedCount++;
  }
}

describe('CePhotoCaptureComponent', () => {
  let hostFixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let capture: CePhotoCaptureComponent;
  let photosApi: StubPhotosApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: ToastService, useClass: StubToastService },
        { provide: PhotosApiService, useClass: StubPhotosApiService },
        importProvidersFrom(CE_LUCIDE_ICONS),
      ],
    }).compileComponents();

    hostFixture = TestBed.createComponent(HostComponent);
    host = hostFixture.componentInstance;
    photosApi = TestBed.inject(PhotosApiService) as unknown as StubPhotosApiService;
    hostFixture.detectChanges();
    capture = hostFixture.debugElement.children[0]!.componentInstance as CePhotoCaptureComponent;
  });

  it('initialises with mode=upload when host passes mode=upload', () => {
    host.mode = 'upload';
    hostFixture.detectChanges();
    expect(capture.mode()).toBe('upload');
  });

  it('rejects files larger than 8 MB', () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    const ev = { target: { files: [big] } } as unknown as Event;
    capture.onFileSelected(ev);
    expect(capture.selectedFile()).toBeNull();
    const toast = TestBed.inject(ToastService) as unknown as StubToastService;
    expect(toast.error).toHaveBeenCalled();
  });

  it('rejects unsupported mime types', () => {
    const bad = new File([new Uint8Array(100)], 'doc.pdf', { type: 'application/pdf' });
    const ev = { target: { files: [bad] } } as unknown as Event;
    capture.onFileSelected(ev);
    expect(capture.selectedFile()).toBeNull();
  });

  it('accepts valid JPEG files', () => {
    const ok = new File([new Uint8Array(100)], 'ok.jpg', { type: 'image/jpeg' });
    const ev = { target: { files: [ok] } } as unknown as Event;
    capture.onFileSelected(ev);
    expect(capture.selectedFile()).toBeTruthy();
  });

  it('uploads selected file via the API and emits photoUploaded', async () => {
    // Provide a minimal 1x1 PNG so compressImage (canvas-based) can succeed
    // even though jsdom does not implement canvas. We instead mock compressImage
    // by replacing the import via TestBed overrideComponent is overkill; we
    // rely on the fact that compressImage catches "CANVAS_TO_BLOB_FAILED"
    // and the upload is gated on the result. To isolate the upload path we
    // spy on the component's processBlob call indirectly by providing a valid
    // JPEG (which is what gets emitted after compression).
    // Easier route: install a noop via prototype override.
    const fakeBlob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    const toBlobSpy = spyOn(HTMLCanvasElement.prototype, 'toBlob').and.callFake(((cb: (b: Blob | null) => void) =>
      cb(fakeBlob)) as any);
    const decodeSpy = spyOn(HTMLImageElement.prototype, 'decode').and.callFake(async () => undefined);
    const ok = new File([new Uint8Array(100)], 'ok.jpg', { type: 'image/jpeg' });
    capture.onFileSelected({ target: { files: [ok] } } as unknown as Event);
    await capture.upload();
    expect(photosApi.upload).toHaveBeenCalled();
    expect(host.uploaded?.id).toBe('photo-1');
    expect(host.closedCount).toBe(1);
    toBlobSpy.calls.reset();
    decodeSpy.calls.reset();
  });

  it('retries upload on transient failure then succeeds', async () => {
    const fakeBlob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    const toBlobSpy = spyOn(HTMLCanvasElement.prototype, 'toBlob').and.callFake(((cb: (b: Blob | null) => void) =>
      cb(fakeBlob)) as any);
    const decodeSpy = spyOn(HTMLImageElement.prototype, 'decode').and.callFake(async () => undefined);
    let calls = 0;
    photosApi.upload.and.callFake(() => {
      calls++;
      if (calls < 3) return throwError(() => new Error('network'));
      return of(makePhoto('photo-2'));
    });
    const ok = new File([new Uint8Array(100)], 'ok.jpg', { type: 'image/jpeg' });
    capture.onFileSelected({ target: { files: [ok] } } as unknown as Event);
    await capture.upload();
    expect(calls).toBe(3);
    expect(host.uploaded?.id).toBe('photo-2');
    toBlobSpy.calls.reset();
    decodeSpy.calls.reset();
  });

  it('shows error toast on terminal upload failure', async () => {
    const fakeBlob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    const toBlobSpy = spyOn(HTMLCanvasElement.prototype, 'toBlob').and.callFake(((cb: (b: Blob | null) => void) =>
      cb(fakeBlob)) as any);
    const decodeSpy = spyOn(HTMLImageElement.prototype, 'decode').and.callFake(async () => undefined);
    photosApi.upload.and.returnValue(throwError(() => new Error('server 500')));
    const toast = TestBed.inject(ToastService) as unknown as StubToastService;
    const ok = new File([new Uint8Array(100)], 'ok.jpg', { type: 'image/jpeg' });
    capture.onFileSelected({ target: { files: [ok] } } as unknown as Event);
    await capture.upload();
    expect(toast.error).toHaveBeenCalled();
    expect(host.uploaded).toBeNull();
    toBlobSpy.calls.reset();
    decodeSpy.calls.reset();
  });

  it('emits closed when close() is called', () => {
    capture.close();
    expect(host.closedCount).toBe(1);
  });

  it('does not start camera when mode=camera but getUserMedia is missing', async () => {
    // jsdom does not implement mediaDevices
    host.mode = 'camera';
    host.open.set(true);
    hostFixture.detectChanges();
    capture.modeChange.subscribe((m) => (host.mode = m));
    await capture.startCamera();
    const toast = TestBed.inject(ToastService) as unknown as StubToastService;
    expect(toast.warning).toHaveBeenCalled();
    expect(capture.modeChange).toBeDefined();
  });

  it('switchMode flips effectiveMode locally even when the parent does not bind [mode]', () => {
    host.mode = 'camera';
    hostFixture.detectChanges();
    expect(capture.effectiveMode()).toBe('camera');

    capture.switchMode('upload');
    hostFixture.detectChanges();
    expect(capture.effectiveMode()).toBe('upload');
    expect(host.mode).toBe('camera');
  });
});
