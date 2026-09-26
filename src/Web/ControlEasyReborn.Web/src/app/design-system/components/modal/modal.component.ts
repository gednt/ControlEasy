import { Component, input, output, ChangeDetectionStrategy, ElementRef, inject } from '@angular/core';

@Component({
  selector: 'ce-modal',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="ce-modal-backdrop" (click)="onBackdropClick()" (document:keydown.escape)="close()"></div>
      <div
        class="ce-modal-container"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="title() ? 'modal-title' : null"
      >
        <div class="ce-card" [class]="'size-' + size()">
          <div class="ce-modal-header">
            <h2 id="modal-title" class="ce-modal-title">{{ title() }}</h2>
            <button class="ce-modal-close" type="button" aria-label="Close" (click)="close()">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="ce-modal-body">
            <ng-content />
          </div>
          <div class="ce-modal-footer">
            <ng-content select="[ce-modal-footer], [modal-footer]" />
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .ce-modal-backdrop {
        position: fixed;
        inset: 0;
        background: var(--color-modal-backdrop);
        z-index: 999;
        animation: fade-in var(--duration-base) var(--ease-out);
      }
      .ce-modal-container {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
      }
      .ce-card {
        background-color: var(--color-surface);
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent 31px,
          rgb(93 75 50 / 0.08) 31px,
          rgb(93 75 50 / 0.08) 32px
        );
        border-top: 4px solid var(--color-sidebar-bg);
        border-radius: 0;
        box-shadow: var(--shadow-lg);
        width: 100%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        animation: zoom-in var(--duration-base) var(--ease-out);
      }
      .size-sm {
        max-width: 24rem;
      }
      .size-md {
        max-width: 32rem;
      }
      .size-lg {
        max-width: 48rem;
      }
      .size-xl {
        max-width: 64rem;
      }
      .ce-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-4) var(--space-6);
        border-bottom: 1px solid var(--color-border);
      }
      .ce-modal-title {
        font-family: var(--font-family-display);
        font-size: var(--font-size-xl);
        font-weight: 500;
        color: var(--color-text-primary);
        margin: 0;
      }
      .ce-modal-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border: 0;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        border-radius: 0;
        font-size: 1.25rem;
        transition: background var(--duration-fast) var(--ease-out);
      }
      .ce-modal-close:hover {
        background: var(--color-neutral-light);
      }
      .ce-modal-body {
        padding: var(--space-6);
        overflow-y: auto;
        flex: 1;
      }
      .ce-modal-footer {
        padding: var(--space-4) var(--space-6);
        border-top: 1px solid var(--color-border);
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
      }
      @media (prefers-reduced-motion: reduce) {
        .ce-card {
          animation: none;
        }
        .ce-modal-backdrop {
          animation: none;
        }
      }
    `,
  ],
})
export class CeModalComponent {
  open = input(false);
  openChange = output<boolean>();
  closed = output<void>();
  title = input('');
  size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  private elementRef = inject(ElementRef);
  private previousFocus: Element | null = null;

  private wasOpen = false;

  ngDoCheck(): void {
    const isOpen = this.open();
    if (isOpen && !this.wasOpen) {
      this.previousFocus = document.activeElement;
      setTimeout(() => {
        ((this.elementRef.nativeElement as HTMLElement).querySelector('.ce-card') as HTMLElement)?.focus();
      }, 0);
    } else if (!isOpen && this.wasOpen) {
      if (this.previousFocus) {
        (this.previousFocus as HTMLElement).focus();
        this.previousFocus = null;
      }
    }
    this.wasOpen = isOpen;
  }

  close(): void {
    this.openChange.emit(false);
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }
}
