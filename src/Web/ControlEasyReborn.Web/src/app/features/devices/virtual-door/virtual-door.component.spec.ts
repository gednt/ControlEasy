import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { VirtualDoorComponent } from './virtual-door.component';
import { DevicesApiService } from '../devices-api.service';
import { DeviceSimulatorService } from '../device-simulator.service';
import { GatehouseContextService } from '../../access-control/gatehouse-context.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  DeviceDetail,
  DeviceEventListItem,
  DeviceListItem,
  SimulatorDeviceReadiness,
} from '../door-unlock.types';
import { CE_LUCIDE_ICONS } from '../../../design-system/components/icon/icon.registry';
import { importProvidersFrom } from '@angular/core';

const SYNTHETIC_READER_ID = '00000000-0000-0000-0000-0000000000aa';
const SYNTHETIC_GATEHOUSE_ID = '00000000-0000-0000-0000-0000000000gg';

function makeReader(overrides: Partial<DeviceListItem> = {}): DeviceListItem {
  return {
    id: SYNTHETIC_READER_ID,
    deviceType: 'reader',
    vendor: 'ControlEasy simulator',
    gatehouseId: SYNTHETIC_GATEHOUSE_ID,
    isActive: true,
    createdAtUtc: new Date().toISOString(),
    updatedAtUtc: null,
    ...overrides,
  };
}

function makeReadyReadiness(): SimulatorDeviceReadiness {
  return {
    ready: true,
    reason: null,
    vendor: 'ControlEasy simulator',
    gatehouseId: SYNTHETIC_GATEHOUSE_ID,
    gatehouseName: 'Main gatehouse',
  };
}

