import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { DeviceHealthService } from './device-health.service';
import { DevicesApiService } from './devices-api.service';
import { DeviceHealthDto } from './door-unlock.types';
import { Observable, of, Subject, throwError } from 'rxjs';

class FakeDevicesApiService {
  private readonly snapshots$$ = new Subject<DeviceHealthDto[]>();
  public responses: DeviceHealthDto[][] = [];
  public nextError: unknown = null;

  // Mimic the real signature: Observable<DeviceHealthDto[]>.
  getHealth(): Observable<DeviceHealthDto[]> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      return throwError(() => err);
    }
    return this.snapshots$$.asObservable();
  }

  emit(list: DeviceHealthDto[]): void {
    this.snapshots$$.next(list);
  }

  // For the polling-tick path (service calls subscribe() inside tick()).
  emitOnce(list: DeviceHealthDto[]): void {
    this.snapshots$$.next(list);
  }
}

function makeDevice(overrides: Partial<DeviceHealthDto> = {}): DeviceHealthDto {
  return {
    deviceId: overrides.deviceId ?? 'device-1',
    vendor: overrides.vendor ?? 'Simulated',
    deviceType: overrides.deviceType ?? 'reader',
    gatehouseId: overrides.gatehouseId ?? null,
    gatehouseName: overrides.gatehouseName ?? 'Gatehouse A',
    status: overrides.status ?? 'Online',
    statusLabel: overrides.statusLabel ?? 'Online',
    lastHeartbeatAtUtc: overrides.lastHeartbeatAtUtc ?? new Date().toISOString(),
    errorCount: overrides.errorCount ?? 0,
    eventsSinceLastSuccess: overrides.eventsSinceLastSuccess ?? 10,
    errorRatePercent: overrides.errorRatePercent ?? 0,
    offlineAfterSeconds: overrides.offlineAfterSeconds ?? 60,
    errorRateThresholdPercent: overrides.errorRateThresholdPercent ?? 10,
    isOfflineExceeded: overrides.isOfflineExceeded ?? false,
  };
}

describe('DeviceHealthService', () => {
  let service: DeviceHealthService;
  let api: FakeDevicesApiService;

  beforeEach(() => {
    api = new FakeDevicesApiService();
    TestBed.configureTestingModule({
      providers: [
        DeviceHealthService,
        { provide: DevicesApiService, useValue: api },
      ],
    });
    service = TestBed.inject(DeviceHealthService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('initial state is empty snapshot + no transitions emitted', () => {
    expect(service.getCurrentSnapshot()).toEqual([]);
    let latest: DeviceHealthDto[] = [];
    service.health$.subscribe((s) => (latest = s));
    expect(latest).toEqual([]);
  });

  it('refreshNow fetches once and replaces the snapshot', fakeAsync(() => {
    // First refreshNow
    service.refreshNow();
    tick(1);
    api.emitOnce([makeDevice()]);
    tick(1);
    expect(service.getCurrentSnapshot().length).toBe(1);
    // Second refreshNow with a new device
    service.refreshNow();
    tick(1);
    api.emitOnce([makeDevice({ deviceId: 'device-2' })]);
    tick(1);
    expect(service.getCurrentSnapshot().length).toBe(1);
    const snap = service.getCurrentSnapshot();
    expect(snap[0]?.deviceId).toBe('device-2');
    discardPeriodicTasks();
  }));

  it('emits an offline transition when a device flips from online to offline', fakeAsync(() => {
    service.refreshNow();
    tick(1);
    api.emitOnce([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    tick(1);

    let captured: { kind: string; deviceId: string } | undefined;
    const sub = service.offlineAlerts$.subscribe((t) => {
      captured = { kind: t.kind, deviceId: t.device.deviceId };
    });

    service.refreshNow();
    tick(1);
    api.emitOnce([makeDevice({ deviceId: 'd1', status: 'Offline', isOfflineExceeded: true })]);
    tick(1);

    expect(captured).toBeDefined();
    expect(captured).toEqual({ kind: 'offline', deviceId: 'd1' });
    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('clears no transitions on recovery (online stays online)', fakeAsync(() => {
    service.refreshNow();
    tick(1);
    api.emitOnce([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    tick(1);

    let offlineFired = false;
    service.offlineAlerts$.subscribe(() => (offlineFired = true));

    service.refreshNow();
    tick(1);
    api.emitOnce([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    tick(1);

    expect(offlineFired).toBe(false);
    discardPeriodicTasks();
  }));

  it('pauses polling for 60s after 3 consecutive errors', fakeAsync(() => {
    // Three consecutive errors.
    for (let i = 0; i < 3; i++) {
      api.nextError = new Error('boom');
      service.refreshNow();
      tick(10);
    }
    expect(service.isPaused()).toBe(true);

    // Advance 60s -> pause clears.
    tick(60_000);
    expect(service.isPaused()).toBe(false);
    discardPeriodicTasks();
  }));

  it('keeps the last snapshot when polling errors (no flicker)', fakeAsync(() => {
    service.refreshNow();
    tick(1);
    api.emitOnce([makeDevice({ deviceId: 'd1' })]);
    tick(1);
    expect(service.getCurrentSnapshot().length).toBe(1);

    api.nextError = new Error('boom');
    service.refreshNow();
    tick(10);

    expect(service.getCurrentSnapshot().length).toBe(1);
    discardPeriodicTasks();
  }));

  it('startPolling is idempotent (subsequent calls are no-ops)', fakeAsync(() => {
    service.startPolling(30_000);
    service.startPolling(30_000);
    service.startPolling(60_000);
    // The interval is set from the FIRST startPolling call's argument.
    expect((service as unknown as { pollIntervalMs: number }).pollIntervalMs).toBe(30_000);
    service.stopPolling();
    discardPeriodicTasks();
  }));

  it('stopPolling is idempotent (safe to call twice)', () => {
    service.startPolling(30_000);
    service.stopPolling();
    expect(() => service.stopPolling()).not.toThrow();
  });
});