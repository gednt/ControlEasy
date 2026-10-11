import { computed, inject, Injectable, signal } from '@angular/core';
import { SecurityService } from '../../api/services/security.service';
import { AuthService } from '../../core/services/auth.service';

export interface GatehouseOption {
  id: string;
  name: string;
  location: string | null;
}

const STORAGE_PREFIX = 'ce.active_gatehouse.';

@Injectable({ providedIn: 'root' })
export class GatehouseContextService {
  private readonly securityApi = inject(SecurityService);
  private readonly auth = inject(AuthService);
  private readonly sessionKey = computed(() => `${this.auth.tenantId() ?? ''}:${this.auth.profileId() ?? ''}`);

  readonly gatehouses = signal<GatehouseOption[]>([]);
  readonly selectedGatehouseId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedGatehouse = computed(
    () => this.gatehouses().find((gatehouse) => gatehouse.id === this.selectedGatehouseId()) ?? null,
  );
  readonly canRecord = computed(
    () =>
      this.activeSessionKey() === this.sessionKey() &&
      this.selectedGatehouse() !== null &&
      !this.loading() &&
      !this.error(),
  );

  private readonly activeSessionKey = signal<string | null>(null);

  load(): void {
    const sessionKey = this.sessionKey();
    this.ensureCurrentSession(sessionKey);
    if (!sessionKey || sessionKey === ':' || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    this.securityApi.apiV1SecurityGatehousesGet().subscribe({
      next: (response) => {
        if (this.sessionKey() !== sessionKey) return;
        const gatehouses = response.flatMap(({ id, name, location, active }) =>
          id && name && active !== false ? [{ id, name, location: location ?? null }] : [],
        );
        this.gatehouses.set(gatehouses);
        this.restoreSelection(sessionKey, gatehouses);
        this.loading.set(false);
      },
      error: () => {
        if (this.sessionKey() !== sessionKey) return;
        this.gatehouses.set([]);
        this.selectedGatehouseId.set(null);
        this.error.set('Gatehouse locations could not be loaded. Select a location after retrying.');
        this.loading.set(false);
      },
    });
  }

  select(gatehouseId: string | null): void {
    this.ensureCurrentSession(this.sessionKey());
    const gatehouse = this.gatehouses().find((item) => item.id === gatehouseId) ?? null;
    this.selectedGatehouseId.set(gatehouse?.id ?? null);
    this.persistSelection(this.sessionKey(), gatehouse?.id ?? null);
  }

  private restoreSelection(sessionKey: string, gatehouses: GatehouseOption[]): void {
    const savedId = this.readSelection(sessionKey);
    if (savedId && gatehouses.some((gatehouse) => gatehouse.id === savedId)) {
      this.selectedGatehouseId.set(savedId);
      return;
    }

    this.selectedGatehouseId.set(null);
    this.persistSelection(sessionKey, null);
  }

  private ensureCurrentSession(sessionKey: string): void {
    if (this.activeSessionKey() === sessionKey) return;
    const previousSessionKey = this.activeSessionKey();
    if (previousSessionKey) {
      this.persistSelection(previousSessionKey, null);
    }
    this.activeSessionKey.set(sessionKey);
    this.loading.set(false);
    this.gatehouses.set([]);
    this.selectedGatehouseId.set(null);
    this.error.set(null);
  }

  private readSelection(sessionKey: string): string | null {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${sessionKey}`);
    } catch {
      return null;
    }
  }

  private persistSelection(sessionKey: string, gatehouseId: string | null): void {
    if (!sessionKey || sessionKey === ':') return;
    try {
      const key = `${STORAGE_PREFIX}${sessionKey}`;
      if (gatehouseId) {
        localStorage.setItem(key, gatehouseId);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // The in-memory context remains usable when browser storage is unavailable.
    }
  }
}
