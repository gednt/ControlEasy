import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BootstrapInfoService } from '../../core/services/bootstrap-info.service';
import { CeButtonComponent, CeInputComponent } from '../../design-system';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'ce-change-password-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CeButtonComponent, CeInputComponent],
  template: `
    <main class="login-page" tabindex="-1">
      <div class="login-card">
        <div class="login-brand">
          <div class="login-brand-mark">CE</div>
          <div class="login-brand-text">ControlEasy</div>
        </div>
        <h1 class="login-title">Change your password</h1>
        <p class="login-subtitle">Your account requires a new password before you can continue.</p>

        @if (error()) {
          <div class="login-error" role="alert" aria-live="assertive">
            <span>{{ error() }}</span>
          </div>
        }

        <form class="login-form" [formGroup]="form" (ngSubmit)="onSubmit()">
          <ce-input
            label="Current password"
            inputId="current-password"
            type="password"
            autocomplete="current-password"
            formControlName="currentPassword"
          />

          <ce-input
            label="New password"
            inputId="new-password"
            type="password"
            autocomplete="new-password"
            formControlName="newPassword"
            [error]="
              form.get('newPassword')?.invalid && form.get('newPassword')?.touched ? 'Use at least 8 characters.' : null
            "
          />

          <ce-input
            label="Confirm new password"
            inputId="confirm-password"
            type="password"
            autocomplete="new-password"
            formControlName="confirmPassword"
            [error]="
              form.hasError('passwordMismatch') && form.get('confirmPassword')?.touched
                ? 'Passwords do not match.'
                : null
            "
          />

          <ce-button
            variant="primary"
            size="lg"
            type="submit"
            [disabled]="form.invalid || submitting()"
            [loading]="submitting()"
          >
            @if (submitting()) {
              Updating...
            } @else {
              Update password
            }
          </ce-button>
        </form>
      </div>
    </main>
  `,
  styles: [
    `
      .login-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--color-background);
        padding: var(--space-4);
      }
      .login-card {
        width: 100%;
        max-width: 28rem;
        background: var(--color-surface-elevated);
        border-radius: var(--radius-xl);
        padding: var(--space-8);
        box-shadow: var(--shadow-xl);
        border: 1px solid var(--color-border);
      }
      .login-brand {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-6);
      }
      .login-brand-mark {
        width: 3rem;
        height: 3rem;
        background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
        color: var(--color-text-on-primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-lg);
        font-weight: var(--font-weight-bold);
        font-size: 1.5rem;
      }
      .login-brand-text {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
      }
      .login-title {
        font-size: var(--font-size-2xl);
        margin-bottom: var(--space-1);
      }
      .login-subtitle {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-bottom: var(--space-6);
      }
      .login-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .login-error {
        padding: var(--space-3);
        background: var(--color-danger-light);
        border: 1px solid color-mix(in oklch, var(--color-danger) 30%, transparent);
        border-radius: var(--radius-md);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
        margin-bottom: var(--space-4);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly bootstrapInfo = inject(BootstrapInfoService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  ngOnInit(): void {
    void this.prefillCurrentPassword();
  }

  private async prefillCurrentPassword(): Promise<void> {
    let current = this.authService.getPendingCurrentPassword();
    if (!current) {
      await this.bootstrapInfo.load();
      current = this.bootstrapInfo.password();
    }
    if (current) {
      this.form.patchValue({ currentPassword: current });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.error.set(null);
    this.submitting.set(true);

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.authService.changePassword(currentPassword!, newPassword!).subscribe({
      next: () => {
        this.submitting.set(false);
        this.authService.loadSession();
        this.router.navigate([this.authService.postLoginRoute()]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(this.extractErrorMessage(err));
      },
    });
  }

  private extractErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const httpErr = err as { error?: { detail?: string; title?: string } };
      if (httpErr.error?.detail) return httpErr.error.detail;
      if (httpErr.error?.title) return httpErr.error.title;
    }
    return 'Unable to update password. Please try again.';
  }
}
