import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CondominiumsPage } from './condominiums.page';
import { TenantsApiService } from './tenants-api.service';
import { AuthService } from '../../core/services/auth.service';

describe('CondominiumsPage', () => {
  let component: CondominiumsPage;
  let fixture: ComponentFixture<CondominiumsPage>;
  let tenantsApiSpy: jasmine.SpyObj<TenantsApiService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    tenantsApiSpy = jasmine.createSpyObj('TenantsApiService', [
      'list',
      'create',
      'suspend',
      'resume',
      'listAdmins',
      'listPorteiros',
    ]);
    tenantsApiSpy.list.and.returnValue(of([]));

    authServiceSpy = jasmine.createSpyObj('AuthService', ['resetUserPassword']);

    await TestBed.configureTestingModule({
      imports: [CondominiumsPage],
      providers: [
        { provide: TenantsApiService, useValue: tenantsApiSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CondominiumsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with reset modal closed', () => {
    expect(component.resetResultModalOpen()).toBeFalse();
    expect(component.resetResultPassword()).toBe('');
  });

  it('onResetUserPassword should call authService.resetUserPassword when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    authServiceSpy.resetUserPassword.and.returnValue(of({
      userId: 'user-123',
      tempPassword: 'TempPassword42!',
      mustChangePassword: true,
    }));

    component.onResetUserPassword('user-123', 'John Doe');

    expect(authServiceSpy.resetUserPassword).toHaveBeenCalledWith('user-123');
    expect(component.resetResultModalOpen()).toBeTrue();
    expect(component.resetResultUser()).toBe('John Doe');
    expect(component.resetResultPassword()).toBe('TempPassword42!');
  });

  it('onResetUserPassword should not call authService when cancelled', () => {
    spyOn(window, 'confirm').and.returnValue(false);

    component.onResetUserPassword('user-123', 'John Doe');

    expect(authServiceSpy.resetUserPassword).not.toHaveBeenCalled();
    expect(component.resetResultModalOpen()).toBeFalse();
  });

  it('closeResetResultModal should close modal and clear state', () => {
    component.resetResultModalOpen.set(true);
    component.resetResultUser.set('John Doe');
    component.resetResultPassword.set('TempPassword42!');

    component.closeResetResultModal();

    expect(component.resetResultModalOpen()).toBeFalse();
    expect(component.resetResultUser()).toBe('');
    expect(component.resetResultPassword()).toBe('');
  });
});
