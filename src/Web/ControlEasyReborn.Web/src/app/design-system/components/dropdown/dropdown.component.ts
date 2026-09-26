import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'ce-dropdown',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ce-dropdown" (click)="toggle()" (keydown.escape)="close()">
      <ng-content select="[ceDropdownTrigger], [dropdown-trigger]" />
      @if (isOpen()) {
        <div #panel class="ce-dropdown-panel" role="menu" (keydown.escape)="close()" (click)="$event.stopPropagation()">
          <ng-content />
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ce-dropdown {
        display: inline-block;
        position: relative;
      }
      :host ::ng-deep [ceDropdownTrigger],
      :host ::ng-deep [dropdown-trigger] {
        cursor: pointer;
      }
    `,
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'reposition()',
    '(window:scroll)': 'reposition()',
  },
})
export class CeDropdownComponent implements OnDestroy {
  isOpen = signal(false);
  openChange = output<boolean>();
  align = input<'start' | 'end'>('start');

  private elementRef = inject(ElementRef);
  private panelHome: HTMLElement | null = null;
  readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  toggle(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.isOpen.set(true);
    this.openChange.emit(true);
    setTimeout(() => this.attachAndPositionPanel());
  }

  close(): void {
    if (this.isOpen()) {
      this.restorePanelHome();
      this.isOpen.set(false);
      this.openChange.emit(false);
    }
  }

  onDocumentClick(event: Event): void {
    const panel = this.panelRef()?.nativeElement;
    if (!this.elementRef.nativeElement.contains(event.target) && !panel?.contains(event.target as Node)) {
      this.close();
    }
  }

  reposition(): void {
    if (this.isOpen()) this.positionPanel();
  }

  ngOnDestroy(): void {
    this.restorePanelHome();
  }

  private attachAndPositionPanel(): void {
    const panel = this.panelRef()?.nativeElement;
    if (!panel || !this.isOpen()) return;
    this.panelHome = panel.parentElement;
    document.body.appendChild(panel);
    this.positionPanel();
  }

  private positionPanel(): void {
    const panel = this.panelRef()?.nativeElement;
    const trigger = this.elementRef.nativeElement.querySelector(
      '[ceDropdownTrigger], [dropdown-trigger]',
    ) as HTMLElement | null;
    if (!panel || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const margin = 8;
    panel.style.position = 'fixed';
    panel.style.visibility = 'hidden';
    const panelRect = panel.getBoundingClientRect();
    const opensDownward =
      window.innerHeight - triggerRect.bottom >= panelRect.height + margin ||
      triggerRect.top < panelRect.height + margin;
    const desiredLeft = this.align() === 'end' ? triggerRect.right - panelRect.width : triggerRect.left;
    panel.style.left = `${Math.max(margin, Math.min(desiredLeft, window.innerWidth - panelRect.width - margin))}px`;
    panel.style.top = `${opensDownward ? triggerRect.bottom + margin : triggerRect.top - panelRect.height - margin}px`;
    panel.classList.toggle('ce-dropdown-panel-upward', !opensDownward);
    panel.style.visibility = 'visible';
  }

  private restorePanelHome(): void {
    const panel = this.panelRef()?.nativeElement;
    if (panel && this.panelHome && panel.parentElement === document.body) {
      this.panelHome.appendChild(panel);
    }
    this.panelHome = null;
  }
}
