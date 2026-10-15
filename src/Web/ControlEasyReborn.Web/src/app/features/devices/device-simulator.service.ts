import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DevicesApiService } from './devices-api.service';
import {
  EnqueueOfflineResult,
  SimulatedAttempt,
  SimulatedPresentationResult,
  SimulatorDeviceReadiness,
  SimulatorFailureMode,
  SimulatorQueueItem,
  VirtualDoorDirection,
} from './door-unlock.types';

// Phase 27 (DOOR-15) — device simulator inspector facade.
//
// Exposes the existing v2.3 backend inspector surface
// (/api/v1/_internal/devices/{id}/simulator/*) to the UI without
// hand-rolling cURL. Owns the FR-007 inspector gate, the per-device
// state, and the 5-second per-action timeout.
//
// State (signals):
//   inspectorAvailable: null until the first probe completes
//   selectedDeviceId:   null until the page picks a device
//   recordedAttempts:   list returned by GET .../simulator (newest first,
//                       clamped to MAX_ATTEMPTS_DISPLAYED)
//   hasMoreAttempts:    true when the underlying list was truncated to fit
//   pendingAction:      one of SimulatorAction | null
//   lastError:          ProblemDetails text or null
//
// Probe: GET /api/v1/_internal/devices/{syntheticId}/simulator — 2xx
// means the inspector is enabled in this environment; non-2xx means it
// is not. The page reads inspectorAvailable() to decide whether to
// render the section at all (FR-007).
//
// Timeout: every action is wrapped in a 5-second Promise.race so the UI
// can show a "timed out — retry" error without blocking the rest of
// the panel (per spec edge case "What happens when a request takes
// longer than 5 seconds?").
//
// Synthetic id used by the probe: 00000000-0000-0000-0000-000000000001
// (matches the FR-011 invariant and the fallback pattern used by
// DoorIntegrationSectionComponent).

export type SimulatorAction =
  | 'probe'
  | 'load'
  | 'failureMode'
  | 'offline'
  | 'reset'
  | 'enqueue'
  | 'drain'
  | 'readiness'
  | 'present';

const PROBE_DEVICE_ID = '00000000-0000-0000-0000-000000000001';
const MAX_ATTEMPTS_DISPLAYED = 200;
const ACTION_TIMEOUT_MS = 5_000;


@Injectable({ providedIn: 'root' })
export class DeviceSimulatorService {
  private readonly api = inject(DevicesApiService);
  // Direct HttpClient for the enqueue call only — the generated
  // DevicesInternalService.apiV1InternalDevicesDeviceIdSimulatorEnqueueOfflinePost
  // returns Observable<void> because the OpenAPI generator drops the
  // { queued: N } response body. The actual backend returns 200 with
  // { Queued: N }, so we hit the endpoint directly to read the body.
  private readonly http = inject(HttpClient);

  readonly inspectorAvailable: WritableSignal<boolean | null> = signal(null);
  readonly selectedDeviceId: WritableSignal<string | null> = signal(null);
  readonly recordedAttempts: WritableSignal<SimulatedAttempt[]> = signal([]);
  readonly hasMoreAttempts: WritableSignal<boolean> = signal(false);
  readonly pendingAction: WritableSignal<SimulatorAction | null> = signal(null);
  readonly lastError: WritableSignal<string | null> = signal(null);

  async probeInspector(): Promise<void> {
    this.pendingAction.set('probe');
    this.lastError.set(null);
    // A clearable timer keeps the Zone.js test queue empty on the happy
    // path; see runAction() for the full rationale.
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<SimulatedAttempt[]>((_, rejectTimer) => {
      timeoutHandle = setTimeout(
        () => rejectTimer(new Error('Action timed out — retry.')),
        ACTION_TIMEOUT_MS
      );
    });
    try {
      await Promise.race([
        firstValueFrom(this.api.getSimulatorAttempts(PROBE_DEVICE_ID)),
        timeoutPromise,
      ]);
      this.inspectorAvailable.set(true);
    } catch {
      // Non-2xx or timeout means the inspector is not enabled in this
      // environment. The page hides the section (FR-007). We do not
      // surface a user-visible error here — a non-dev stack is the
      // expected steady state for production deployments.
      this.inspectorAvailable.set(false);
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      this.pendingAction.set(null);
    }
  }

  selectDevice(deviceId: string): void {
    this.selectedDeviceId.set(deviceId);
    void this.loadAttempts(deviceId);
  }

  clearAttempts(): void {
    this.recordedAttempts.set([]);
    this.hasMoreAttempts.set(false);
    this.selectedDeviceId.set(null);
    this.lastError.set(null);
  }

  clearError(): void {
    this.lastError.set(null);
  }

  async loadAttempts(deviceId: string): Promise<void> {
    let attempts: SimulatedAttempt[] = [];
    const succeeded = await this.runAction('load', () =>
      firstValueFrom(this.api.getSimulatorAttempts(deviceId)).then((r) => {
        attempts = (r ?? []) as SimulatedAttempt[];
      })
    );
    if (!succeeded) {
      return;
    }
    const sorted = [...attempts].sort((a, b) => {
      const ta = Date.parse(a.occurredAtUtc);
      const tb = Date.parse(b.occurredAtUtc);
      return tb - ta;
    });
    this.hasMoreAttempts.set(sorted.length > MAX_ATTEMPTS_DISPLAYED);
    this.recordedAttempts.set(sorted.slice(0, MAX_ATTEMPTS_DISPLAYED));
  }

