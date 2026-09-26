import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import type { PhotoEntityType } from './photos-api.service';

/**
 * Tenant-scoped, in-memory broadcast channel for photo-collection mutations.
 *
 * Any component that uploads or deletes a photo MUST call `notifyChange(...)`
 * so list cells (`ce-photo-thumb`) and panels that own a cached snapshot can
 * invalidate their cache and re-fetch. Subscribers receive the entity
 * discriminator; consumers re-fetch the entity they care about regardless of
 * whether it matches (an upload to one row affects every cell's
 * `IntersectionObserver` resolve cycle, and a delete to a different entity
 * is harmless).
 */
export interface PhotoChangeEvent {
  entityType: PhotoEntityType;
  entityId: string;
  kind: 'upload' | 'delete';
}

@Injectable({ providedIn: 'root' })
export class PhotoEventsService {
  private readonly subject = new Subject<PhotoChangeEvent>();

  readonly changes$: Observable<PhotoChangeEvent> = this.subject.asObservable();

  notifyChange(event: PhotoChangeEvent): void {
    this.subject.next(event);
  }
}