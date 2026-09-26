import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface BootstrapInfoResponse {
  pending: boolean;
  email?: string;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class BootstrapInfoService {
  private readonly http = inject(HttpClient);

  readonly pending = signal(false);
  readonly email = signal<string | null>(null);
  readonly password = signal<string | null>(null);
  readonly loaded = signal(false);

  async load(): Promise<void> {
    try {
      const info = await firstValueFrom(this.http.get<BootstrapInfoResponse>('/api/v1/security/bootstrap'));
      this.pending.set(info.pending);
      this.email.set(info.email ?? null);
      this.password.set(info.password ?? null);
    } catch {
      this.pending.set(false);
      this.email.set(null);
      this.password.set(null);
    } finally {
      this.loaded.set(true);
    }
  }
}

export function bootstrapInfoInitializer(bootstrapInfo: BootstrapInfoService): () => Promise<void> {
  return () => bootstrapInfo.load();
}
