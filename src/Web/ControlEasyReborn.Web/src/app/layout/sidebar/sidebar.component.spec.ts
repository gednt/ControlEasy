import { importProvidersFrom, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TenantSessionService } from '../../core/services/tenant-session.service';
import { CE_LUCIDE_ICONS } from '../../design-system/components/icon/icon.registry';
import { SidebarComponent } from './sidebar.component';

class FakeAuthService {
  readonly roles = signal(['TenantAdmin']);
  readonly isPlatformAdmin = signal(false);

  hasPermission(permission: string): boolean {
    return permission === 'Access.Access.Operate';
  }
}

class FakeTenantSessionService {
  readonly tenantDisplayName = signal('Synthetic Condominium');
  readonly userDisplayName = signal('Synthetic Administrator');
}

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        importProvidersFrom(CE_LUCIDE_ICONS),
        { provide: AuthService, useValue: new FakeAuthService() },
        { provide: TenantSessionService, useValue: new FakeTenantSessionService() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
  });

  it('renders Device health navigation with its registered activity icon', () => {
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    const deviceHealthLink = links.find((link) => link.textContent?.includes('Device health'));

    expect(deviceHealthLink).toBeTruthy();
    expect(deviceHealthLink?.getAttribute('href')).toBe('/devices');
    expect(deviceHealthLink?.querySelector('svg.lucide-activity')).toBeTruthy();
  });
});
