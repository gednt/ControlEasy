import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import type { TenantLookupResponse } from '../../core/services/auth.service';
import { DemoInfoService } from '../../core/services/demo-info.service';
import { BootstrapInfoService } from '../../core/services/bootstrap-info.service';
import {
  CeButtonComponent,
  CeSpinnerComponent,
  CeInputComponent,
  CeCheckboxComponent,
  CeIconComponent,
  ThemeService,
  ToastService,
} from '../../design-system';

const DEMO_ACCOUNTS = [
  { label: 'Platform Admin', email: 'platform@controleasy.app' },
  { label: 'Administrador', email: 'admin@controleasy.app' },
  { label: 'Porteiro', email: 'porteiro@controleasy.app' },
  { label: 'Morador', email: 'morador@controleasy.app' },
  { label: 'Multi-condomínio', email: 'multi@controleasy.app' },
] as const;

@Component({
  selector: 'ce-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CeButtonComponent,
    CeSpinnerComponent,
    CeInputComponent,
    CeCheckboxComponent,
    CeIconComponent,
  ],
  template: `
    <button class="login-theme-toggle icon-btn" type="button" aria-label="Toggle theme" (click)="themeService.toggle()">
      @if (themeService.resolvedTheme() === 'dark') {
        <ce-icon name="moon" [size]="20" />
      } @else {
        <ce-icon name="sun" [size]="20" />
      }
    </button>

    <main class="login-page" tabindex="-1">
      <div class="login-card">
        <div class="login-brand">
          <div class="login-brand-mark">CE</div>
          <div class="login-brand-text">ControlEasy</div>
        </div>
        <h1 class="login-title">Sign in to ControlEasy</h1>
        <p class="login-subtitle">Use your email and password to access the platform.</p>

        @if (loginError()) {
          <div class="login-error" role="alert" aria-live="assertive">
            <ce-icon name="alert-circle" [size]="18" />
            <span>{{ loginError() }}</span>
          </div>
        }

        @if (tenantPickerVisible()) {
          <div class="tenant-picker-section">
            <p class="tenant-picker-label">Select a condominium to continue:</p>
            <div class="tenant-picker-grid">
              @for (tenant of tenants(); track tenant.tenantId) {
                <button class="tenant-card" type="button" (click)="selectTenant(tenant)">
                  <div class="tenant-card-name">{{ tenant.displayName }}</div>
                  <div class="tenant-card-slug">{{ tenant.slug }}</div>
                </button>
              }
            </div>
            <ce-button
              variant="ghost"
              size="sm"
              type="button"
              (click)="backToLogin()"
              style="margin-top: var(--space-3);"
            >
              <span class="back-icon"><ce-icon name="chevron-right" [size]="16" /></span>
              Use a different account
            </ce-button>
          </div>
        } @else {
          <form class="login-form" [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <ce-input
              label="Email"
              inputId="login-email"
              type="email"
              autocomplete="email"
              placeholder="you@controleasy.app"
              formControlName="email"
              [error]="emailError()"
            >
              <span input-prefix><ce-icon name="user" [size]="16" /></span>
            </ce-input>

            <ce-input
              label="Password"
              inputId="login-password"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              formControlName="password"
              [error]="passwordError()"
            >
              <button
                input-suffix
                type="button"
                class="password-toggle"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                tabindex="-1"
              >
                <ce-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="16" />
              </button>
            </ce-input>

            <div class="login-options-row">
              <ce-checkbox
                label="Remember my email"
                [checked]="loginForm.get('remember')?.value ?? false"
                (checkedChange)="loginForm.patchValue({ remember: $event })"
              />
              <button type="button" class="forgot-password-link" (click)="openForgotPassword()">
                Forgot password?
              </button>
            </div>

            <ce-button
              variant="primary"
              size="lg"
              type="submit"
              [disabled]="loginForm.invalid || submitting()"
              [loading]="submitting()"
              style="margin-top: var(--space-2);"
            >
              Sign in
            </ce-button>
          </form>

          @if (tenantHint()) {
            <div class="tenant-hint" style="margin-top: var(--space-3);">
              <span class="text-secondary text-xs">{{ tenantHint() }}</span>
            </div>
          }

          @if (bootstrapInfo.pending()) {
            <details class="bootstrap-shortcuts" open>
              <summary>First boot — Platform Admin</summary>
              <p class="bootstrap-shortcuts-hint">
                Bootstrap credentials are prefilled. You must change your password after signing in.
              </p>
              <ce-button
                type="button"
                variant="ghost"
                size="sm"
                class="bootstrap-shortcut-btn"
                (click)="fillBootstrapCredentials()"
              >
                Use Platform Admin
              </ce-button>
            </details>
          }

          @if (demoInfo.enabled()) {
            <details class="demo-shortcuts">
              <summary>Try a demo account</summary>
              <p class="demo-shortcuts-hint">Password: <code>demo123</code> — click to fill, then Sign in.</p>
              <div class="demo-shortcuts-grid">
                @for (account of demoAccounts; track account.email) {
                  <ce-button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="demo-shortcut-btn"
                    (click)="fillDemoAccount(account.email)"
                  >
                    {{ account.label }}
                  </ce-button>
                }
              </div>
            </details>
          }
        }
      </div>

      @if (forgotPasswordOpen()) {
        <div class="forgot-modal-backdrop" (click)="closeForgotPassword()">
          <div
            class="forgot-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            (click)="$event.stopPropagation()"
          >
            <div class="forgot-modal-header">
              <h2 id="forgot-password-title" class="forgot-modal-title">Reset password</h2>
              <button type="button" class="forgot-modal-close" (click)="closeForgotPassword()" aria-label="Close modal">
                <ce-icon name="x" [size]="18" />
              </button>
            </div>

            @if (forgotPasswordError()) {
              <div class="login-error" role="alert" style="margin-bottom: var(--space-3);">
                <ce-icon name="alert-circle" [size]="18" />
                <span>{{ forgotPasswordError() }}</span>
              </div>
            }

            <p class="forgot-modal-subtitle">
              Enter your registered administrator email to receive a temporary recovery password.
            </p>

            <form [formGroup]="forgotPasswordForm" (ngSubmit)="onForgotPasswordSubmit()" class="login-form">
              <ce-input
                label="Email address"
                inputId="forgot-email"
                type="email"
                autocomplete="email"
                placeholder="admin@controleasy.app"
                formControlName="email"
                [error]="forgotEmailError()"
              >
                <span input-prefix><ce-icon name="user" [size]="16" /></span>
              </ce-input>

              <div
                class="forgot-modal-actions"
                style="margin-top: var(--space-4); display: flex; gap: var(--space-3); justify-content: flex-end;"
              >
                <ce-button
                  variant="ghost"
                  size="md"
                  type="button"
                  (click)="closeForgotPassword()"
                  [disabled]="forgotPasswordSubmitting()"
                >
                  Cancel
                </ce-button>
                <ce-button
                  variant="primary"
                  size="md"
                  type="submit"
                  [loading]="forgotPasswordSubmitting()"
                  [disabled]="forgotPasswordForm.invalid || forgotPasswordSubmitting()"
                >
                  Send instructions
                </ce-button>
              </div>
            </form>
          </div>
        </div>
      }
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
        position: relative;
      }
      .login-card {
        width: 100%;
        max-width: 28rem;
        background: var(--color-surface-elevated);
        border-radius: var(--radius-xl);
        padding: var(--space-8);
        box-shadow: var(--shadow-xl);
        border: 0;
        position: relative;
      }
      .login-card::before {
        content: '';
        display: block;
        width: 4rem;
        height: 3px;
        background: var(--color-primary);
        margin-bottom: var(--space-6);
      }
      .login-brand {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-5);
      }
      .login-brand-mark {
        width: 3rem;
        height: 3rem;
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: var(--font-weight-bold);
        font-size: 1.5rem;
        box-shadow: 0 5px 12px rgb(168 77 61 / 0.2);
      }
      .login-brand-text {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .login-title {
        font-size: var(--font-size-3xl);
        letter-spacing: -0.03em;
        margin-bottom: var(--space-2);
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

      .login-options-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .forgot-password-link {
        background: none;
        border: 0;
        padding: 0;
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        text-decoration: underline;
        font-family: inherit;
      }
      .forgot-password-link:hover {
        opacity: 0.85;
      }

      .forgot-modal-backdrop {
        position: fixed;
        inset: 0;
        background: var(--color-modal-backdrop);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
        padding: var(--space-4);
      }
      .forgot-modal-card {
        width: 100%;
        max-width: 26rem;
        background: var(--color-surface-elevated);
        border-radius: var(--radius-xl);
        padding: var(--space-6);
        box-shadow: var(--shadow-xl);
        border: 1px solid var(--color-border);
        position: relative;
      }
      .forgot-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-3);
      }
      .forgot-modal-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
      }
      .forgot-modal-close {
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--color-text-secondary);
        padding: var(--space-1);
        display: inline-flex;
        border-radius: var(--radius-sm);
      }
      .forgot-modal-close:hover {
        background: var(--color-neutral-light);
      }
      .forgot-modal-subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-4);
        line-height: 1.4;
      }

      .login-theme-toggle {
        position: fixed;
        top: var(--space-4);
        right: var(--space-4);
        z-index: 40;
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 0;
        border-radius: var(--radius-md);
        cursor: pointer;
        color: var(--color-text-primary);
      }
      .login-theme-toggle:hover {
        background: var(--color-neutral-light);
      }

      .password-toggle {
        display: inline-flex;
        align-items: center;
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--color-text-muted);
        padding: 0;
      }
      .back-icon {
        display: inline-flex;
        transform: rotate(180deg);
      }

      .login-error {
        padding: var(--space-3) var(--space-4);
        background: var(--color-danger-light);
        border: 1px solid color-mix(in oklch, var(--color-danger) 30%, transparent);
        border-radius: var(--radius-md);
        color: var(--color-danger);
        font-size: var(--font-size-sm);
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-4);
      }

      .tenant-picker-section {
        margin-top: var(--space-4);
      }
      .tenant-picker-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-3);
      }
      .tenant-picker-grid {
        display: grid;
        gap: var(--space-3);
      }
      @media (min-width: 640px) {
        .tenant-picker-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      .tenant-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        transition:
          transform var(--duration-fast),
          box-shadow var(--duration-fast),
          border-color var(--duration-fast);
      }
      .tenant-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--color-primary);
      }
      .tenant-card-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin-bottom: var(--space-1);
      }
      .tenant-card-slug {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .tenant-hint {
        text-align: center;
      }

      .text-secondary {
        color: var(--color-text-secondary);
      }
      .text-xs {
        font-size: var(--font-size-xs);
      }

      .demo-shortcuts {
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--color-border);
      }
      .demo-shortcuts summary {
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
      }
      .demo-shortcuts-hint {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        margin: var(--space-2) 0 var(--space-3);
      }
      .demo-shortcuts-grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .demo-shortcut-btn {
        flex: 1 1 calc(50% - var(--space-2));
        min-width: 8rem;
      }

      .bootstrap-shortcuts {
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--color-border);
      }
      .bootstrap-shortcuts summary {
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
      }
      .bootstrap-shortcuts-hint {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        margin: var(--space-2) 0 var(--space-3);
      }
      .bootstrap-shortcut-btn {
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnDestroy {
  private readonly authService = inject(AuthService);
  readonly demoInfo = inject(DemoInfoService);
  readonly bootstrapInfo = inject(BootstrapInfoService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroy$ = new Subject<void>();
  private readonly emailChange$ = new Subject<string>();

  readonly demoAccounts = DEMO_ACCOUNTS;

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [false],
  });

  loginError = signal<string | null>(null);
  submitting = signal(false);
  showPassword = signal(false);
  tenants = signal<TenantLookupResponse[]>([]);
  tenantPickerVisible = signal(false);
  tenantHint = signal<string | null>(null);

  forgotPasswordOpen = signal(false);
  forgotPasswordSubmitting = signal(false);
  forgotPasswordError = signal<string | null>(null);

  forgotPasswordForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const remembered = this.authService.getRememberedEmail();
    if (remembered) {
      this.loginForm.patchValue({ email: remembered, remember: true });
    } else if (this.bootstrapInfo.pending()) {
      this.applyBootstrapCredentials();
    }

    this.emailChange$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((email) => {
          if (!email || !this.isValidEmail(email)) {
            this.tenantHint.set(null);
            return [];
          }
          return this.authService.lookupTenants(email);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (tenants) => {
          if (tenants.length > 0) {
            this.tenantHint.set(`${tenants.length} condominium${tenants.length > 1 ? 's' : ''} found for this email.`);
          } else {
            this.tenantHint.set(null);
          }
        },
        error: () => this.tenantHint.set(null),
      });

    this.loginForm
      .get('email')
      ?.valueChanges.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((email) => {
        if (email && this.isValidEmail(email)) {
          this.emailChange$.next(email);
        }
      });
  }

  emailError(): string | null {
    const control = this.loginForm.get('email');
    if (control?.invalid && control.touched) {
      return 'Please enter a valid email address.';
    }
    return null;
  }

  passwordError(): string | null {
    const control = this.loginForm.get('password');
    if (control?.invalid && control.touched) {
      return 'Password is required.';
    }
    return null;
  }

  forgotEmailError(): string | null {
    const control = this.forgotPasswordForm.get('email');
    if (control?.invalid && control.touched) {
      return 'Please enter a valid email address.';
    }
    return null;
  }

  openForgotPassword(): void {
    const currentEmail = this.loginForm.get('email')?.value;
    if (currentEmail && this.isValidEmail(currentEmail)) {
      this.forgotPasswordForm.patchValue({ email: currentEmail });
    } else {
      this.forgotPasswordForm.reset();
    }
    this.forgotPasswordError.set(null);
    this.forgotPasswordOpen.set(true);
  }

  closeForgotPassword(): void {
    this.forgotPasswordOpen.set(false);
    this.forgotPasswordError.set(null);
    this.forgotPasswordSubmitting.set(false);
  }

  onForgotPasswordSubmit(): void {
    if (this.forgotPasswordForm.invalid) return;
    this.forgotPasswordError.set(null);
    this.forgotPasswordSubmitting.set(true);

    const email = this.forgotPasswordForm.get('email')?.value;
    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.forgotPasswordSubmitting.set(false);
        this.toast.info(res.message);
        this.closeForgotPassword();
      },
      error: (err) => {
        this.forgotPasswordSubmitting.set(false);
        this.forgotPasswordError.set(this.extractErrorMessage(err));
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;
    this.loginError.set(null);
    this.submitting.set(true);

    const { email, password, remember } = this.loginForm.value;
    this.authService.setRememberedEmail(email, remember);

    this.authService.login(email, password).subscribe({
      next: () => {
        this.authService.lookupTenants(email).subscribe({
          next: (tenantList) => {
            this.submitting.set(false);
            if (this.authService.mustChangePassword()) {
              this.router.navigate(['/change-password']);
              return;
            }
            if (tenantList.length > 1) {
              this.tenants.set(tenantList);
              this.tenantPickerVisible.set(true);
              return;
            }
            this.authService.loadSession();
            this.router.navigate([this.authService.postLoginRoute()]);
          },
          error: () => {
            this.submitting.set(false);
            this.authService.loadSession();
            this.router.navigate([this.authService.postLoginRoute()]);
          },
        });
      },
      error: (err) => {
        this.submitting.set(false);
        this.loginError.set(this.extractErrorMessage(err));
      },
    });
  }

  selectTenant(tenant: TenantLookupResponse): void {
    this.authService.setToken(this.authService.accessToken()!);
    this.submitting.set(true);
    this.authService.switchTenant(tenant.tenantId).subscribe({
      next: () => {
        this.submitting.set(false);
        this.authService.loadSession();
        this.router.navigate([this.authService.postLoginRoute()]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.loginError.set(this.extractErrorMessage(err));
      },
    });
  }

  backToLogin(): void {
    this.tenantPickerVisible.set(false);
    this.tenants.set([]);
    this.tenantHint.set(null);
  }

  fillBootstrapCredentials(): void {
    this.applyBootstrapCredentials();
    this.loginForm.markAsDirty();
    this.loginForm.updateValueAndValidity();
    this.loginError.set(null);
  }

  private applyBootstrapCredentials(): void {
    const email = this.bootstrapInfo.email();
    const password = this.bootstrapInfo.password();
    if (!email || !password) return;
    this.loginForm.patchValue({ email, password });
  }

  fillDemoAccount(email: string): void {
    this.loginForm.patchValue({ email, password: 'demo123' });
    this.loginForm.markAsDirty();
    this.loginForm.updateValueAndValidity();
    this.loginError.set(null);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private extractErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const httpErr = err as { error?: { detail?: string; title?: string }; status?: number; message?: string };
      if (httpErr.error?.detail) return httpErr.error.detail;
      if (httpErr.error?.title) return httpErr.error.title;
      if (httpErr.status === 401) return 'Invalid email or password.';
      if (httpErr.status === 0) return 'Unable to connect to the server. Please check your connection.';
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
