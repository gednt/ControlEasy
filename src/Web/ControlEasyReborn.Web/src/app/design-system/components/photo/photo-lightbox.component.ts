import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CeIconComponent } from '../icon/icon.component';
import { CeButtonComponent } from '../button/button.component';
import { CePhotoComponent } from './photo.component';
import type { PhotoResponse } from '../../../features/photos/photos-api.service';
import { formatRuntimeDate } from '../../../core/config/runtime-config';

/**
 * Full-screen overlay that renders the source blob of a photo with prev/next
 * navigation. Click backdrop or press Escape to close. Arrow keys navigate.
 *
 * Used internally by ce-photo-gallery but can be embedded directly.
 */
@Component({
  selector: 'ce-photo-lightbox',
  standalone: true,
  imports: [CeIconComponent, CeButtonComponent, CePhotoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="lightbox-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Photo viewer"
        (click)="onBackdropClick()"
      >
        <button
          type="button"
          class="close-btn"
          aria-label="Close"
          (click)="close($event)"
        >
          <ce-icon name="x" [size]="24" />
        </button>

        @if (hasMultiple()) {
          <button
            type="button"
            class="nav-btn prev"
            aria-label="Previous photo"
            (click)="prev($event)"
          >
            <ce-icon name="chevron-left" [size]="28" />
          </button>
          <button
            type="button"
            class="nav-btn next"
            aria-label="Next photo"
            (click)="next($event)"
          >
            <ce-icon name="chevron-right" [size]="28" />
          </button>
        }

        <div class="photo-container" (click)="stop($event)">
          @if (currentPhoto(); as photo) {
            <ce-photo
              class="lightbox-image"
              [photoId]="photo.id"
              size="source"
              [clickable]="false"
            />
            <div class="caption">
              <span class="caption-text">
                {{ formatTimestamp(photo) }}
              </span>
              @if (canDelete()) {
                <ce-button
                  variant="danger"
                  size="sm"
                  (click)="onDelete($event)"
                >
                  <ce-icon name="trash-2" [size]="14" />
                  Delete
                </ce-button>
              }
            </div>
          } @else {
            <p class="empty">No photo selected</p>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .lightbox-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: ce-lb-fade 200ms ease-out;
      }
      .photo-container {
        max-width: 800px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: var(--space-2, 8px);
        gap: var(--space-2, 8px);
      }
      :host ::ng-deep ce-photo.lightbox-image img {
        max-width: 100%;
        max-height: 70vh;
        object-fit: contain;
        border-radius: var(--radius-md, 4px);
        background: var(--color-surface, #000);
      }
      .caption {
        color: white;
        font-size: var(--font-size-xs, 12px);
        margin-top: var(--space-2, 8px);
        display: flex;
        gap: var(--space-3, 12px);
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0 var(--space-2, 8px);
      }
      .caption-text {
        color: var(--color-text-on-primary, #fff);
      }
      .close-btn {
        position: absolute;
        top: var(--space-3, 12px);
        right: var(--space-3, 12px);
        background: rgba(0, 0, 0, 0.4);
        border: 0;
        color: white;
        cursor: pointer;
        padding: var(--space-2, 8px);
        border-radius: var(--radius-md, 4px);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .close-btn:hover {
        background: rgba(0, 0, 0, 0.7);
      }
      .nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.4);
        border: 0;
        color: white;
        cursor: pointer;
        padding: var(--space-3, 12px);
        border-radius: var(--radius-md, 4px);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .nav-btn:hover {
        background: rgba(0, 0, 0, 0.7);
      }
      .nav-btn.prev {
        left: var(--space-3, 12px);
      }
      .nav-btn.next {
        right: var(--space-3, 12px);
      }
      .empty {
        color: white;
      }
      @keyframes ce-lb-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .lightbox-overlay { animation: none; }
      }
    `,
  ],
})
export class CePhotoLightboxComponent {
  photos = input.required<PhotoResponse[]>();
  startIndex = input<number>(0);
  open = input<boolean>(false);
  /** When true, renders the delete button and emits photoDeleted on click. */
  canDelete = input<boolean>(false);

  closed = output<void>();
  photoDeleted = output<string>();

  currentIndex = signal(0);
  hasMultiple = computed(() => this.photos().length > 1);
  currentPhoto = computed(() => {
    const list = this.photos();
    if (list.length === 0) return null;
    const idx = Math.min(this.currentIndex(), list.length - 1);
    return list[idx] ?? null;
  });
  constructor() {
    // Reset currentIndex whenever the photos array identity or startIndex changes.
    // allowSignalWrites: required because we write to currentIndex inside the effect.
    effect(
      () => {
        const start = this.startIndex();
        const list = this.photos();
        if (list.length === 0) {
          this.currentIndex.set(0);
          return;
        }
        const idx = Math.min(Math.max(0, start), list.length - 1);
        this.currentIndex.set(idx);
      },
      { allowSignalWrites: true },
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }

  @HostListener('document:keydown.arrowright')
  onArrowRight(): void {
    if (this.open() && this.hasMultiple()) this.next();
  }

  @HostListener('document:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.open() && this.hasMultiple()) this.prev();
  }

  close(event?: Event): void {
    if (event) event.stopPropagation();
    this.closed.emit();
  }

  prev(event?: Event): void {
    if (event) event.stopPropagation();
    this.currentIndex.update((i) => {
      const len = this.photos().length;
      return i === 0 ? len - 1 : i - 1;
    });
  }

  next(event?: Event): void {
    if (event) event.stopPropagation();
    this.currentIndex.update((i) => {
      const len = this.photos().length;
      return i === len - 1 ? 0 : i + 1;
    });
  }

  onBackdropClick(): void {
    this.close();
  }

  stop(event: Event): void {
    event.stopPropagation();
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    const photo = this.currentPhoto();
    if (photo) this.photoDeleted.emit(photo.id);
  }

  formatTimestamp(photo: PhotoResponse): string {
    const stamp = photo.capturedAtUtc ?? photo.createdAtUtc;
    try {
      const d = new Date(stamp);
      if (isNaN(d.getTime())) return stamp;
      return formatRuntimeDate(d);
    } catch {
      return stamp;
    }
  }
}