function makeEvent(overrides: Partial<DeviceEventListItem> = {}): DeviceEventListItem {
  return {
    id: 'event-1',
    deviceId: SYNTHETIC_READER_ID,
    eventType: 'card_read',
    occurredAtUtc: new Date().toISOString(),
    processedAtUtc: new Date().toISOString(),
    sequenceNumber: 1,
    resultCode: 'advanced_visit',
    failureCode: null,
    visitId: null,
    accessEventId: 'access-1',
    refusedScanAttemptId: null,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<DeviceDetail> = {}): DeviceDetail {
  return {
    id: SYNTHETIC_READER_ID,
    tenantId: 'tenant',
    deviceType: 'reader',
    vendor: 'ControlEasy simulator',
    connectionParams: { redacted: true, last4: '40' },
    gatehouseId: SYNTHETIC_GATEHOUSE_ID,
    gatehouseName: 'Main gatehouse',
    isActive: true,
    createdAtUtc: new Date().toISOString(),
    updatedAtUtc: null,
    removedAtUtc: null,
    createdByProfileId: 'profile',
    ...overrides,
  };
}

class FakeDevicesApiService {
  listDevices: DeviceListItem[] = [];
  registerSpy = jasmine.createSpy('register').and.callFake(() => of(makeDetail()));

  // Reads the CURRENT listDevices at call time, so tests may mutate the
  // synthetic device set after TestBed configuration.
  list(): Observable<DeviceListItem[]> {
    return of(this.listDevices);
  }

  register(_request: Parameters<DevicesApiService['register']>[0]): Observable<DeviceDetail> {
    this.registerSpy(_request);
    return of(makeDetail());
  }

  listEvents(): Observable<DeviceEventListItem[]> {
    return of([makeEvent()]);
  }
}

class FakeSimulatorService {
  readonly lastError = signal<string | null>(null);
  probeReadiness = jasmine
    .createSpy('probeReadiness')
    .and.returnValue(Promise.resolve(makeReadyReadiness()));
  presentCredential = jasmine.createSpy('presentCredential').and.returnValue(
    Promise.resolve({
      outcome: 'advanced_visit',
      failureCode: null,
      direction: 'entrance',
      existingEventId: null,
      visitId: 'visit-1',
      accessEventId: 'access-1',
      refusalId: null,
      occurredAtUtc: new Date().toISOString(),
      processedAtUtc: new Date().toISOString(),
    }),
  );
}

class FakeGatehouseContextService {
  readonly gatehouses = signal([{ id: SYNTHETIC_GATEHOUSE_ID, name: 'Main gatehouse', location: null }]);
  readonly selectedGatehouseId = signal<string | null>(SYNTHETIC_GATEHOUSE_ID);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedGatehouse = signal({ id: SYNTHETIC_GATEHOUSE_ID, name: 'Main gatehouse', location: null });
  load(): void {
    /* no-op */
  }
}

describe('VirtualDoorComponent', () => {
  let fixture: ComponentFixture<VirtualDoorComponent>;
  let component: VirtualDoorComponent;
  let devicesApi: FakeDevicesApiService;
  let simulator: FakeSimulatorService;

  function configure(options?: { isTenantAdmin?: boolean }): void {
    devicesApi = new FakeDevicesApiService();
    simulator = new FakeSimulatorService();

    TestBed.configureTestingModule({
      imports: [VirtualDoorComponent],
      providers: [
        importProvidersFrom(CE_LUCIDE_ICONS),
        provideRouter([]),
        { provide: DevicesApiService, useValue: devicesApi },
        { provide: DeviceSimulatorService, useValue: simulator },
        { provide: GatehouseContextService, useValue: new FakeGatehouseContextService() },
        {
          provide: AuthService,
          useValue: { isTenantAdmin: () => options?.isTenantAdmin ?? true },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VirtualDoorComponent);
    component = fixture.componentInstance;
  }

  it('shows administrator guidance for a porteiro when no virtual reader exists', fakeAsync(() => {
    configure({ isTenantAdmin: false });
    devicesApi.listDevices = [];
    fixture.detectChanges();
    tick();

    const guidance = fixture.nativeElement.querySelector('[data-testid="virtual-door-empty-guidance"]');
    expect(guidance).not.toBeNull();
    // Porteiro never gets a failing create action.
    expect(fixture.nativeElement.querySelector('[data-testid="virtual-door-create-btn"]')).toBeNull();
  }));

  it('offers a create action to a TenantAdmin and registers the device bound to the active gatehouse', fakeAsync(() => {
    configure({ isTenantAdmin: true });
    devicesApi.listDevices = [];
    fixture.detectChanges();
    tick();

    const createBtn = fixture.nativeElement.querySelector(
      '[data-testid="virtual-door-create-btn"] button',
    ) as HTMLButtonElement;
    expect(createBtn).not.toBeNull();
    createBtn.click();
    tick();

    expect(devicesApi.registerSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        deviceType: 'reader',
        vendor: 'ControlEasy simulator',
        gatehouseId: SYNTHETIC_GATEHOUSE_ID,
        connectionParams: { simulator: true },
      }),
    );
  }));

  it('displays the gatehouse binding and enables presentation for a ready reader', fakeAsync(() => {
    configure({ isTenantAdmin: true });
    devicesApi.listDevices = [makeReader()];
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const binding = fixture.nativeElement.querySelector('[data-testid="virtual-door-binding"]');
    expect(binding?.textContent).toContain('Main gatehouse');

    const presentBtn = fixture.nativeElement.querySelector(
      '[data-testid="virtual-door-present-btn"] button',
    ) as HTMLButtonElement;
    // Without a token the primary action stays disabled.
    expect(presentBtn.disabled).toBeTrue();

    (fixture.nativeElement.querySelector(
      '[data-testid="virtual-door-token-input"]',
    ) as HTMLInputElement).value = 'issued-credential-token';
    (fixture.nativeElement.querySelector('[data-testid="virtual-door-token-input"]') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    fixture.detectChanges();
    tick();

    const enabledBtn = fixture.nativeElement.querySelector(
      '[data-testid="virtual-door-present-btn"] button',
    ) as HTMLButtonElement;
    expect(enabledBtn.disabled).toBeFalse();
  }));

  it('presents a credential and renders the operational receipt with linked ids', fakeAsync(() => {
    configure({ isTenantAdmin: true });
    devicesApi.listDevices = [makeReader()];
    fixture.detectChanges();
    tick();

    (component as unknown as { token: WritableSignal<string> }).token.set('issued-credential-token');
    fixture.detectChanges();

    void (component as unknown as { present: () => Promise<void> }).present();
    tick();
    fixture.detectChanges();

    expect(simulator.presentCredential).toHaveBeenCalledWith(SYNTHETIC_READER_ID, 'issued-credential-token', 'entrance');

    const receipt = fixture.nativeElement.querySelector('[data-testid="virtual-door-receipt"]');
    expect(receipt).not.toBeNull();
    expect(receipt?.textContent).toContain('Visit advanced');
    expect(receipt?.textContent).toContain('entrance');
    expect(fixture.nativeElement.querySelector('[data-testid="virtual-door-receipt-visit"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="virtual-door-receipt-access"]')).not.toBeNull();
  }));

  it('surfaces the configured offline failure without treating it as an app error', fakeAsync(() => {
    configure({ isTenantAdmin: true });
    devicesApi.listDevices = [makeReader()];
    simulator.presentCredential = jasmine.createSpy('presentCredential').and.returnValue(
      Promise.resolve({
        outcome: 'device_offline',
        failureCode: null,
        direction: 'entrance',
        existingEventId: null,
        visitId: null,
        accessEventId: null,
        refusalId: null,
        occurredAtUtc: new Date().toISOString(),
        processedAtUtc: new Date().toISOString(),
      }),
    );
    fixture.detectChanges();
    tick();

    (component as unknown as { token: WritableSignal<string> }).token.set('issued-credential-token');
    fixture.detectChanges();

    void (component as unknown as { present: () => Promise<void> }).present();
    tick();
    fixture.detectChanges();

    const receipt = fixture.nativeElement.querySelector('[data-testid="virtual-door-receipt"]');
    expect(receipt?.textContent).toContain('Reader offline');
    // No global error banner for a deliberate dev configuration.
    expect(fixture.nativeElement.querySelector('[data-testid="virtual-door-error"]')).toBeNull();
  }));

  it('shows the actionable not-ready reason when the reader has no gatehouse binding', fakeAsync(() => {
    configure({ isTenantAdmin: true });
    devicesApi.listDevices = [makeReader()];
    simulator.probeReadiness = jasmine.createSpy('probeReadiness').and.returnValue(
      Promise.resolve({
        ready: false,
        reason: 'gatehouse_binding_missing',
        vendor: 'ControlEasy simulator',
        gatehouseId: null,
        gatehouseName: null,
      }),
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const binding = fixture.nativeElement.querySelector('[data-testid="virtual-door-binding"]');
    expect(binding?.textContent).toContain('no gatehouse binding');

    const presentBtn = fixture.nativeElement.querySelector(
      '[data-testid="virtual-door-present-btn"] button',
    ) as HTMLButtonElement;
    expect(presentBtn.disabled).toBeTrue();
  }));

  it('renders recent device events for the selected reader', fakeAsync(() => {
    configure({ isTenantAdmin: true });
    devicesApi.listDevices = [makeReader()];
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const events = fixture.nativeElement.querySelector('[data-testid="virtual-door-events"]');
    expect(events).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="virtual-door-event-result"]')?.textContent).toContain(
      'advanced_visit',
    );
  }));

  it('surfaces a load failure message when the device list cannot be fetched', fakeAsync(() => {
    configure({ isTenantAdmin: true });
    spyOn(devicesApi, 'list').and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="virtual-door-error"]')).not.toBeNull();
  }));
});