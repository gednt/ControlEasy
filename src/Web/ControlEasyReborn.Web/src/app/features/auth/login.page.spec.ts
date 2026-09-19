import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LoginPage } from './login.page';
import { AuthService } from '../../core/services/auth.service';
import { DemoInfoService } from '../../core/services/demo-info.service';
import { BootstrapInfoService } from '../../core/services/bootstrap-info.service';
import { ThemeService } from '../../design-system';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let demoInfoSpy: jasmine.SpyObj<DemoInfoService>;
  let bootstrapInfoSpy: jasmine.SpyObj<BootstrapInfoService>;
  let themeServiceSpy: jasmine.SpyObj<ThemeService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getRememberedEmail',
      'lookupTenants',
      'login',
      'forgotPassword',
      'resetUserPassword',
    ]);
    authServiceSpy.getRememberedEmail.and.returnValue(null);
    authServiceSpy.lookupTenants.and.returnValue(of([]));

    demoInfoSpy = jasmine.createSpyObj('DemoInfoService', ['enabled']);
    demoInfoSpy.enabled.and.returnValue(false);

    bootstrapInfoSpy = jasmine.createSpyObj('BootstrapInfoService', ['pending', 'email', 'password']);
    bootstrapInfoSpy.pending.and.returnValue(false);

    themeServiceSpy = jasmine.createSpyObj('ThemeService', ['toggle', 'resolvedTheme']);
    themeServiceSpy.resolvedTheme.and.returnValue('light');

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: DemoInfoService, useValue: demoInfoSpy },
        { provide: BootstrapInfoService, useValue: bootstrapInfoSpy },
        { provide: ThemeService, useValue: themeServiceSpy },
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

  it('closeForgotPassword should close modal and clear messages', () => {
    component.openForgotPassword();
    component.forgotPasswordMessage.set('Instructions sent');
    component.closeForgotPassword();

    expect(component.forgotPasswordOpen()).toBeFalse();
    expect(component.forgotPasswordMessage()).toBeNull();
  });

  it('onForgotPasswordSubmit should call authService.forgotPassword and set success message', () => {
    authServiceSpy.forgotPassword.and.returnValue(of({ message: 'If an account matches that email, instructions have been sent.' }));
    component.openForgotPassword();
    component.forgotPasswordForm.patchValue({ email: 'admin@condoeasy.com' });

    component.onForgotPasswordSubmit();

    expect(authServiceSpy.forgotPassword).toHaveBeenCalledWith('admin@condoeasy.com');
    expect(component.forgotPasswordSubmitting()).toBeFalse();
    expect(component.forgotPasswordMessage()).toBe('If an account matches that email, instructions have been sent.');
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
});
