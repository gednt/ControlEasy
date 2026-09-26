import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { CePhotoComponent } from './photo.component';
import { CePhotoLightboxComponent } from './photo-lightbox.component';
import { CeIconComponent } from '../icon/icon.component';
import type { PhotoResponse } from '../../../features/photos/photos-api.service';

/**
 * Multi-photo gallery with lightbox integration. Renders thumbnails in a
 * flex-wrap row, an optional '+' add tile, and an empty state placeholder.
 *
 * Click a thumbnail to open the lightbox. The lightbox emits photoDeleted;
 * gallery forwards the id to its consumer so the consumer can call the API
 * and re-fetch the photos list.
 */
@Component({
  selector: 'ce-photo-gallery',
  standalone: true,
  imports: [CePhotoComponent, CePhotoLightboxComponent, CeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gallery">
      @for (photo of photos(); track photo.id; let i = $index) {
        <ce-photo [photoId]="photo.id" [size]="'thumbnail'" (photoClicked)="openLightbox(i)" />
      }
      @if (canAdd()) {
        <button type="button" class="add-tile" aria-label="Add photo" (click)="onAdd()">
          <ce-icon name="plus" [size]="24" />
        </button>
      }
      @if (photos().length === 0 && !canAdd()) {
        <div class="empty">No photos yet.</div>
      }
    </div>

    <ce-photo-lightbox
      [photos]="photos()"
      [startIndex]="lightboxIndex()"
      [open]="lightboxOpen()"
      [canDelete]="canDelete()"
      (closed)="lightboxOpen.set(false)"
      (photoDeleted)="onDelete($event)"
    />
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .gallery {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2, 8px);
        align-items: flex-start;
      }
      .add-tile {
        width: 96px;
        height: 96px;
        border: 2px dashed var(--color-border);
        border-radius: var(--radius-md, 4px);
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-muted);
        transition:
          color var(--duration-fast, 150ms) var(--ease-out, ease-out),
          border-color var(--duration-fast, 150ms) var(--ease-out, ease-out);
      }
      .add-tile:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .empty {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm, 14px);
        padding: var(--space-3, 12px);
      }
    `,
  ],
})
export class CePhotoGalleryComponent {
  photos = input.required<PhotoResponse[]>();
  canAdd = input<boolean>(false);
  canDelete = input<boolean>(false);
  /** Optional explicit pixel size for thumbnails; defaults to 128 in ce-photo. */
  thumbnailSize = input<number | null>(null);

  addRequested = output<void>();
  photoDeleted = output<string>();

  lightboxOpen = signal(false);
  lightboxIndex = signal(0);

  hasPhotos = computed(() => this.photos().length > 0);

  openLightbox(index: number): void {
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
  }

  onAdd(): void {
    this.addRequested.emit();
  }

  onDelete(photoId: string): void {
    this.photoDeleted.emit(photoId);
    this.lightboxOpen.set(false);
  }
}
