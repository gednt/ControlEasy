import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { DeviceFormModalComponent } from './device-form-modal.component';
import { DeviceDetail, EditDeviceRequest, RegisterDeviceRequest } from '../door-unlock.types';

function makeDevice(overrides: Partial<DeviceDetail> = {}): DeviceDetail {
  return {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    tenantId: '11111111-1111-1111-1111-111111111111',
    deviceType: 'reader',
    vendor: 'Generic',
    connectionParams: { redacted: true, last4: 'deadbeef' },
    gatehouseId: '22222222-2222-2222-2222-222222222222',
    gatehouseName: 'Portaria A',
    isActive: true,
    createdAtUtc: '2026-01-01T00:00:00.000Z',
    updatedAtUtc: null,
    removedAtUtc: null,
    createdByProfileId: '33333333-3333-3333-3333-333333333333',
    ...overrides,
  };
}

describe('DeviceFormModalComponent', () => {
  let fixture: ComponentFixture<DeviceFormModalComponent>;
  let component: DeviceFormModalComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, DeviceFormModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceFormModalComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('RegisterMode_FormStartsEmpty: form initializes empty in register mode', () => {
    component.open = true;
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(false);
    expect(component.form.controls.deviceType.value).toBe('reader');
    expect(component.form.controls.vendor.value).toBe('Generic');
    expect(component.form.controls.gatehouseId.value).toBe('');
    expect(component.form.controls.connectionParams.value).toBe('');
  });

  it('EditMode_FormPrefilled: form is prefilled when device is provided', () => {
    const device = makeDevice({ deviceType: 'controller', vendor: 'Control iD' });
    component.device = device;
    component.open = true;
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(component.form.controls.deviceType.value).toBe('controller');
    expect(component.form.controls.deviceType.disabled).toBe(true);
    expect(component.form.controls.vendor.value).toBe('Control iD');
    expect(component.form.controls.connectionParams.value).toBe('');
    expect(component.submitLabel()).toBe('Save changes');
  });

  it('InvalidJson_DisablesSubmit: malformed JSON disables the submit button', () => {
    component.open = true;
    component.gatehouseList = [{ id: 'gh-1', name: 'Portaria A' }];
    component.form.controls.gatehouseId.setValue('gh-1');
    component.form.controls.connectionParams.setValue('{ not json');
    fixture.detectChanges();

    expect(component.jsonValidity()).toBe('invalid');
    expect(component.form.valid).toBe(false);
  });

  it('ValidJson_EnablesSubmit: well-formed JSON makes the submit button enabled', () => {
    component.open = true;
    component.gatehouseList = [{ id: 'gh-1', name: 'Portaria A' }];
    component.form.controls.gatehouseId.setValue('gh-1');
    component.form.controls.connectionParams.setValue('{"endpoint":"https://device.example/api"}');
    fixture.detectChanges();

    expect(component.jsonValidity()).toBe('valid');
    expect(component.form.valid).toBe(true);
  });

  it('OtherVendor_ShowsCustomInput: vendor select contains the Other option for free-text', () => {
    expect(component.vendorOptions).toContain('Other');
    expect(component.vendorOptions).toContain('Generic');
    expect(component.vendorOptions).toContain('Control iD');
  });

  it('RegisterSubmit_CallsApiAndEmits: register fires POST /api/v1/devices and emits saved', async () => {
    component.open = true;
    component.gatehouseList = [{ id: 'gh-1', name: 'Portaria A' }];
    component.form.controls.deviceType.setValue('reader');
    component.form.controls.vendor.setValue('Generic');
    component.form.controls.gatehouseId.setValue('gh-1');
    component.form.controls.connectionParams.setValue('{"endpoint":"https://x"}');
    fixture.detectChanges();

    const savedSpy = spyOn(component.saved, 'emit');

    const submitPromise = component.onSubmit();

    const req = httpMock.expectOne('/api/v1/devices');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as RegisterDeviceRequest;
    expect(body.deviceType).toBe('reader');
    expect(body.connectionParams).toEqual({ endpoint: 'https://x' });
    req.flush(makeDevice({ id: 'new-id' }));
    await submitPromise;

    expect(savedSpy).toHaveBeenCalled();
    const emitted = savedSpy.calls.mostRecent().args[0] as DeviceDetail;
    expect(emitted.id).toBe('new-id');
  });

  it('EditSubmit_CallsApiAndEmits: edit fires PATCH /api/v1/devices/{id} and emits saved', async () => {
    const existingId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    component.device = makeDevice({ id: existingId });
    component.gatehouseList = [{ id: 'gh-1', name: 'Portaria A' }];
    component.form.controls.connectionParams.setValue('{"endpoint":"https://y"}');
    fixture.detectChanges();

    const savedSpy = spyOn(component.saved, 'emit');

    const submitPromise = component.onSubmit();

    const req = httpMock.expectOne(`/api/v1/devices/${existingId}`);
    expect(req.request.method).toBe('PATCH');
    const body = req.request.body as EditDeviceRequest;
    expect(body.connectionParams).toEqual({ endpoint: 'https://y' });
    req.flush(makeDevice({ id: existingId, vendor: 'Generic' }));
    await submitPromise;

    expect(savedSpy).toHaveBeenCalled();
  });

  it('Cancel_EmitsCancelled: cancel button emits the cancelled output', () => {
    component.open = true;
    fixture.detectChanges();

    const cancelledSpy = spyOn(component.cancelled, 'emit');
    component.onCancelled();
    expect(cancelledSpy).toHaveBeenCalled();
  });
});