import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { DeviceConfigureModalComponent, ConfigureGatehouseOption } from './device-configure-modal.component';
import { DeviceHealthDto } from '../door-unlock.types';
import { ToastService } from '../../../design-system/components/toast/toast.component';

// Per-device Configure dialog on /devices. The unbound gatehouse marker must
// match the backend's EditDeviceRequest contract (Guid.Empty clears the
// binding); the synthetic GUID literals below are generated, never real data.
const GATEHOUSE_A = '00000000-0000-0000-0000-00000000000a';
const GATEHOUSE_B = '00000000-0000-0000-0000-00000000000b';

const GATEHOUSE_LIST: ConfigureGatehouseOption[] = [
  { id: GATEHOUSE_A, name: 'Main gatehouse' },
  { id: GATEHOUSE_B, name: 'Pool gatehouse' },
];

function makeDevice(overrides: Partial<DeviceHealthDto> = {}): DeviceHealthDto {
  return {
    deviceId: 'd1',
    vendor: 'ControlEasy simulator',
    deviceType: 'reader',
    gatehouseId: null,
    gatehouseName: null,
    status: 'Offline',
    statusLabel: 'Offline',
    lastHeartbeatAtUtc: null,
    errorCount: 0,
    eventsSinceLastSuccess: 0,
    errorRatePercent: 0,
    offlineAfterSeconds: 60,
    errorRateThresholdPercent: 10,
    isOfflineExceeded: true,
    ...overrides,
  };
}

