import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CeButtonComponent,
  CeCardComponent,
  CeInputComponent,
  CeStatTileComponent,
  CeBadgeComponent,
  CeModalComponent,
  CeToastHostComponent,
  ToastService,
  CeTableComponent,
  CeEmptyStateComponent,
  CeSpinnerComponent,
  CeAvatarComponent,
  CeTabsComponent,
  CeTabComponent,
  CeDropdownComponent,
  CePaginationComponent,
  CeBreadcrumbsComponent,
  CeCheckboxComponent,
  CeIconComponent,
  CeTooltipDirective,
  ThemeService,
} from '../index';
import { ICON_SHOWCASE_NAMES, ICON_SHOWCASE_SIZES } from '../components/icon/icon.stories';

@Component({
  selector: 'ce-showcase-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CeButtonComponent,
    CeCardComponent,
    CeInputComponent,
    CeStatTileComponent,
    CeBadgeComponent,
    CeModalComponent,
    CeToastHostComponent,
    CeTableComponent,
    CeEmptyStateComponent,
    CeSpinnerComponent,
    CeAvatarComponent,
    CeTabsComponent,
    CeTabComponent,
    CeDropdownComponent,
    CePaginationComponent,
    CeBreadcrumbsComponent,
    CeCheckboxComponent,
    CeIconComponent,
    CeTooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase" [attr.data-theme]="localTheme()">
      <div class="showcase-header">
        <h1>Design System Showcase</h1>
        <p>Every base component rendered in both themes.</p>
        <div class="theme-switcher">
          <label for="showcase-theme">Local theme:</label>
          <select id="showcase-theme" [value]="localTheme()" (change)="onThemeChange($event)">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <section class="showcase-section">
        <h2>Icons</h2>
        <p class="showcase-hint">Lucide-backed <code>ce-icon</code> at default sizes.</p>
        <div class="showcase-icon-grid">
          @for (iconName of iconNames; track iconName) {
            <div class="showcase-icon-cell" [title]="iconName">
              <ce-icon [name]="iconName" [size]="20" />
              <span>{{ iconName }}</span>
            </div>
          }
        </div>
        <p class="showcase-hint">Size variants (search icon):</p>
        <div class="showcase-row">
          @for (iconSize of iconSizes; track iconSize) {
            <div class="showcase-icon-size">
              <ce-icon name="search" [size]="iconSize" />
              <span>{{ iconSize }}px</span>
            </div>
          }
        </div>
      </section>

      <section class="showcase-section">
        <h2>Buttons</h2>
        <div class="showcase-row">
          <ce-button variant="primary" size="sm">Primary SM</ce-button>
          <ce-button variant="primary" size="md">Primary MD</ce-button>
          <ce-button variant="primary" size="lg">Primary LG</ce-button>
          <ce-button variant="secondary">Secondary</ce-button>
          <ce-button variant="ghost">Ghost</ce-button>
          <ce-button variant="danger">Danger</ce-button>
          <ce-button variant="primary" [loading]="true">Loading</ce-button>
          <ce-button variant="primary" [disabled]="true">Disabled</ce-button>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Cards</h2>
        <div class="showcase-grid-3">
          <ce-card>
            <div card-header>Default Card</div>
            <p>A basic card with no accent.</p>
          </ce-card>
          <ce-card accent="primary">
            <div card-header>Primary Accent</div>
            <p>Card with primary accent border.</p>
          </ce-card>
          <ce-card accent="success">
            <div card-header>Success Accent</div>
            <p>Card with success accent border.</p>
          </ce-card>
          <ce-card accent="danger">
            <div card-header>Danger Accent</div>
            <p>Card with danger accent border.</p>
          </ce-card>
          <ce-card accent="warning">
            <div card-header>Warning Accent</div>
            <p>Card with warning accent border.</p>
          </ce-card>
          <ce-card [padded]="false">
            <div card-header>Unpadded</div>
            <p>No internal padding.</p>
          </ce-card>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Inputs</h2>
        <div class="showcase-col">
          <ce-input label="Email" helper="Enter your email" placeholder="you@example.com"></ce-input>
          <ce-input label="With error" error="This field is required" placeholder="Invalid input"></ce-input>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Stat Tiles</h2>
        <div class="showcase-grid-4">
          <ce-stat-tile
            label="Total Residents"
            [value]="1248"
            [trend]="{ direction: 'up', value: '+12%', tone: 'success' }"
          ></ce-stat-tile>
          <ce-stat-tile
            label="Active Visits"
            [value]="42"
            [trend]="{ direction: 'down', value: '-5%', tone: 'danger' }"
          ></ce-stat-tile>
          <ce-stat-tile
            label="Vehicles"
            [value]="389"
            [trend]="{ direction: 'flat', value: '0%', tone: 'neutral' }"
          ></ce-stat-tile>
          <ce-stat-tile label="No Trend" [value]="56"></ce-stat-tile>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Badges</h2>
        <div class="showcase-row">
          <ce-badge content="Primary" tone="primary"></ce-badge>
          <ce-badge content="Success" tone="success"></ce-badge>
          <ce-badge content="Warning" tone="warning"></ce-badge>
          <ce-badge content="Danger" tone="danger"></ce-badge>
          <ce-badge content="Info" tone="info"></ce-badge>
          <ce-badge content="Neutral" tone="neutral"></ce-badge>
          <ce-badge content="Small" tone="primary" size="sm"></ce-badge>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Modal</h2>
        <ce-button variant="secondary" (click)="modalOpen.set(true)">Open Modal</ce-button>
        @if (modalOpen()) {
          <div class="ce-modal-backdrop" (click)="modalOpen.set(false)"></div>
          <div class="ce-modal-container">
            <div class="ce-modal size-md" role="dialog" aria-modal="true">
              <div class="ce-modal-header">
                <h2 class="ce-modal-title">Example Modal</h2>
                <button class="ce-modal-close" type="button" aria-label="Close" (click)="modalOpen.set(false)">
                  &times;
                </button>
              </div>
              <div class="ce-modal-body">
                <p>This is a modal dialog. Press Escape or click the backdrop to close.</p>
              </div>
              <div class="ce-modal-footer">
                <ce-button variant="ghost" (click)="modalOpen.set(false)">Cancel</ce-button>
                <ce-button variant="primary" (click)="modalOpen.set(false)">Confirm</ce-button>
              </div>
            </div>
          </div>
        }
      </section>

      <section class="showcase-section">
        <h2>Toast</h2>
        <div class="showcase-row">
          <ce-button variant="primary" (click)="toastService.success('Resident saved successfully')">Success</ce-button>
          <ce-button variant="secondary" (click)="toastService.info('Sync in progress')">Info</ce-button>
          <ce-button variant="ghost" (click)="toastService.warning('Disk space running low')">Warning</ce-button>
          <ce-button variant="danger" (click)="toastService.error('Failed to save resident')">Error</ce-button>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Table</h2>
        <ce-table>
          <table class="ce-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Apartment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>João Silva</td>
                <td>101</td>
                <td><ce-badge content="Active" tone="success"></ce-badge></td>
              </tr>
              <tr>
                <td>Maria Santos</td>
                <td>202</td>
                <td><ce-badge content="Inactive" tone="neutral"></ce-badge></td>
              </tr>
            </tbody>
          </table>
        </ce-table>
      </section>

      <section class="showcase-section">
        <h2>Empty State</h2>
        <ce-empty-state
          icon="✉"
          title="No messages"
          description="You don't have any messages yet. Start a conversation!"
          actionLabel="New Message"
          (action)="toastService.info('Create new message')"
        >
        </ce-empty-state>
      </section>

      <section class="showcase-section">
        <h2>Spinner</h2>
        <div class="showcase-row">
          <ce-spinner size="sm" tone="primary"></ce-spinner>
          <ce-spinner size="md" tone="primary"></ce-spinner>
          <ce-spinner size="lg" tone="primary"></ce-spinner>
          <ce-spinner size="md" tone="current"></ce-spinner>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Avatar</h2>
        <div class="showcase-row">
          <ce-avatar name="João Silva" size="xs"></ce-avatar>
          <ce-avatar name="Maria Santos" size="sm"></ce-avatar>
          <ce-avatar name="Carlos" size="md"></ce-avatar>
          <ce-avatar name="Ana" size="lg"></ce-avatar>
          <ce-avatar name="Pedro" size="xl"></ce-avatar>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Breadcrumbs</h2>
        <ce-breadcrumbs
          [crumbs]="[
            { label: 'Home', route: '/' },
            { label: 'Residents', route: '/residents' },
            { label: 'João Silva' },
          ]"
        ></ce-breadcrumbs>
      </section>

      <section class="showcase-section">
        <h2>Tabs</h2>
        <ce-tabs>
          <ce-tab label="Overview" [content]="overviewTab" />
          <ce-tab label="Activity" [content]="activityTab" />
        </ce-tabs>
        <ng-template #overviewTab><p>Overview content is active.</p></ng-template>
        <ng-template #activityTab><p>Activity content is active.</p></ng-template>
      </section>

      <section class="showcase-section">
        <h2>Dropdown</h2>
        <ce-dropdown>
          <ce-button dropdown-trigger variant="secondary">Open menu</ce-button>
          <button role="menuitem" type="button" (click)="toastService.info('Profile selected')">Profile</button>
          <button role="menuitem" type="button" (click)="toastService.info('Settings selected')">Settings</button>
        </ce-dropdown>
      </section>

      <section class="showcase-section">
        <h2>Tooltip</h2>
        <ce-button variant="secondary" ceTooltip="Helpful tooltip text">Hover or focus me</ce-button>
      </section>

      <section class="showcase-section">
        <h2>Checkbox</h2>
        <div class="showcase-col">
          <ce-checkbox
            label="Remember my email"
            [checked]="checkboxValue()"
            (checkedChange)="checkboxValue.set($event)"
          ></ce-checkbox>
          <ce-checkbox label="Disabled option" [disabled]="true"></ce-checkbox>
          <ce-checkbox label="Indeterminate" [indeterminate]="true"></ce-checkbox>
        </div>
      </section>

      <section class="showcase-section">
        <h2>Pagination</h2>
        <ce-pagination [page]="1" [pageSize]="10" [total]="95"></ce-pagination>
      </section>

      <section class="showcase-section">
        <h2>Theme Toggle (Global)</h2>
        <p>Current global theme: {{ themeService.theme() }}</p>
        <ce-button variant="secondary" (click)="themeService.toggle()">Toggle Global Theme</ce-button>
      </section>

      <ce-toast-host />
    </div>
  `,
  styles: [
    `
      .showcase {
        padding: var(--space-6);
        max-width: var(--content-max-width);
        margin: 0 auto;
      }
      .showcase-header {
        margin-bottom: var(--space-8);
      }
      .showcase-header h1 {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-bold);
      }
      .showcase-header p {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-top: var(--space-2);
      }
      .theme-switcher {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-4);
      }
      .theme-switcher label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }
      .theme-switcher select {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-primary);
        padding: var(--space-1) var(--space-2);
        font-family: inherit;
      }
      .showcase-section {
        margin-bottom: var(--space-8);
      }
      .showcase-section h2 {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        margin-bottom: var(--space-4);
        padding-bottom: var(--space-2);
        border-bottom: 1px solid var(--color-border);
      }
      .showcase-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        align-items: center;
      }
      .showcase-col {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        max-width: 24rem;
      }
      .showcase-grid-3 {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
        gap: var(--space-4);
      }
      .showcase-grid-4 {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
        gap: var(--space-4);
      }
      .showcase-hint {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-3);
      }
      .showcase-icon-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
        gap: var(--space-3);
        margin-bottom: var(--space-6);
      }
      .showcase-icon-cell,
      .showcase-icon-size {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        text-align: center;
      }
    `,
  ],
})
export class ShowcasePageComponent {
  readonly themeService = inject(ThemeService);
  readonly toastService = inject(ToastService);
  readonly iconNames = ICON_SHOWCASE_NAMES;
  readonly iconSizes = ICON_SHOWCASE_SIZES;

  localTheme = signal<'light' | 'dark'>('light');
  modalOpen = signal(false);
  checkboxValue = signal(false);

  onThemeChange(event: Event): void {
    this.localTheme.set((event.target as HTMLSelectElement).value as 'light' | 'dark');
  }
}
