import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'ce.theme';

  readonly theme = signal<Theme>(this.loadStoredTheme());
  readonly resolvedTheme = signal<ResolvedTheme>(this.resolve(this.theme()));

  private prefersDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  constructor() {
    effect(
      () => {
        const resolved = this.resolve(this.theme());
        this.resolvedTheme.set(resolved);
        this.applyToDocument(resolved);
        this.persistTheme(this.theme());
      },
      { allowSignalWrites: true },
    );

    if (this.prefersDark) {
      this.prefersDark.addEventListener('change', () => {
        if (this.theme() === 'system') {
          this.resolvedTheme.set(this.resolve('system'));
          this.applyToDocument(this.resolvedTheme());
        }
      });
    }
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  toggle(): void {
    const order: Theme[] = ['light', 'dark', 'system'];
    const current = this.theme();
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length]!;
    this.setTheme(next);
  }

  private resolve(theme: Theme): ResolvedTheme {
    if (theme !== 'system') return theme;
    return this.prefersDark?.matches ? 'dark' : 'light';
  }

  private applyToDocument(resolved: ResolvedTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }

  private loadStoredTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem(this.storageKey) as Theme | null;
    return stored ?? 'system';
  }

  private persistTheme(theme: Theme): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, theme);
    }
  }
}