describe('DeviceConfigureModalComponent', () => {
  let fixture: ComponentFixture<DeviceConfigureModalComponent>;
  let component: DeviceConfigureModalComponent;
  let httpMock: HttpTestingController;
  let toast: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, DeviceConfigureModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceConfigureModalComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('HydratesFromDeviceInput: gatehouse select and thresholds prefill from the device row', () => {
    component.device = makeDevice({ gatehouseId: GATEHOUSE_A, offlineAfterSeconds: 300, errorRateThresholdPercent: 5 });
    component.open = true;
    fixture.detectChanges();

    expect(component.form.controls.gatehouseId.value).toBe(GATEHOUSE_A);
    expect(component.form.controls.offlineAfterSeconds.value).toBe(300);
    expect(component.form.controls.errorRateThresholdPercent.value).toBe(5);
    expect(component.form.valid).toBe(true);
  });

  it('UnboundDeviceHydratesToNoBinding: an unbound device shows the "No binding" select value', () => {
    component.device = makeDevice({ gatehouseId: null });
    component.open = true;
    fixture.detectChanges();

    expect(component.form.controls.gatehouseId.value).toBe('');
    expect(component.gatehouseChanged()).toBe(false);
    expect(component.canSubmit()).toBe(false);
  });

  it('RehydratesOnReopen: inputs are rebuilt when the dialog reopens for a device', () => {
    component.device = makeDevice({ gatehouseId: GATEHOUSE_A, offlineAfterSeconds: 300 });
    component.open = true;
    fixture.detectChanges();

    // User mutates the form, then closes (page clears the device) and reopens.
    component.form.controls.offlineAfterSeconds.setValue(999);
    fixture.detectChanges();
    component.device = undefined;
    fixture.detectChanges();
    component.open = false;
    fixture.detectChanges();

    component.device = makeDevice({ gatehouseId: GATEHOUSE_B, offlineAfterSeconds: 60, errorRateThresholdPercent: 12.5 });
    component.open = true;
    fixture.detectChanges();

    expect(component.form.controls.gatehouseId.value).toBe(GATEHOUSE_B);
    expect(component.form.controls.offlineAfterSeconds.value).toBe(60);
    expect(component.form.controls.errorRateThresholdPercent.value).toBe(12.5);
    expect(component.errorMessage()).toBeNull();
  });

  it('InvalidOfflineThreshold_BlocksSaveWithoutApiCall: 0 / negative / fractional rejected client-side', () => {
    component.device = makeDevice();
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    const errorSpy = spyOn(toast, 'error');

    for (const invalid of [0, -5, 90.5]) {
      component.form.controls.offlineAfterSeconds.setValue(invalid);
      fixture.detectChanges();
      expect(component.form.valid).toBe(false);
      expect(component.offlineError()).toBeTruthy();
      void component.onSubmit();
      httpMock.expectNone('/api/v1/devices/d1');
      httpMock.expectNone(`/api/v1/devices/d1/thresholds`);
      expect(errorSpy).not.toHaveBeenCalled();
    }
  });

  it('InvalidPercent_BlocksSave: >100 rejected client-side', () => {
    component.device = makeDevice();
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    component.form.controls.errorRateThresholdPercent.setValue(120);
    fixture.detectChanges();
    expect(component.form.valid).toBe(false);
    void component.onSubmit();
    httpMock.expectNone('/api/v1/devices/d1');
    httpMock.expectNone(`/api/v1/devices/d1/thresholds`);
  });

  it('PercentBounds_Valid: 0 and 100 both validate', () => {
    component.device = makeDevice();
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    component.form.controls.errorRateThresholdPercent.setValue(0);
    expect(component.form.controls.errorRateThresholdPercent.valid).toBe(true);

    component.form.controls.errorRateThresholdPercent.setValue(100);
    expect(component.form.controls.errorRateThresholdPercent.valid).toBe(true);
  });

  it('SaveDisabledWhenNoChanges: untouched form keeps the Save button disabled', () => {
    component.device = makeDevice({ gatehouseId: GATEHOUSE_A });
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    const save = native.querySelector('[data-testid="configure-save"]') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('UnchangedBoundDeviceKeepsBinding: vendor-only flows never fire PATCH', () => {
    component.device = makeDevice({ gatehouseId: GATEHOUSE_A });
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    expect(component.gatehouseChanged()).toBe(false);
    expect(component.thresholdsChanged()).toBe(false);
    expect(component.canSubmit()).toBe(false);
  });

  it('BindOnlySave_CallsPatchOnly: changed gatehouse fires PATCH /api/v1/devices/{id}, emits saved', async () => {
    component.device = makeDevice({ gatehouseId: null });
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    component.form.controls.gatehouseId.setValue(GATEHOUSE_A);
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(true);

    const savedSpy = spyOn(component.saved, 'emit');
    const toastSpy = spyOn(toast, 'success');

    const submitPromise = component.onSubmit();
    const patch = httpMock.expectOne('/api/v1/devices/d1');
    expect(patch.request.method).toBe('PATCH');
    expect((patch.request.body as { gatehouseId?: string }).gatehouseId).toBe(GATEHOUSE_A);
    patch.flush({});
    await submitPromise;

    httpMock.expectNone(`/api/v1/devices/d1/thresholds`);
    expect(savedSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalled();
  });

  it('UnbindSave_SendsEmptyGuidMarker: "No binding" PATCHes the Guid.Empty marker', async () => {
    component.device = makeDevice({ gatehouseId: GATEHOUSE_A, gatehouseName: 'Main gatehouse' });
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    component.form.controls.gatehouseId.setValue('');
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(true);

    const savedSpy = spyOn(component.saved, 'emit');
    const submitPromise = component.onSubmit();
    const patch = httpMock.expectOne('/api/v1/devices/d1');
    expect(patch.request.method).toBe('PATCH');
    expect((patch.request.body as { gatehouseId?: string }).gatehouseId).toBe(
      '00000000-0000-0000-0000-000000000000'
    );
    patch.flush({});
    await submitPromise;

    expect(savedSpy).toHaveBeenCalled();
  });

  it('ThresholdsOnlySave_CallsPutOnly: changed thresholds fire PUT /thresholds, no PATCH', async () => {
    component.device = makeDevice({ gatehouseId: GATEHOUSE_A, offlineAfterSeconds: 60, errorRateThresholdPercent: 10 });
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    component.form.controls.offlineAfterSeconds.setValue(300);
    component.form.controls.errorRateThresholdPercent.setValue(12.5);
    fixture.detectChanges();
    expect(component.gatehouseChanged()).toBe(false);
    expect(component.thresholdsChanged()).toBe(true);

    const savedSpy = spyOn(component.saved, 'emit');
    const toastSpy = spyOn(toast, 'success');

    const submitPromise = component.onSubmit();
    const put = httpMock.expectOne('/api/v1/devices/d1/thresholds');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body as object).toEqual({
      offlineAfterSeconds: 300,
      errorRateThresholdPercent: 12.5,
    });
    put.flush({ deviceId: 'd1', offlineAfterSeconds: 300, errorRateThresholdPercent: 12.5 });
    await submitPromise;

    httpMock.expectNone('/api/v1/devices/d1');
    expect(savedSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalled();
  });

  it('BothChanged_CallsPatchThenPut: binding and thresholds save together', async () => {
    component.device = makeDevice({ gatehouseId: null });
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    component.form.controls.gatehouseId.setValue(GATEHOUSE_A);
    component.form.controls.offlineAfterSeconds.setValue(120);
    fixture.detectChanges();

    const savedSpy = spyOn(component.saved, 'emit');
    const toastSpy = spyOn(toast, 'success');

    const submitPromise = component.onSubmit();
    const patch = httpMock.expectOne('/api/v1/devices/d1');
    expect(patch.request.method).toBe('PATCH');
    patch.flush({});
    // The PUT subscribes in the PATCH-resolution microtask — yield one tick
    // (not on submitPromise: that only settles after the PUT is flushed).
    await Promise.resolve();
    const put = httpMock.expectOne('/api/v1/devices/d1/thresholds');
    expect(put.request.method).toBe('PUT');
    expect((put.request.body as { offlineAfterSeconds?: number }).offlineAfterSeconds).toBe(120);
    put.flush({});
    await submitPromise;

    expect(savedSpy).toHaveBeenCalled();
    expect(toastSpy.calls.count()).toBe(2);
  });

  it('SaveFailure_ShowsError_KeepsModalState: a failed PUT surfaces getApiErrorMessage without saved', async () => {
    component.device = makeDevice();
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    component.form.controls.offlineAfterSeconds.setValue(90);
    fixture.detectChanges();

    const savedSpy = spyOn(component.saved, 'emit');

    const submitPromise = component.onSubmit();
    const put = httpMock.expectOne('/api/v1/devices/d1/thresholds');
    // Mirrors the real ProblemDetails the global handler emits for a
    // module ValidationException (title + detail + errors dict).
    put.flush(
      {
        status: 400,
        title: 'Validation failed',
        detail: 'One or more validation errors occurred.',
        errors: { OfflineAfterSeconds: ['offlineAfterSeconds must be at least 1 second.'] },
      },
      { status: 400, statusText: 'Bad Request' }
    );
    await submitPromise;

    expect(component.errorMessage()).toContain('validation errors');
    expect(savedSpy).not.toHaveBeenCalled();
    // The modal stays usable for a retry (saving flag released).
    expect(component.saving()).toBe(false);
  });

  it('DismissalEmitsCancelled_EscapeAndBackdrop: modal closed events route to cancelled without API calls', () => {
    component.device = makeDevice();
    component.open = true;
    component.gatehouseList = GATEHOUSE_LIST;
    fixture.detectChanges();

    const cancelledSpy = spyOn(component.cancelled, 'emit');

    // Simulate CeModal's user-side close (ESC keydown / backdrop click) —
    // both route through openChange(false) + closed.
    component.onOpenChange(false);
    expect(cancelledSpy).toHaveBeenCalled();
    httpMock.expectNone('/api/v1/devices/d1');
    httpMock.expectNone('/api/v1/devices/d1/thresholds');
  });
});