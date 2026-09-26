import { Component, input, ChangeDetectionStrategy, inject, signal, DestroyRef } from '@angular/core';
import { NgClass } from '@angular/common';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  duration: number;
}

@Component({
  selector: 'ce-toast-host',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-toast-host" role="region" aria-live="polite" aria-label="Notifications">
      @for (toast of toasts(); track toast.id) {
        <div class="ce-toast" [class]="'tone-' + toast.tone" role="status">
          <span class="ce-toast-icon">{{ iconForTone(toast.tone) }}</span>
          <span class="ce-toast-message">{{ toast.message }}</span>
          <button class="ce-toast-close" type="button" aria-label="Dismiss" (click)="dismiss(toast.id)">&times;</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ce-toast-host {
        position: fixed;
        bottom: var(--space-6);
        right: var(--space-6);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        max-width: 24rem;
      }
      @media (max-width: 639px) {
        .ce-toast-host {
          left: var(--space-4);
          right: var(--space-4);
          bottom: var(--space-4);
          max-width: none;
        }
      }
      .ce-toast {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        animation: toast-in var(--duration-base) var(--ease-out);
        font-size: var(--font-size-sm);
        min-width: 16rem;
      }
      .ce-toast.tone-success {
        background: var(--color-success-light);
        color: var(--color-success);
      }
      .ce-toast.tone-info {
        background: var(--color-info-light);
        color: var(--color-info);
      }
      .ce-toast.tone-warning {
        background: var(--color-warning-light);
        color: var(--color-warning);
      }
      .ce-toast.tone-error {
        background: var(--color-danger-light);
        color: var(--color-danger);
      }
      .ce-toast-icon {
        font-size: 1rem;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .ce-toast-message {
        flex: 1;
        line-height: var(--line-height-normal);
      }
      .ce-toast-close {
        background: transparent;
        border: 0;
        color: inherit;
        cursor: pointer;
        font-size: 1rem;
        padding: 0;
        line-height: 1;
        opacity: 0.7;
      }
      .ce-toast-close:hover {
        opacity: 1;
      }
      @media (prefers-reduced-motion: reduce) {
        .ce-toast {
          animation: none;
        }
      }
    `,
  ],
})
export class CeToastHostComponent {
  toasts = signal<Toast[]>([]);

  private static nextId = 0;

  add(toast: Omit<Toast, 'id'>): number {
    const id = CeToastHostComponent.nextId++;
    this.toasts.update((t) => [...t, { ...toast, id }]);
    if (toast.duration > 0) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }
    return id;
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((toast) => toast.id !== id));
  }

  iconForTone(tone: string): string {
    switch (tone) {
      case 'success':
        return '\u2713';
      case 'error':
        return '\u2717';
      case 'warning':
        return '\u26A0';
      case 'info':
        return '\u2139';
      default:
        return '\u2139';
    }
  }
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private host: CeToastHostComponent | null = null;

  registerHost(host: CeToastHostComponent): void {
    this.host = host;
  }

  success(message: string, opts?: { duration?: number }): number {
    return this.host?.add({ message, tone: 'success', duration: opts?.duration ?? 5000 }) ?? 0;
  }

  info(message: string, opts?: { duration?: number }): number {
    return this.host?.add({ message, tone: 'info', duration: opts?.duration ?? 5000 }) ?? 0;
  }

  warning(message: string, opts?: { duration?: number }): number {
    return this.host?.add({ message, tone: 'warning', duration: opts?.duration ?? 7000 }) ?? 0;
  }

  error(message: string, opts?: { duration?: number }): number {
    return this.host?.add({ message, tone: 'error', duration: opts?.duration ?? 8000 }) ?? 0;
  }

  dismiss(id: number): void {
    this.host?.dismiss(id);
  }
}