  async setFailureMode(deviceId: string, mode: SimulatorFailureMode): Promise<void> {
    // Only refresh recorded attempts when the state-changing op succeeded;
    // otherwise the timeout / ProblemDetails text set by `runAction`
    // (`lastError`) would be clobbered by `loadAttempts`, which clears it
    // on entry. This preserves the "Action timed out — retry." UX.
    if (await this.runAction('failureMode', () =>
      firstValueFrom(this.api.setSimulatorFailureMode(deviceId, mode))
    )) {
      await this.loadAttempts(deviceId);
    }
  }

  async setOfflineUntil(deviceId: string, untilUtc: Date): Promise<void> {
    if (await this.runAction('offline', () =>
      firstValueFrom(this.api.setSimulatorOffline(deviceId, untilUtc))
    )) {
      await this.loadAttempts(deviceId);
    }
  }

  async reset(deviceId: string): Promise<void> {
    if (await this.runAction('reset', () => firstValueFrom(this.api.resetSimulator(deviceId)))) {
      this.recordedAttempts.set([]);
      this.hasMoreAttempts.set(false);
      await this.loadAttempts(deviceId);
    }
  }

  async enqueueOffline(
    deviceId: string,
    count: number,
    fromSequence: number
  ): Promise<EnqueueOfflineResult | null> {
    let result: EnqueueOfflineResult | null = null;
    await this.runAction('enqueue', () =>
      firstValueFrom(
        this.http.post<{ queued?: number; Queued?: number }>(
          `/api/v1/_internal/devices/${deviceId}/simulator/enqueue-offline`,
          { count, fromSequence },
          { responseType: 'json' as const }
        )
      ).then((body) => {
        const queued = body?.queued ?? body?.Queued ?? count;
        result = { queued };
      })
    );
    return result;
  }

  async drainQueue(deviceId: string): Promise<SimulatorQueueItem[]> {
    let items: SimulatorQueueItem[] = [];
    await this.runAction('drain', () =>
      firstValueFrom(this.api.drainSimulatorQueue(deviceId)).then((r) => {
        items = r ?? [];
      })
    );
    return items;
  }

  // Operational-gatehouse-simulator — virtual physical reader execution.
  // Both methods go through runAction so they inherit the 5-second timeout
  // and the ProblemDetails `detail` extraction used by every other
  // inspector action. The endpoint responses are consumed via a direct
  // HttpClient call (the generated DevicesInternalService under-types
  // these bodies, same precedent as enqueue/drain).

  /**
   * Device-readiness probe: can this simulator device present a credential
   * right now? Returns the readiness verdict (ready=false carries the
   * actionable reason) or null when the action failed (lastError set).
   */
  async probeReadiness(deviceId: string): Promise<SimulatorDeviceReadiness | null> {
    let readiness: SimulatorDeviceReadiness | null = null;
    await this.runAction('readiness', () =>
      firstValueFrom(
        this.http.get<SimulatorDeviceReadiness>(
          `/api/v1/_internal/devices/${deviceId}/simulator/readiness`,
          { responseType: 'json' as const }
        )
      ).then((body) => {
        readiness = body;
      })
    );
    return readiness;
  }

  /**
   * Present an issued credential token at the virtual reader. Resolves to
   * the presentation result (outcome, direction, linked ids) or null when
   * the action failed (lastError set).
   */
  async presentCredential(
    deviceId: string,
    token: string,
    direction: VirtualDoorDirection
  ): Promise<SimulatedPresentationResult | null> {
    let result: SimulatedPresentationResult | null = null;
    await this.runAction('present', () =>
      firstValueFrom(
        this.http.post<SimulatedPresentationResult>(
          `/api/v1/_internal/devices/${deviceId}/simulator/present-credential`,
          { token, direction },
          { responseType: 'json' as const }
        )
      ).then((body) => {
        result = body;
      })
    );
    return result;
  }

  private async runAction<T>(action: SimulatorAction, op: () => Promise<T>): Promise<boolean> {
    this.pendingAction.set(action);
    this.lastError.set(null);
    // A clearable timer keeps the Zone.js test queue empty on the happy path:
    // each operation completes long before the 5 s budget elapses, so we
    // cancel the timer when the operation settles. Only the timeout test
    // branch (#OnTimeout) lets the timer fire — that is exactly what it
    // needs to test.
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, rejectTimer) => {
      timeoutHandle = setTimeout(
        () => rejectTimer(new Error('Action timed out — retry.')),
        ACTION_TIMEOUT_MS
      );
    });
    try {
      await Promise.race([op(), timeoutPromise]);
      return true;
    } catch (err) {
      // Three resolution paths:
      //   1. Timeout — the timer fired, surface the exact retry message.
      //   2. HttpErrorResponse with a ProblemDetails `detail` — surface it.
      //   3. Anything else (network failure, plain Error) — generic fallback.
      // This matches FR-009 + the spec edge case "timed out — retry".
      if (err instanceof Error && err.message === 'Action timed out — retry.') {
        this.lastError.set(err.message);
      } else {
        this.lastError.set(this.extractDetail(err) ?? 'Action failed.');
      }
      return false;
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      this.pendingAction.set(null);
    }
  }

  /**
   * Extract the ProblemDetails `detail` field if the error is an
   * HttpErrorResponse with a JSON body that has one. Returns `null`
   * when no `detail` is present so the caller can fall back to a
   * domain-specific message.
   */
  private extractDetail(err: unknown): string | null {
    if (!(err instanceof HttpErrorResponse)) {
      return null;
    }
    const body = err.error;
    if (!body || typeof body !== 'object') {
      return null;
    }
    const detail = (body as { detail?: unknown }).detail;
    return typeof detail === 'string' && detail.trim() ? detail : null;
  }
}