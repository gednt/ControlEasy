import { TestBed, fakeAsync, tick, discardPeriodicTasks, flushMicrotasks } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { DeviceSimulatorService } from './device-simulator.service';
import { DevicesApiService } from './devices-api.service';
import {
  EnqueueOfflineResult,
  SimulatedAttempt,
  SimulatorFailureMode,
  SimulatorQueueItem,
} from './door-unlock.types';

// Synthetic device id used by the probe and by tests (per FR-011).
const SYNTHETIC_DEVICE_ID = '00000000-0000-0000-0000-000000000001';

// Fake for DevicesApiService. Mirrors the style of FakeDevicesApiService
// in device-health.service.spec.ts — exposes one-shot setters
// (nextAttemptsResponse / nextAttemptsError / nextQueueResponse /
// nextQueueError) for the happy and error paths and never-emitting
// Subjects via the overloads setFake*PendingObservables() for the
// timeout branch. Tracks every call site so lifecycle assertions
// (setFailureMode ran, lastOffline, enqueueCalls list) are observable.
class FakeDevicesApiService {
  public nextAttemptsResponse: SimulatedAttempt[] = [];
  public nextAttemptsError: unknown = null;
  public nextQueueResponse: SimulatorQueueItem[] = [];
  public nextQueueError: unknown = null;
  public failureModeCalls = 0;
  public offlineCalls = 0;
  public resetCalls = 0;
  public enqueueCalls: Array<{ deviceId: string; count: number; fromSequence: number }> = [];
  public lastFailureMode: { deviceId: string; mode: SimulatorFailureMode } | null = null;
  public lastOffline: { deviceId: string; untilUtc: Date } | null = null;

  // Override hooks — when set, getSimulatorAttempts /
  // setSimulatorFailureMode / drainSimulatorQueue return this
  // observable instead of the one-shot default path. Used by the
  // timeout tests to install a never-emitting subject.
  public attemptsObservableOverride: Observable<SimulatedAttempt[]> | null = null;
  public failureModeObservableOverride: Observable<void> | null = null;
  public queueObservableOverride: Observable<SimulatorQueueItem[]> | null = null;

  getSimulatorAttempts(): Observable<SimulatedAttempt[]> {
    if (this.attemptsObservableOverride) return this.attemptsObservableOverride;
    if (this.nextAttemptsError !== null) {
      const err = this.nextAttemptsError;
      this.nextAttemptsError = null;
      return throwError(() => err);
    }
    const r = this.nextAttemptsResponse;
    this.nextAttemptsResponse = [];
    return of(r);
  }

  setSimulatorFailureMode(deviceId: string, mode: SimulatorFailureMode): Observable<void> {
    this.failureModeCalls += 1;
    this.lastFailureMode = { deviceId, mode };
    if (this.failureModeObservableOverride) return this.failureModeObservableOverride;
    return of(undefined);
  }

  setSimulatorOffline(deviceId: string, untilUtc: Date): Observable<void> {
    this.offlineCalls += 1;
    this.lastOffline = { deviceId, untilUtc };
    return of(undefined);
  }

  resetSimulator(): Observable<void> {
    this.resetCalls += 1;
    return of(undefined);
  }

  enqueueSimulatorOfflineEvents(
    deviceId: string,
    count: number,
    fromSequence: number
  ): Observable<EnqueueOfflineResult> {
    this.enqueueCalls.push({ deviceId, count, fromSequence });
    return of({ queued: count });
  }

  drainSimulatorQueue(): Observable<SimulatorQueueItem[]> {
    if (this.queueObservableOverride) return this.queueObservableOverride;
    if (this.nextQueueError !== null) {
      const err = this.nextQueueError;
      this.nextQueueError = null;
      return throwError(() => err);
    }
    const r = this.nextQueueResponse;
    this.nextQueueResponse = [];
    return of(r);
  }
}

