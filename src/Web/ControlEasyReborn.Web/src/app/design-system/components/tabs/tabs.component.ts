import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  signal,
  ContentChildren,
  QueryList,
  AfterContentInit,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'ce-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
})
export class CeTabComponent {
  label = input.required<string>();
  content = input.required<TemplateRef<unknown>>();
}

@Component({
  selector: 'ce-tabs',
  standalone: true,
  imports: [CeTabComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-tabs" role="tablist">
      <div class="ce-tabs-list">
        @for (tab of tabs(); track tab.label()) {
          <button
            class="ce-tab"
            role="tab"
            [attr.aria-selected]="activeIndex() === $index"
            [attr.tabindex]="activeIndex() === $index ? 0 : -1"
            (click)="selectTab($index)"
            (keydown)="onKeydown($event, $index)"
          >
            {{ tab.label() }}
          </button>
        }
      </div>
    </div>
    <div class="ce-tabs-panels">
      @for (tab of tabs(); track tab.label()) {
        @if (activeIndex() === $index) {
          <ng-template [ngTemplateOutlet]="tab.content()"></ng-template>
        }
      }
    </div>
  `,
  styles: [
    `
      .ce-tabs-list {
        display: flex;
        border-bottom: 1px solid var(--color-border);
        gap: 0;
        position: relative;
      }
      .ce-tab {
        padding: var(--space-3) var(--space-4);
        border: 0;
        background: transparent;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        font-family: inherit;
        transition:
          color var(--duration-fast) var(--ease-out),
          border-color var(--duration-fast) var(--ease-out);
      }
      .ce-tab[aria-selected='true'] {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
      }
      .ce-tab:hover {
        color: var(--color-text-primary);
      }
      :host ::ng-deep .ce-tabs-panels {
        padding: var(--space-4) 0;
      }
    `,
  ],
})
export class CeTabsComponent implements AfterContentInit {
  @ContentChildren(CeTabComponent) tabQuery!: QueryList<CeTabComponent>;

  tabs = signal<CeTabComponent[]>([]);
  activeIndex = signal(0);
  activeIndexChange = output<number>();

  ngAfterContentInit(): void {
    this.tabs.set(this.tabQuery.toArray());
  }

  selectTab(index: number): void {
    this.activeIndex.set(index);
    this.activeIndexChange.emit(index);
  }

  onKeydown(event: KeyboardEvent, currentIndex: number): void {
    const tabArray = this.tabs();
    let newIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      newIndex = (currentIndex + 1) % tabArray.length;
    } else if (event.key === 'ArrowLeft') {
      newIndex = (currentIndex - 1 + tabArray.length) % tabArray.length;
    } else if (event.key === 'Home') {
      newIndex = 0;
    } else if (event.key === 'End') {
      newIndex = tabArray.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    this.selectTab(newIndex);
  }
}
