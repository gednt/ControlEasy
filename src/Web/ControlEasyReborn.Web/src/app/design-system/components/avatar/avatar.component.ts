import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';

@Component({
  selector: 'ce-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src()) {
      <img [src]="src()!" [alt]="name()" class="ce-avatar-img" [class]="'size-' + size()" />
    } @else {
      <div class="ce-avatar-initials" [class]="'size-' + size()" [style.background]="background() ?? backgroundColor()">
        {{ initials() }}
      </div>
    }
  `,
  styles: [
    `
      .ce-avatar-img,
      .ce-avatar-initials {
        border-radius: var(--radius-full);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        color: var(--color-text-on-primary);
        font-weight: var(--font-weight-semibold);
      }
      .size-xs {
        width: 1.5rem;
        height: 1.5rem;
        font-size: 0.625rem;
      }
      .size-sm {
        width: 2rem;
        height: 2rem;
        font-size: 0.75rem;
      }
      .size-md {
        width: 2.5rem;
        height: 2.5rem;
        font-size: 0.8rem;
      }
      .size-lg {
        width: 3rem;
        height: 3rem;
        font-size: 0.9rem;
      }
      .size-xl {
        width: 4rem;
        height: 4rem;
        font-size: 1.1rem;
      }
    `,
  ],
})
export class CeAvatarComponent {
  src = input<string | null>(null);
  name = input('');
  size = input<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');
  /** When set, overrides the hash-based fallback background. */
  background = input<string | null>(null);

  initials = computed(() => {
    const n = this.name();
    if (!n) return '?';
    return n
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  backgroundColor = computed(() => {
    const n = this.name();
    const colors = [
      'var(--color-primary)',
      'var(--color-primary-hover)',
      'var(--color-danger)',
      'var(--color-success)',
      'var(--color-info)',
      'var(--color-warning)',
    ];
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length]!;
  });
}