function makeAttempt(overrides: Partial<SimulatedAttempt> = {}, index = 0): SimulatedAttempt {
  return {
    tenantId: 'tenant-synthetic',
    deviceId: SYNTHETIC_DEVICE_ID,
    actorProfileId: 'actor-synthetic',
    nonce: 'nonce-synthetic',
    timestampUtc: '2026-10-12T00:00:00.000Z',
    outcome: 'Success',
    correlationId: `corr-synthetic-${index}`,
    occurredAtUtc: '2026-10-12T00:00:00.000Z',
    ...overrides,
  };
}

function buildAttempts(count: number): SimulatedAttempt[] {
  // Spread the items across distinct occurredAtUtc timestamps so the
  // newest-first sort in the service has something to do.
  const base = Date.UTC(2026, 9, 12, 0, 0, 0); // 2026-10-12T00:00:00Z
  const items: SimulatedAttempt[] = [];
  for (let i = 0; i < count; i++) {
    const ts = new Date(base + i * 1000).toISOString();
    items.push(
      makeAttempt(
        {
          correlationId: `corr-${i.toString().padStart(4, '0')}`,
          occurredAtUtc: ts,
          timestampUtc: ts,
        },
        i
      )
    );
  }
  return items;
}

function makeQueueItem(overrides: Partial<SimulatorQueueItem> = {}, index = 0): SimulatorQueueItem {
  return {
    eventType: 'card_read',
    occurredAtUtc: '2026-10-12T00:00:00.000Z',
    sequenceNumber: index,
    externalEventId: `ext-${index}`,
    opaqueToken: null,
    payloadJson: null,
    ...overrides,
  };
}

