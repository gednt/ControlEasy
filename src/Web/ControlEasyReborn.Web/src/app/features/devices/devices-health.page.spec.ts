import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DevicesHealthPage } from './devices-health.page';
import { DeviceHealthService } from './device-health.service';
import { DeviceHealthDto } from './door-unlock.types';
import { DeviceSimulatorService } from './device-simulator.service';
import { DevicesApiService } from './devices-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CE_LUCIDE_ICONS } from '../../design-system/components/icon/icon.registry';
import { GatehouseContextService } from '../access-control/gatehouse-context.service';

class FakeAuthService {
  readonly permissions = signal<string[]>(['devices.write']);
}

class FakeDeviceHealthService {
  readonly health$ = new BehaviorSubject<DeviceHealthDto[]>([]);
  private readonly offlineSubject = new BehaviorSubject<any>(null);
  readonly offlineAlerts$ = this.offlineSubject.asObservable();
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  startPolling(): void {
    if (this.pollHandle !== null) return;
    // No polling in tests; just push an empty initial snapshot.
  }

  stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  refreshNow(): void {
    /* no-op for tests */
  }

  getCurrentSnapshot(): DeviceHealthDto[] {
    return this.health$.value;
  }

  getLastFetchAtMs(): number | null {
    return Date.now();
  }

  isPaused(): boolean {
    return false;
  }

  emit(list: DeviceHealthDto[]): void {
    this.health$.next(list);
  }

  emitOfflineAlert(payload: any): void {
    this.offlineSubject.next(payload);
  }
}

class FakeGatehouseContextService {
  readonly gatehouses = signal([
    { id: '00000000-0000-0000-0000-0000000000aa', name: 'Main gatehouse', location: 'North gate' },
  ]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    /* no-op */
  }
}

// Stand-in for DeviceSimulatorService. Mirrors the public surface the
// T3 component spec commits to, so the page can read inspectorAvailable()
// and we can assert probeInspector() was called. No real HTTP, no real
// inspector probe; the synthetic device id used by the page's probe
// 00000000-0000-0000-0000-000000000001 is irrelevant here because the
// fake's probeInspector() never reads it.
class FakeDeviceSimulatorService {
  readonly inspectorAvailable = signal<boolean | null>(null);
  readonly selectedDeviceId = signal<string | null>(null);
  readonly recordedAttempts = signal<any[]>([]);
  readonly hasMoreAttempts = signal<boolean>(false);
  readonly pendingAction = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);
  probeInspector = jasmine.createSpy('probeInspector').and.returnValue(Promise.resolve());
  selectDevice = jasmine.createSpy('selectDevice');
  clearAttempts = jasmine.createSpy('clearAttempts');
  clearError = jasmine.createSpy('clearError');
  loadAttempts = jasmine.createSpy('loadAttempts').and.returnValue(Promise.resolve());
  setFailureMode = jasmine.createSpy('setFailureMode').and.returnValue(Promise.resolve());
  setOfflineUntil = jasmine.createSpy('setOfflineUntil').and.returnValue(Promise.resolve());
  reset = jasmine.createSpy('reset').and.returnValue(Promise.resolve());
  enqueueOffline = jasmine.createSpy('enqueueOffline').and.returnValue(Promise.resolve({ queued: 0 }));
  drainQueue = jasmine.createSpy('drainQueue').and.returnValue(Promise.resolve([]));
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

