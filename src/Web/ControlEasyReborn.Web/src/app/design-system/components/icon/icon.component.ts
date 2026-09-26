import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LucideIconName, resolveLucideIconName } from './icon.types';

@Component({
  selector: 'ce-icon',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lucide-icon
      [name]="lucideName()"
      [size]="size()"
      [strokeWidth]="strokeWidth()"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.aria-label]="label() ?? null"
      [attr.role]="label() ? 'img' : null"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
        color: currentColor;
      }
    `,
  ],
})
export class CeIconComponent {
  name = input.required<LucideIconName>();
  size = input<number>(20);
  strokeWidth = input<number>(2);
  /** When set, the icon is announced to assistive tech instead of being hidden. */
  label = input<string>();

  readonly lucideName = computed(() => resolveLucideIconName(this.name()));
}