describe('DeviceSimulatorService', () => {
  let service: DeviceSimulatorService;
  let api: FakeDevicesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    api = new FakeDevicesApiService();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DeviceSimulatorService,
        { provide: DevicesApiService, useValue: api },
      ],
    });
    service = TestBed.inject(DeviceSimulatorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('InitialState: signals are in their empty/default state', () => {
    expect(service.inspectorAvailable()).toBeNull();
    expect(service.recordedAttempts()).toEqual([]);
    expect(service.selectedDeviceId()).toBeNull();
    expect(service.pendingAction()).toBeNull();
    expect(service.lastError()).toBeNull();
    expect(service.hasMoreAttempts()).toBe(false);
  });

  it('ProbeInspector_On2xx: probe sets inspectorAvailable to true', fakeAsync(() => {
    api.nextAttemptsResponse = [];
    const p = service.probeInspector();
    tick(1);
    void p;
    discardPeriodicTasks();
    expect(service.inspectorAvailable()).toBe(true);
    expect(service.lastError()).toBeNull();
  }));

  it('ProbeInspector_On404: probe sets inspectorAvailable to false', fakeAsync(() => {
    api.nextAttemptsError = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    const p = service.probeInspector();
    tick(1);
    void p;
    discardPeriodicTasks();
    expect(service.inspectorAvailable()).toBe(false);
    expect(service.lastError()).toBeNull();
  }));

  it('ProbeInspector_OnTimeout: probe sets inspectorAvailable to false after 5s', fakeAsync(() => {
    // Install a never-emitting observable so the timeout wins the race.
    api.attemptsObservableOverride = new Subject<SimulatedAttempt[]>().asObservable();
    const p = service.probeInspector();
    tick(5_000 + 1);
    void p;
    expect(service.inspectorAvailable()).toBe(false);
    discardPeriodicTasks();
  }));

  it('ProbeInspector_OnGenericError: probe sets inspectorAvailable to false on a non-HttpError throw', fakeAsync(() => {
    api.nextAttemptsError = new Error('network down');
    const p = service.probeInspector();
    tick(1);
    void p;
    discardPeriodicTasks();
    expect(service.inspectorAvailable()).toBe(false);
  }));

  it('LoadAttempts_Clamps200NewestFirst: 250 items clamp to 200, newest first, hasMoreAttempts true', fakeAsync(() => {
    api.nextAttemptsResponse = buildAttempts(250);
    const p = service.loadAttempts(SYNTHETIC_DEVICE_ID);
    tick(1);
    void p;
    discardPeriodicTasks();

    const recorded = service.recordedAttempts();
    expect(recorded.length).toBe(200);
    expect(service.hasMoreAttempts()).toBe(true);
    // Newest first: correlation 'corr-0249' should be the first entry
    // (it has the largest occurredAtUtc).
    expect(recorded[0]?.correlationId).toBe('corr-0249');
    expect(recorded[199]?.correlationId).toBe('corr-0050');
  }));

  it('LoadAttempts_UnderCap: 50 items are returned in full with hasMoreAttempts false', fakeAsync(() => {
    api.nextAttemptsResponse = buildAttempts(50);
    const p = service.loadAttempts(SYNTHETIC_DEVICE_ID);
    tick(1);
    void p;
    discardPeriodicTasks();

    expect(service.recordedAttempts().length).toBe(50);
    expect(service.hasMoreAttempts()).toBe(false);
  }));

  it('LoadAttempts_OnHttpError: sets lastError to the ProblemDetails detail text', fakeAsync(() => {
    api.nextAttemptsError = new HttpErrorResponse({
      status: 401,
      statusText: 'Unauthorized',
      error: { detail: 'Could not resolve tenant for simulator controls.' },
    });
    const p = service.loadAttempts(SYNTHETIC_DEVICE_ID);
    tick(1);
    void p;
    discardPeriodicTasks();

    expect(service.lastError()).toBe('Could not resolve tenant for simulator controls.');
    expect(service.recordedAttempts()).toEqual([]);
  }));

  it('LoadAttempts_OnError_FallsBackToActionFailed: when ProblemDetails has no detail, lastError is "Action failed."', fakeAsync(() => {
    api.nextAttemptsError = new HttpErrorResponse({
      status: 500,
      statusText: 'Server Error',
      error: { title: 'Server Error' },
    });
    const p = service.loadAttempts(SYNTHETIC_DEVICE_ID);
    tick(1);
    void p;
    discardPeriodicTasks();

    expect(service.lastError()).toBe('Action failed.');
  }));

  it('SetFailureMode_Lifecycle: pendingAction flips through "failureMode" and back to null, loadAttempts re-runs after', fakeAsync(() => {
    api.nextAttemptsResponse = buildAttempts(3);
    const p = service.setFailureMode(SYNTHETIC_DEVICE_ID, 1 as SimulatorFailureMode);
    tick(1);
    flushMicrotasks();
    void p;
    discardPeriodicTasks();

    expect(api.failureModeCalls).toBe(1);
    expect(api.lastFailureMode).toEqual({
      deviceId: SYNTHETIC_DEVICE_ID,
      mode: 1 as SimulatorFailureMode,
    });
    expect(service.pendingAction()).toBeNull();
    expect(service.recordedAttempts().length).toBe(3);
  }));

  it('SetFailureMode_OnError: sets lastError to "Action failed." when the POST throws a non-HttpError', fakeAsync(() => {
    api.nextAttemptsError = new Error('boom');
    const p = service.setFailureMode(SYNTHETIC_DEVICE_ID, 1 as SimulatorFailureMode);
    tick(1);
    flushMicrotasks();
    void p;
    discardPeriodicTasks();

    expect(service.lastError()).toBe('Action failed.');
    expect(service.pendingAction()).toBeNull();
  }));

  it('SetFailureMode_OnTimeout: timeout path sets lastError to "Action timed out — retry." and clears pendingAction', fakeAsync(() => {
    api.failureModeObservableOverride = NEVER;
    const p = service.setFailureMode(SYNTHETIC_DEVICE_ID, 1 as SimulatorFailureMode);
    tick(5_000 + 1);
    flushMicrotasks();
    void p;
    expect(service.lastError()).toBe('Action timed out — retry.');
    expect(service.pendingAction()).toBeNull();
    discardPeriodicTasks();
  }));

  it('Reset_ClearsAttemptsAndReloads: reset POSTs once, clears recordedAttempts, then re-runs loadAttempts', fakeAsync(() => {
    // Pre-populate state so we can verify the clear.
    service.recordedAttempts.set(buildAttempts(5));
    service.hasMoreAttempts.set(true);

    api.nextAttemptsResponse = [];
    const p = service.reset(SYNTHETIC_DEVICE_ID);
    tick(1);
    flushMicrotasks();
    void p;
    discardPeriodicTasks();

    expect(api.resetCalls).toBe(1);
    expect(service.recordedAttempts()).toEqual([]);
    expect(service.hasMoreAttempts()).toBe(false);
  }));

  it('EnqueueOffline_ReturnsQueuedResult: returns the { queued: N } body to the caller', async () => {
    const p = service.enqueueOffline(SYNTHETIC_DEVICE_ID, 5, 100);
    const req = httpMock.expectOne(
      (r) =>
        r.method === 'POST' &&
        r.url === `/api/v1/_internal/devices/${SYNTHETIC_DEVICE_ID}/simulator/enqueue-offline`
    );
    expect(req.request.body).toEqual({ count: 5, fromSequence: 100 });
    req.flush({ queued: 5 });
    const result = await p;
    expect(result).toEqual({ queued: 5 });
  });

  it('EnqueueOffline_OnError: sets lastError and returns null', async () => {
    const p = service.enqueueOffline(SYNTHETIC_DEVICE_ID, 3, 0);
    const req = httpMock.expectOne(
      (r) => r.url === `/api/v1/_internal/devices/${SYNTHETIC_DEVICE_ID}/simulator/enqueue-offline`
    );
    req.flush({ detail: 'Enqueue refused.' }, { status: 400, statusText: 'Bad Request' });
    const result = await p;
    expect(result).toBeNull();
    expect(service.lastError()).toBe('Enqueue refused.');
  });

  it('DrainQueue_ReturnsItems: returns the drained items to the caller', async () => {
    api.nextQueueResponse = [
      makeQueueItem({}, 1),
      makeQueueItem({ externalEventId: 'ext-2' }, 2),
    ];
    const items = await service.drainQueue(SYNTHETIC_DEVICE_ID);
    expect(items.length).toBe(2);
    expect(items[0]?.externalEventId).toBe('ext-1');
    expect(items[1]?.externalEventId).toBe('ext-2');
  });

  it('SelectDevice_SetsSelectedAndLoads: selectDevice stores the id and calls loadAttempts', fakeAsync(() => {
    api.nextAttemptsResponse = [];
    service.selectDevice(SYNTHETIC_DEVICE_ID);
    tick(1);
    expect(service.selectedDeviceId()).toBe(SYNTHETIC_DEVICE_ID);
    expect(service.recordedAttempts()).toEqual([]);
    discardPeriodicTasks();
  }));

  it('ClearAttempts_ResetsState: clears attempts, hasMoreAttempts, selectedDeviceId, lastError', () => {
    service.recordedAttempts.set(buildAttempts(3));
    service.hasMoreAttempts.set(true);
    service.selectedDeviceId.set(SYNTHETIC_DEVICE_ID);
    service.lastError.set('something');

    service.clearAttempts();

    expect(service.recordedAttempts()).toEqual([]);
    expect(service.hasMoreAttempts()).toBe(false);
    expect(service.selectedDeviceId()).toBeNull();
    expect(service.lastError()).toBeNull();
  });

  it('ClearError_NullsLastError: clearError clears lastError', fakeAsync(() => {
    api.nextAttemptsError = new HttpErrorResponse({
      status: 500,
      error: { detail: 'boom' },
    });
    const p = service.loadAttempts(SYNTHETIC_DEVICE_ID);
    tick(1);
    void p;
    discardPeriodicTasks();
    expect(service.lastError()).toBe('boom');
    service.clearError();
    expect(service.lastError()).toBeNull();
  }));

  it('SetOfflineUntil_Lifecycle: posts the offline POST and refreshes attempts', fakeAsync(() => {
    const until = new Date('2026-10-12T01:00:00.000Z');
    api.nextAttemptsResponse = [];
    const p = service.setOfflineUntil(SYNTHETIC_DEVICE_ID, until);
    tick(1);
    void p;
    discardPeriodicTasks();
    expect(api.offlineCalls).toBe(1);
    expect(api.lastOffline).toEqual({ deviceId: SYNTHETIC_DEVICE_ID, untilUtc: until });
    expect(service.pendingAction()).toBeNull();
  }));
});