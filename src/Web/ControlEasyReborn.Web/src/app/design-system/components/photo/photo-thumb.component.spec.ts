import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CePhotoThumbComponent } from './photo-thumb.component';
import { CePhotoComponent } from './photo.component';
import { PhotoResponse, PhotosApiService } from '../../../features/photos/photos-api.service';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  static restore(): void {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
    FakeIntersectionObserver.instances = [];
  }
  readonly observed: Element[] = [];
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? '';
    this.thresholds = options?.threshold
      ? (Array.isArray(options.threshold) ? options.threshold : [options.threshold])
      : [0];
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {
    /* no-op */
  }

  disconnect(): void {
    /* no-op */
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  readonly root: Element | Document | null = null;

  triggerIntersect(target: Element, isIntersecting = true): void {
    this.callback(
      [
        {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          target,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

const basePhoto: PhotoResponse = {
  id: 'photo-1',
  tenantId: 'tenant-1',
  filePath: '/photos/photo-1.jpg',
  thumbnailPath: null,
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  capturedAtUtc: null,
  createdAtUtc: '2026-01-01T00:00:00Z',
  deletedAtUtc: null,
};

describe('CePhotoThumbComponent', () => {
  let fixture: ComponentFixture<CePhotoThumbComponent>;
  let component: CePhotoThumbComponent;
  let photosApiListSpy: jasmine.Spy;

  beforeEach(async () => {
    photosApiListSpy = jasmine.createSpy('list').and.returnValue(of([basePhoto]));

    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;

    await TestBed.configureTestingModule({
      imports: [CePhotoThumbComponent],
      providers: [{ provide: PhotosApiService, useValue: { list: photosApiListSpy, get: () => of(new Blob()) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(CePhotoThumbComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('entityType', 'resident');
    fixture.componentRef.setInput('entityId', 'res-1');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    FakeIntersectionObserver.restore();
  });

  it('does not call list before the host intersects the viewport', () => {
    expect(photosApiListSpy).not.toHaveBeenCalled();
    const observer = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
    expect(observer).toBeTruthy();
    expect(observer!.rootMargin).toBe('200px');
  });

  it('resolves entity → most-recent photo id via photosApi.list after intersection', async () => {
    const observer = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1]!;
    observer.triggerIntersect(observer.observed[0]!);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(photosApiListSpy).toHaveBeenCalledWith(0, 1, { entityType: 'resident', entityId: 'res-1' });
    expect(component.photoId()).toBe('photo-1');
    expect(component.placeholderVisible()).toBe(false);

    fixture.detectChanges();
    const cePhoto: HTMLElement = fixture.nativeElement.querySelector('ce-photo');
    expect(cePhoto).toBeTruthy();
  });

  it('renders a placeholder (and emits nothing) when the entity has no photos', async () => {
    photosApiListSpy.and.returnValue(of([]));
    fixture.detectChanges();
    await fixture.whenStable();
    const observer = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1]!;
    observer.triggerIntersect(observer.observed[0]!);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.photoId()).toBeNull();
    expect(component.placeholderVisible()).toBe(true);

    fixture.detectChanges();
    const cePhoto: HTMLElement | null = fixture.nativeElement.querySelector('ce-photo');
    const placeholder: HTMLElement | null = fixture.nativeElement.querySelector('.ce-photo-thumb-placeholder');
    expect(cePhoto).toBeFalsy();
    expect(placeholder).toBeTruthy();
  });
});