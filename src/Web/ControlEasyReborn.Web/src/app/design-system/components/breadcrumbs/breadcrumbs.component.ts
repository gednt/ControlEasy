import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'ce-breadcrumbs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="ce-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        @for (crumb of crumbs(); track crumb.label) {
          <li>
            @if ($index < crumbs().length - 1) {
              <a [routerLink]="crumb.route ?? '/'" routerLinkActive [routerLinkActiveOptions]="{ exact: true }">{{
                crumb.label
              }}</a>
              <span class="ce-breadcrumb-sep" aria-hidden="true">/</span>
            } @else {
              <span aria-current="page">{{ crumb.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [
    `
      .ce-breadcrumbs ol {
        display: flex;
        align-items: center;
        gap: 0;
        list-style: none;
        margin: 0;
        padding: 0;
        font-size: var(--font-size-sm);
      }
      .ce-breadcrumbs a {
        color: var(--color-text-secondary);
        text-decoration: none;
        transition: color var(--duration-fast) var(--ease-out);
      }
      .ce-breadcrumbs a:hover {
        color: var(--color-primary);
      }
      .ce-breadcrumbs span[aria-current='page'] {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
      }
      .ce-breadcrumb-sep {
        margin: 0 var(--space-1);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class CeBreadcrumbsComponent {
  crumbs = input<Array<{ label: string; route?: string }>>([]);
}