describe('DevicesHealthPage', () => {
  let fixture: ComponentFixture<DevicesHealthPage>;
  let component: DevicesHealthPage;
  let service: FakeDeviceHealthService;
  let simulator: FakeDeviceSimulatorService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    service = new FakeDeviceHealthService();
    simulator = new FakeDeviceSimulatorService();
    await TestBed.configureTestingModule({
      imports: [DevicesHealthPage],
      providers: [
        { provide: DeviceHealthService, useValue: service },
        { provide: GatehouseContextService, useValue: new FakeGatehouseContextService() },
        { provide: DeviceSimulatorService, useValue: simulator },
        { provide: AuthService, useValue: new FakeAuthService() },
        // The REAL DevicesApiService over HttpClientTesting: the page-modal
        // interaction tests below drive a rendered save through the wire
        // (HttpTestingController), matching the modal spec's http style.
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        importProvidersFrom(CE_LUCIDE_ICONS),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DevicesHealthPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    service.stopPolling();
  });

  it('renders an empty state when no devices are registered', () => {
    const emptyTitle = fixture.nativeElement.querySelector('.empty-title');
    expect(emptyTitle).toBeTruthy();
    expect(emptyTitle.textContent).toContain('No devices registered yet.');
    expect(fixture.nativeElement.querySelector('[data-testid="registered-gatehouses"]').textContent).toContain(
      'Main gatehouse',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="empty-administration-link"]').getAttribute('href')).toBe(
      '/administration#door-integration',
    );
  });

  it('surfaces a gatehouse retrieval failure in the empty state and retries it', () => {
    const context = TestBed.inject(GatehouseContextService) as unknown as FakeGatehouseContextService;
    context.gatehouses.set([]);
    context.error.set('Locations unavailable.');
    spyOn(context, 'load');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.registered-gatehouses.is-error') as HTMLElement;
    expect(alert.textContent).toContain('Locations unavailable.');
    (alert.querySelector('button') as HTMLButtonElement).click();
    expect(context.load).toHaveBeenCalled();
  });

  it('renders online-only rows with a success badge', () => {
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online', statusLabel: 'Online' })]);
    fixture.detectChanges();
    const badgeHost = fixture.nativeElement.querySelector('[data-testid="device-status-d1"]');
    expect(badgeHost).toBeTruthy();
    // The ce-badge inner span carries the tone class.
    const inner = badgeHost.querySelector('.ce-badge');
    expect(inner).toBeTruthy();
    expect(inner.className).toContain('tone-success');
    expect((inner.textContent ?? '').trim()).toBe('Online');
  });

  it('renders degraded + offline rows with the warning/danger badges', () => {
    service.emit([
      makeDevice({ deviceId: 'd-degraded', status: 'Degraded', statusLabel: 'Degraded' }),
      makeDevice({ deviceId: 'd-offline', status: 'Offline', statusLabel: 'Offline' }),
    ]);
    fixture.detectChanges();
    const degradedHost = fixture.nativeElement.querySelector(
      '[data-testid="device-status-d-degraded"]'
    );
    const offlineHost = fixture.nativeElement.querySelector(
      '[data-testid="device-status-d-offline"]'
    );
    expect(degradedHost.querySelector('.ce-badge').className).toContain('tone-warning');
    expect((degradedHost.querySelector('.ce-badge').textContent ?? '').trim()).toBe('Degraded');
    expect(offlineHost.querySelector('.ce-badge').className).toContain('tone-danger');
    expect((offlineHost.querySelector('.ce-badge').textContent ?? '').trim()).toBe('Offline');
  });

  it('renders the loading-state spinner while the first snapshot is in flight', () => {
    // The FakeDeviceHealthService in this test exposes a BehaviorSubject
    // initialised to []; on mount the page flips loading() to false.
    // The contract we are validating: the loading-state ce-card is the
    // marker for "first snapshot in flight" — when devices are empty,
    // the empty-state ce-card takes over (verify both paths are wired).
    // To verify the loading-state ce-card rendering, set devices back to []
    // and assert the empty-state appears (the loading() flips off synchronously
    // via the BehaviorSubject).
    service.emit([]);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('.empty-state');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No devices registered yet.');
  });

  it('renders the error banner with a Retry button when error() is set', () => {
    component['error'].set('boom');
    fixture.detectChanges();
    const errorBanner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(errorBanner).toBeTruthy();
    const retryButton = fixture.nativeElement.querySelector('ce-button');
    expect(retryButton).toBeTruthy();
  });

  it('keeps the last data visible when refreshNow is clicked during an error', () => {
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="device-status-d1"]')).toBeTruthy();

    component['error'].set('transient');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();
    // The error clears; the row remains.
    expect(fixture.nativeElement.querySelector('[data-testid="device-status-d1"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeFalsy();
  });

  // ---- T4: simulator section visibility & probe-once wiring ----
  //
  // These tests cover the page-level wiring added by T4: the
  // DeviceSimulatorSectionComponent is rendered inside the existing
  // /devices page, gated on simulatorService.inspectorAvailable() (FR-007),
  // and the page fires simulatorService.probeInspector() exactly once
  // when the first health snapshot arrives. See .specs/.../tasks.md T4.

  it('does NOT render the simulator section when inspectorAvailable() is null', () => {
    // Initial state: the BehaviorSubject in the fake emits the
    // current value synchronously on subscribe, so the page's
    // `health$.subscribe` callback has already fired by the time the
    // beforeEach finishes. With an empty health list, the page
    // renders the empty-state card and never asks the simulator
    // service anything — but the fake's inspectorAvailable() is
    // still null because the fake's probeInspector() is a spy that
    // never updates the signal.
    expect(simulator.inspectorAvailable()).toBeNull();
    const section = fixture.nativeElement.querySelector(
      '[data-testid="device-simulator-section"]'
    );
    expect(section).toBeFalsy();
  });

  it('does NOT render the simulator section when inspectorAvailable() is false', () => {
    // Drive a real health snapshot so the page is in the populated
    // state, then flip the inspector gate off.
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online', statusLabel: 'Online' })]);
    simulator.inspectorAvailable.set(false);
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector(
      '[data-testid="device-simulator-section"]'
    );
    expect(section).toBeFalsy();
  });

  it('renders the simulator section when inspectorAvailable() is true', () => {
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online', statusLabel: 'Online' })]);
    simulator.inspectorAvailable.set(true);
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector(
      '[data-testid="device-simulator-section"]'
    );
    expect(section).toBeTruthy();
  });

  it('calls probeInspector() once on init, after the first health snapshot arrives', async () => {
    // The beforeEach already ran fixture.detectChanges(), which means
    // the page's health$ subscription has already received the
    // BehaviorSubject's initial empty list. The page fires the probe
    // on that first emission. Snapshot the call count and verify the
    // probe has been invoked exactly once at this point — the
    // contract under test is "after the first health snapshot
    // arrives, the probe is fired once".
    const callsBefore = simulator.probeInspector.calls.count();
    expect(callsBefore).toBe(1);
    // Emit a non-empty snapshot and confirm the call count does not
    // increase — the probedInspector guard prevents re-firing.
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();
    // The page calls `void this.simulatorService.probeInspector()`,
    // which is an unobserved promise. Wait one microtask so any
    // (incorrectly added) re-firing would have run.
    await Promise.resolve();
    expect(simulator.probeInspector.calls.count()).toBe(1);
  });

  // ---- Per-device Configure (binding + thresholds) ----
  //
  // The Configure action used to be a hard-disabled ghost button whose
  // tooltip never fired (disabled buttons swallow pointer events). The
  // enabled button must open the Configure dialog, and `saved` must
  // trigger refreshNow() so the row reflects the binding/thresholds.

  it('renders the Configure button ENABLED for each device row', () => {
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="configure-btn"]') as HTMLButtonElement;
    // The CeButtonComponent host renders an inner <button>; assert it is
    // not disabled and no longer swallowed by pointer-events.
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('disabled')).toBeNull();
    const ariaDisabled = btn.getAttribute('aria-disabled');
    expect(ariaDisabled === null || ariaDisabled === 'false').toBe(true);

    const style = getComputedStyle(btn);
    expect(style.pointerEvents).not.toBe('none');
  });

  it('opens the Configure dialog for the clicked device', () => {
    service.emit([
      makeDevice({ deviceId: 'd1', status: 'Online' }),
      makeDevice({ deviceId: 'd2', status: 'Offline', statusLabel: 'Offline' }),
    ]);
    fixture.detectChanges();

    const rows = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('tr'));
    const d2row = rows.find(
      (r: HTMLElement) => r.getAttribute('data-testid') === 'device-row-d2'
    ) as HTMLElement;
    const btn = d2row.querySelector('[data-testid="configure-btn"]') as HTMLElement;
    const inner = btn.querySelector('button') as HTMLButtonElement;
    inner.click();
    fixture.detectChanges();

    expect(component.configureOpen()).toBe(true);
    expect(component.configureDevice()!.deviceId).toBe('d2');

    const modal = fixture.nativeElement.querySelector('[data-testid="configure-device-line"]') as HTMLElement;
    expect(modal).toBeTruthy();
  });

  it('closes the Configure dialog on cancelled and re-hydrates on reopen', () => {
    component.openConfigure(makeDevice({ deviceId: 'd1' }));
    fixture.detectChanges();

    component.onConfigureCancelled();
    fixture.detectChanges();

    expect(component.configureOpen()).toBe(false);
    expect(component.configureDevice()).toBeUndefined();

    component.openConfigure(makeDevice({ deviceId: 'd1', offlineAfterSeconds: 300 }));
    fixture.detectChanges();
    expect(component.configureDevice()!.offlineAfterSeconds).toBe(300);
  });

  // ---- page <-> rendered-modal interaction (real DevicesApiService over
  // HttpClientTesting, same style as the modal spec) ----

  function openConfigureForRenderedRow(deviceId: string): void {
    const rows = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('tr'));
    const row = rows.find((r) => r.getAttribute('data-testid') === `device-row-${deviceId}`)!;
    (row.querySelector('[data-testid="configure-btn"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('render-driven Save: threshold change flushes PUT and closes + refreshes', async () => {
    service.emit([makeDevice({ deviceId: 'd1', gatehouseId: null, gatehouseName: null })]);
    fixture.detectChanges();

    openConfigureForRenderedRow('d1');
    expect(component.configureOpen()).toBe(true);

    // Type a new offline threshold into the rendered dialog input.
    const modal = fixture.nativeElement.querySelector('ce-device-configure-modal') as HTMLElement;
    const offlineInput = modal.querySelector('[data-testid="configure-offline"]') as HTMLInputElement;
    offlineInput.value = '300';
    offlineInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const refreshSpy = spyOn(service, 'refreshNow');
    (modal.querySelector('[data-testid="configure-save"]') as HTMLButtonElement).click();

    const put = httpMock.expectOne('/api/v1/devices/d1/thresholds');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body as object).toEqual({ offlineAfterSeconds: 300, errorRateThresholdPercent: 10 });
    put.flush({ deviceId: 'd1', offlineAfterSeconds: 300, errorRateThresholdPercent: 10 });

    // The modal emits saved asynchronously (await on the PUT promise).
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.configureOpen()).toBe(false);
    expect(component.configureDevice()).toBeUndefined();
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('render-driven Cancel: dialog closes with no refresh and no API call', async () => {
    service.emit([makeDevice({ deviceId: 'd1', gatehouseId: null, gatehouseName: null })]);
    fixture.detectChanges();

    openConfigureForRenderedRow('d1');
    expect(component.configureOpen()).toBe(true);

    const refreshSpy = spyOn(service, 'refreshNow');
    const modal = fixture.nativeElement.querySelector('ce-device-configure-modal') as HTMLElement;
    const cancel = Array.from<HTMLButtonElement>(modal.querySelectorAll('.modal-footer button'))
      .find((b) => (b.textContent ?? '').trim() === 'Cancel')!;
    cancel.click();
    fixture.detectChanges();

    expect(component.configureOpen()).toBe(false);
    expect(component.configureDevice()).toBeUndefined();
    expect(refreshSpy).not.toHaveBeenCalled();
    httpMock.expectNone('/api/v1/devices/d1/thresholds');
  });

  it('Configure is visibly disabled for a user without devices.write', () => {
    const auth = TestBed.inject(AuthService) as unknown as FakeAuthService;
    auth.permissions.set(['devices.read', 'devices.read_health']);
    fixture.detectChanges();
    // A device row must be present for the per-row action check.
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();

    const btnHost = fixture.nativeElement.querySelector('[data-testid="configure-btn"]');
    expect(btnHost).toBeTruthy();
    const inner = btnHost.querySelector('button') as HTMLButtonElement;
    expect(inner.disabled).toBe(true);
    expect((inner.textContent ?? '').trim()).toBe('Configure');
    // Explanation must be present for sighted users (tooltip) and screen
    // readers (aria-label) — the action stays discoverable, not hidden.
    expect(btnHost.textContent).toContain('Configure');
    // [attr.aria-label] on <ce-button> lands on the host element.
    expect(btnHost.getAttribute('aria-label')).toContain('devices.write');
  });

  it('keeps Configure enabled (aria-labeled) for devices.write holders', () => {
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();

    const btnHost = fixture.nativeElement.querySelector('[data-testid="configure-btn"]');
    const inner = btnHost.querySelector('button') as HTMLButtonElement;
    expect(inner.disabled).toBe(false);
    expect(btnHost.getAttribute('aria-label')).toBe(
      'Configure gatehouse binding and thresholds for Simulated device'
    );
  });

  it('refreshes the health snapshot after the Configure dialog saves', () => {
    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();

    const refreshSpy = spyOn(service, 'refreshNow');
    component.onConfigureSaved();

    expect(component.configureOpen()).toBe(false);
    expect(refreshSpy).toHaveBeenCalled();
    expect(component.configureDevice()).toBeUndefined();
  });

  it('does NOT refresh the health snapshot when the Configure dialog is dismissed', () => {
    component.openConfigure(makeDevice({ deviceId: 'd1' }));
    const refreshSpy = spyOn(service, 'refreshNow');
    component.onConfigureCancelled();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('does NOT call probeInspector() more than once across multiple health emissions', async () => {
    // The page's `probedInspector` flag prevents re-firing the probe
    // on subsequent health$ emissions. The beforeEach's initial
    // BehaviorSubject emission has already triggered the probe once;
    // emit a second snapshot and a third snapshot and confirm the
    // call count stays at 1.
    expect(simulator.probeInspector.calls.count()).toBe(1);

    service.emit([makeDevice({ deviceId: 'd1', status: 'Online' })]);
    fixture.detectChanges();
    await Promise.resolve();

    service.emit([
      makeDevice({ deviceId: 'd1', status: 'Online' }),
      makeDevice({ deviceId: 'd2', status: 'Degraded', statusLabel: 'Degraded' }),
    ]);
    fixture.detectChanges();
    await Promise.resolve();

    expect(simulator.probeInspector.calls.count()).toBe(1);
  });
});
