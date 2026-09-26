import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { LoginPage } from './login.page';
import { AuthService } from '../../core/services/auth.service';
import { DemoInfoService } from '../../core/services/demo-info.service';
import { BootstrapInfoService } from '../../core/services/bootstrap-info.service';
import { ThemeService, ToastService } from '../../design-system';
import { CE_LUCIDE_ICONS } from '../../design-system/components/icon/icon.registry';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let demoInfoSpy: jasmine.SpyObj<DemoInfoService>;
  let bootstrapInfoSpy: jasmine.SpyObj<BootstrapInfoService>;
  let themeServiceSpy: jasmine.SpyObj<ThemeService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getRememberedEmail',
      'lookupTenants',
      'login',
      'forgotPassword',
      'resetUserPassword',
      'setRememberedEmail',
      'loadSession',
      'postLoginRoute',
      'mustChangePassword',
      'accessToken',
      'switchTenant',
    ]);
    authServiceSpy.getRememberedEmail.and.returnValue(null);
    authServiceSpy.lookupTenants.and.returnValue(of([]));
    authServiceSpy.postLoginRoute.and.returnValue('/dashboard');
    authServiceSpy.mustChangePassword.and.returnValue(false);

    demoInfoSpy = jasmine.createSpyObj('DemoInfoService', ['enabled']);
    demoInfoSpy.enabled.and.returnValue(false);

    bootstrapInfoSpy = jasmine.createSpyObj('BootstrapInfoService', ['pending', 'email', 'password']);
    bootstrapInfoSpy.pending.and.returnValue(false);

    themeServiceSpy = jasmine.createSpyObj('ThemeService', ['toggle', 'resolvedTheme']);
    themeServiceSpy.resolvedTheme.and.returnValue('light');

    toastSpy = jasmine.createSpyObj('ToastService', ['info', 'success', 'warning', 'error']);
    toastSpy.info.and.returnValue(1);

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        importProvidersFrom(CE_LUCIDE_ICONS),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: DemoInfoService, useValue: demoInfoSpy },
        { provide: BootstrapInfoService, useValue: bootstrapInfoSpy },
        { provide: ThemeService, useValue: themeServiceSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with forgotPassword modal closed', () => {
    expect(component.forgotPasswordOpen()).toBeFalse();
  });

  it('openForgotPassword should open modal and reset state', () => {
    component.loginForm.patchValue({ email: 'admin@condoeasy.com' });
    component.openForgotPassword();

    expect(component.forgotPasswordOpen()).toBeTrue();
    expect(component.forgotPasswordForm.get('email')?.value).toBe('admin@condoeasy.com');
  });

  it('closeForgotPassword should close modal and clear errors', () => {
    component.openForgotPassword();
    component.forgotPasswordError.set('boom');
    component.closeForgotPassword();

    expect(component.forgotPasswordOpen()).toBeFalse();
    expect(component.forgotPasswordError()).toBeNull();
  });

  it('onForgotPasswordSubmit should call authService.forgotPassword and surface an info toast (not an inline banner)', () => {
    authServiceSpy.forgotPassword.and.returnValue(of({ message: 'If an account matches that email, instructions have been sent.' }));
    component.openForgotPassword();
    component.forgotPasswordForm.patchValue({ email: 'admin@condoeasy.com' });

    component.onForgotPasswordSubmit();

    expect(authServiceSpy.forgotPassword).toHaveBeenCalledWith('admin@condoeasy.com');
    expect(component.forgotPasswordSubmitting()).toBeFalse();
    expect(toastSpy.info).toHaveBeenCalledWith('If an account matches that email, instructions have been sent.');
    expect(component.forgotPasswordOpen()).toBeFalse();
  });

  it('onForgotPasswordSubmit should handle error and display error alert', () => {
    authServiceSpy.forgotPassword.and.returnValue(throwError(() => ({
      error: { detail: 'Too many requests' },
      status: 429,
    })));
    component.openForgotPassword();
    component.forgotPasswordForm.patchValue({ email: 'admin@condoeasy.com' });

    component.onForgotPasswordSubmit();

    expect(authServiceSpy.forgotPassword).toHaveBeenCalledWith('admin@condoeasy.com');
    expect(component.forgotPasswordSubmitting()).toBeFalse();
    expect(component.forgotPasswordError()).toBe('Too many requests');
  });

  it('onSubmit should set loginError and re-enable form on 401 (enumeration-safe)', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({
      error: { detail: 'Invalid email or password.' },
      status: 401,
    })));
    component.loginForm.patchValue({ email: 'admin@condoeasy.com', password: 'demo123' });

    component.onSubmit();

    expect(component.loginError()).toBe('Invalid email or password.');
    expect(component.submitting()).toBeFalse();
  });

  it('onSubmit should keep submitting=true while the login request is pending', () => {
    const pending$ = new Subject<never>();
    authServiceSpy.login.and.returnValue(pending$ as unknown as ReturnType<AuthService['login']>);
    component.loginForm.patchValue({ email: 'admin@condoeasy.com', password: 'demo123' });

    component.onSubmit();

    expect(component.submitting()).toBeTrue();
    pending$.complete();
  });
});