import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, filter } from 'rxjs';
import { DeviceHealthDto, DeviceStatus } from './door-unlock.types';
import { DevicesApiService } from './devices-api.service';

// Phase 26 (DOOR-13 + DOOR-14):
//
//   1. Singleton service provided in 'root' so the /devices dashboard page
//      and the /gatehouse-panel share one underlying poll cycle (a single
//      HTTP request every 30s even when both pages are mounted).
//   2. State:
//        - snapshots$:   BehaviorSubject<DeviceHealthDto[]>      — latest snapshot
//        - transitions$: Subject<DeviceStatusTransition>        — edge events
//                         (online -> offline fires a toast in the gatehouse panel)
//   3. Methods:
//        - startPolling(intervalMs?)
//        - stopPolling()
//        - refreshNow()
//        - getCurrentSnapshot()
//   4. Lifecycle:
//        - startPolling is idempotent (subsequent calls while already
//          polling are no-ops).
//        - stopPolling is idempotent.
//        - Page destroy hooks are NOT here — the page calls
//          startPolling on mount and stopPolling on destroy. The page
//          is the only caller.
//
// Cross-tenant isolation: the service inherits the tenant scoping from
// the underlying HTTP request (the JWT carries tenantId; the API
// auto-filters by tenant_id at the SQL layer).

export interface DeviceStatusTransition {
  kind: 'offline' | 'online' | 'degraded';
  device: DeviceHealthDto;
  // Number of milliseconds the device has been in the new state.
  elapsedMs: number;
}

@Injectable({ providedIn: 'root' })
export class DeviceHealthService implements OnDestroy {
  private readonly api = inject(DevicesApiService);

  private readonly snapshots$ = new BehaviorSubject<DeviceHealthDto[]>([]);
  private previousSnapshots: DeviceHealthDto[] = [];
  private readonly transitions$ = new Subject<DeviceStatusTransition>();

  private pollIntervalMs = 30_000;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private consecutiveErrors = 0;
  private pausedUntilUtc = 0;
  private lastFetchAtMs: number | null = null;
  private readonly destroy$ = new Subject<void>();

  public readonly health$ = this.snapshots$.asObservable();
  public readonly offlineAlerts$ = this.transitions$.asObservable().pipe(
    filter((t) => t.kind === 'offline')
  );

  startPolling(intervalMs: number = 30_000): void {
    if (this.pollHandle !== null) return; // idempotent — intervalMs from the first call wins
    this.pollIntervalMs = Math.max(1_000, intervalMs);
    // Kick off an immediate fetch + the recurring tick.
    void this.tick();
    this.pollHandle = setInterval(() => void this.tick(), this.pollIntervalMs);
  }

  stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.consecutiveErrors = 0;
    this.pausedUntilUtc = 0;
  }

  refreshNow(): void {
    void this.tick();
  }

  getCurrentSnapshot(): DeviceHealthDto[] {
    return this.snapshots$.value;
  }

  getLastFetchAtMs(): number | null {
    return this.lastFetchAtMs;
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async tick(): Promise<void> {
    // Honor the back-off pause (3 consecutive errors -> 60s pause).
    const now = Date.now();
    if (this.pausedUntilUtc > now) return;

    try {
      const fresh = await new Promise<DeviceHealthDto[]>((resolve, reject) => {
        this.api.getHealth().subscribe({
          next: (list) => resolve(list ?? []),
          error: (err) => reject(err),
        });
      });

      this.consecutiveErrors = 0;
      this.pausedUntilUtc = 0;
      this.lastFetchAtMs = Date.now();

      this.previousSnapshots = this.snapshots$.value;
      this.snapshots$.next(fresh);

      this.detectTransitions(this.previousSnapshots, fresh);
    } catch (_e) {
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors >= 3) {
        // 3 consecutive errors -> pause for 60 seconds.
        this.pausedUntilUtc = Date.now() + 60_000;
        this.consecutiveErrors = 0;
      }
      // Keep the last snapshot in place (no flicker). Page renders the
      // error state via the consecutiveErrors counter exposed via
      // getConsecutiveErrors() (used by the page).
    }
  }

  getConsecutiveErrors(): number {
    return this.consecutiveErrors;
  }

  isPaused(): boolean {
    return this.pausedUntilUtc > Date.now();
  }

  private detectTransitions(previous: DeviceHealthDto[], current: DeviceHealthDto[]): void {
    if (previous.length === 0) {
      // First load — emit an offline alert for any device that arrives in
      // an offline state. This matches the gatehouse-panel contract:
      // "a device that is offline on first sight fires a toast".
      for (const device of current) {
        if (device.status === 'Offline') {
          this.transitions$.next({
            kind: 'offline',
            device,
            elapsedMs: 0,
          });
        }
      }
      return;
    }

    const prevById = new Map<string, DeviceHealthDto>();
    for (const d of previous) prevById.set(d.deviceId, d);

    for (const now of current) {
      const prev = prevById.get(now.deviceId);
      if (!prev) {
        // Newly-registered device — only fire a transition if it landed offline.
        if (now.status === 'Offline') {
          this.transitions$.next({ kind: 'offline', device: now, elapsedMs: 0 });
        }
        continue;
      }

      if (prev.status === now.status) continue;

      if (now.status === 'Offline') {
        const elapsedMs = now.lastHeartbeatAtUtc
          ? Date.now() - new Date(now.lastHeartbeatAtUtc).getTime()
          : 0;
        this.transitions$.next({ kind: 'offline', device: now, elapsedMs });
      } else if (now.status === 'Online') {
        const elapsedMs = now.lastHeartbeatAtUtc
          ? Date.now() - new Date(now.lastHeartbeatAtUtc).getTime()
          : 0;
        this.transitions$.next({ kind: 'online', device: now, elapsedMs });
      } else if (now.status === 'Degraded') {
        this.transitions$.next({ kind: 'degraded', device: now, elapsedMs: 0 });
      }
    }
  }

  // Internal helper used by the gatehouse panel to convert a DeviceStatus
  // into a human-readable label. The DTO already carries StatusLabel, but
  // the panel renders an extra "hasn't checked in for Xm" tail that needs
  // the timestamp separately.
  formatOfflineBody(device: DeviceHealthDto): string {
    const vendor = device.vendor ?? 'Device';
    const gatehouse = device.gatehouseName ?? 'Gatehouse';
    if (!device.lastHeartbeatAtUtc) {
      return `${vendor} at ${gatehouse} hasn't checked in yet. Entries should still be created manually until the device is online.`;
    }
    const last = new Date(device.lastHeartbeatAtUtc).getTime();
    const elapsedMs = Math.max(0, Date.now() - last);
    const mins = Math.floor(elapsedMs / 60_000);
    const elapsed = mins < 1 ? 'a moment' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${vendor} at ${gatehouse} hasn't checked in for ${elapsed}. Entries should still be created manually until the device is online.`;
  }
}