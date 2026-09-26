import { Directive, Input, ElementRef, inject, OnDestroy, Renderer2, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[ceTooltip]',
  standalone: true,
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
  },
})
export class CeTooltipDirective implements OnDestroy {
  @Input('ceTooltip') text = '';

  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);
  private viewContainerRef = inject(ViewContainerRef);
  private tooltipElement: HTMLElement | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  show(): void {
    this.timeoutId = setTimeout(() => {
      this.createTooltip();
    }, 400);
  }

  hide(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.destroyTooltip();
  }

  private createTooltip(): void {
    if (!this.text || this.tooltipElement) return;

    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setProperty(this.tooltipElement, 'textContent', this.text);
    this.renderer.setAttribute(this.tooltipElement, 'role', 'tooltip');
    this.renderer.setStyle(this.tooltipElement, 'position', 'absolute');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '9999');
    this.renderer.setStyle(this.tooltipElement, 'background', 'var(--color-surface-elevated)');
    this.renderer.setStyle(this.tooltipElement, 'color', 'var(--color-text-primary)');
    this.renderer.setStyle(this.tooltipElement, 'border', '1px solid var(--color-border)');
    this.renderer.setStyle(this.tooltipElement, 'border-radius', 'var(--radius-md)');
    this.renderer.setStyle(this.tooltipElement, 'padding', 'var(--space-1) var(--space-2)');
    this.renderer.setStyle(this.tooltipElement, 'font-size', 'var(--font-size-xs)');
    this.renderer.setStyle(this.tooltipElement, 'box-shadow', 'var(--shadow-md)');
    this.renderer.setStyle(this.tooltipElement, 'white-space', 'nowrap');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');

    const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
    let top = hostRect.bottom + 4;
    let left = hostRect.left;

    if (this.tooltipElement) {
      document.body.appendChild(this.tooltipElement);
      const tooltipRect = this.tooltipElement.getBoundingClientRect();
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }
      if (left < 8) {
        left = 8;
      }
      if (top + tooltipRect.height > window.innerHeight - 8) {
        top = hostRect.top - tooltipRect.height - 4;
      }
      this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
      this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
    }
  }

  private destroyTooltip(): void {
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
