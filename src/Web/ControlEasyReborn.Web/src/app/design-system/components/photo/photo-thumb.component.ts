import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { CePhotoComponent } from './photo.component';
import { PhotoEntityType, PhotosApiService } from '../../../features/photos/photos-api.service';
import { PhotoEventsService } from '../../../features/photos/photo-events.service';

/**
 * Lazy list-cell wrapper that resolves an entity to its most-recent photo id
 * and renders it through `ce-photo`. The authenticated list call is deferred
 * via IntersectionObserver (200px rootMargin) so off-screen rows perform zero
 * HTTP work. When the entity has no photos, renders a neutral placeholder.
 */
@Component({
  selector: 'ce-photo-thumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CePhotoComponent],
  template: `
    @if (photoId(); as id) {
      <ce-photo
        [photoId]="id"
        size="thumbnail"
        [clickable]="true"
        (photoClicked)="photoClicked.emit()"
      />
    } @else if (placeholderVisible()) {
      <span class="ce-photo-thumb-placeholder" aria-hidden="true"></span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
      }
      .ce-photo-thumb-placeholder {
        display: inline-block;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-md, 4px);
        background: var(--color-surface-alt, #eee);
        opacity: 0.6;
      }
    `,
  ],
})
export class CePhotoThumbComponent implements OnDestroy {
  private readonly photosApi = inject(PhotosApiService);
  private readonly photoEvents = inject(PhotoEventsService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  entityType = input.required<PhotoEntityType>();
  entityId = input.required<string>();

  photoClicked = output<void>();

  photoId = signal<string | null>(null);
  resolved = signal<boolean>(false);

  placeholderVisible = computed(() => this.resolved() && this.photoId() === null);

  private observer: IntersectionObserver | null = null;
  private subscription: Subscription | null = null;
  private changeSubscription: Subscription | null = null;

  constructor() {
    effect((onCleanup) => {
      const entityType = this.entityType();
      const entityId = this.entityId();

      this.photoId.set(null);
      this.resolved.set(false);
      this.disconnectObserver();
      this.unsubscribe();

      const runResolve = (): void => {
        this.unsubscribe();
        this.subscription = this.photosApi
          .list(0, 1, { entityType, entityId })
          .subscribe({
            next: (photos) => {
              this.photoId.set(photos[0]?.id ?? null);
              this.resolved.set(true);
            },
            error: () => {
              this.photoId.set(null);
              this.resolved.set(true);
            },
          });
      };

      const target = this.elementRef.nativeElement;
      if (typeof IntersectionObserver === 'undefined') {
        runResolve();
      } else {
        this.observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              this.disconnectObserver();
              runResolve();
              break;
            }
          },
          { rootMargin: '200px' },
        );
        this.observer.observe(target);
      }

      onCleanup(() => {
        this.disconnectObserver();
        this.unsubscribe();
      });
    }, { allowSignalWrites: true });

    this.changeSubscription = this.photoEvents.changes$.subscribe(() => {
      if (!this.resolved()) return;
      const entityType = this.entityType();
      const entityId = this.entityId();
      this.unsubscribe();
      this.subscription = this.photosApi
        .list(0, 1, { entityType, entityId })
        .subscribe({
          next: (photos) => {
            this.photoId.set(photos[0]?.id ?? null);
            this.resolved.set(true);
          },
          error: () => {
            this.photoId.set(null);
            this.resolved.set(true);
          },
        });
    });
  }

  ngOnDestroy(): void {
    this.disconnectObserver();
    this.unsubscribe();
    this.changeSubscription?.unsubscribe();
    this.changeSubscription = null;
  }

  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private unsubscribe(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}