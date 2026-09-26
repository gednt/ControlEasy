import {
  AfterViewInit,
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  effect,
  DestroyRef,
  HostListener,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { DemoBannerComponent } from '../demo-banner/demo-banner.component';
import { CeToastHostComponent, ToastService } from '../../design-system/components/toast/toast.component';
import { AuthService } from '../../core/services/auth.service';
import { DrawerService } from '../../core/services/drawer.service';

@Component({
  selector: 'ce-app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, DemoBannerComponent, CeToastHostComponent],
  template: `
    <div class="app-shell" [class.drawer-open]="drawerService.isOpen()">
      <ce-sidebar />
      @if (drawerService.isOpen()) {
        <button type="button" class="drawer-backdrop" aria-label="Close menu" (click)="drawerService.close()"></button>
      }
      <div class="main-area">
        <ce-demo-banner />
        <ce-topbar />
        <main id="main" class="page-content" tabindex="-1">
          <router-outlet />
        </main>
      </div>
      <ce-toast-host />
    </div>
  `,
  styles: [
    `
      .app-shell {
        display: grid;
        grid-template-columns: var(--sidebar-width) 1fr;
        min-height: 100vh;
      }
      @media (max-width: 1023px) {
        .app-shell {
          grid-template-columns: var(--sidebar-width-collapsed) 1fr;
        }
      }
      @media (max-width: 639px) {
        .app-shell {
          grid-template-columns: 1fr;
        }
      }
      .main-area {
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: var(--color-background);
      }
      .page-content {
        flex: 1;
        padding: var(--space-8);
        overflow-x: auto;
        max-width: calc(var(--content-max-width) + var(--space-16));
        width: 100%;
        margin: 0 auto;
      }
      @media (max-width: 639px) {
        .page-content {
          padding: var(--space-4);
        }
      }
      .drawer-backdrop {
        display: none;
      }
      @media (max-width: 639px) {
        .drawer-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 50;
          border: 0;
          padding: 0;
          background: var(--color-modal-backdrop);
          cursor: pointer;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent implements OnInit, AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  readonly drawerService = inject(DrawerService);

  @ViewChild(CeToastHostComponent) private readonly toastHost!: CeToastHostComponent;

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      document.body.classList.toggle('drawer-open', this.drawerService.isOpen());
    });

    this.destroyRef.onDestroy(() => {
      if (isPlatformBrowser(this.platformId)) {
        document.body.classList.remove('drawer-open');
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.drawerService.close();
  }

  ngOnInit(): void {
    this.authService.loadSession();
  }

  ngAfterViewInit(): void {
    this.toastService.registerHost(this.toastHost);
  }
}
