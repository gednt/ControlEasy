import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CePhotoComponent } from './photo.component';
import { PhotosApiService } from '../../../features/photos/photos-api.service';

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
      ? Array.isArray(options.threshold)
        ? options.threshold
        : [options.threshold]
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

describe('CePhotoComponent', () => {
  let fixture: ComponentFixture<CePhotoComponent>;
  let component: CePhotoComponent;
  let photosApiGetSpy: jasmine.Spy;

  beforeEach(async () => {
    photosApiGetSpy = jasmine.createSpy('get').and.returnValue(of(new Blob(['photo'], { type: 'image/jpeg' })));

    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;

    await TestBed.configureTestingModule({
      imports: [CePhotoComponent],
      providers: [{ provide: PhotosApiService, useValue: { get: photosApiGetSpy } }],
    }).compileComponents();

    fixture = TestBed.createComponent(CePhotoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('photoId', 'photo-1');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    FakeIntersectionObserver.restore();
  });

  it('creates with default size "thumbnail"', () => {
    expect(component.size()).toBe('thumbnail');
    expect(component.displaySize()).toBe(128);
  });

  it('renders the loading skeleton before the image loads', () => {
    const skeleton: HTMLElement = fixture.nativeElement.querySelector('.ce-photo-skeleton');
    expect(skeleton).toBeTruthy();
    expect(skeleton.style.width).toBe('128px');
    expect(skeleton.style.height).toBe('128px');
  });

  it('renders an <img> element once load fires', () => {
    component.onLoad();
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.src).toContain('blob:');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('uses object-fit: cover to crop the source blob to displaySize', () => {
    component.onLoad();
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('width')).toBe('128');
    expect(img.getAttribute('height')).toBe('128');
  });

  it('emits photoClicked only when clickable is true', () => {
    component.onLoad();
    fixture.detectChanges();
    let clicked = false;
    component.photoClicked.subscribe(() => (clicked = true));
    fixture.componentRef.setInput('clickable', false);
    fixture.detectChanges();
    component.onClick();
    expect(clicked).toBe(false);

    fixture.componentRef.setInput('clickable', true);
    fixture.detectChanges();
    component.onClick();
    expect(clicked).toBe(true);
  });

  it('transitions to error placeholder on broken URL', () => {
    component.onError();
    fixture.detectChanges();
    const errEl: HTMLElement = fixture.nativeElement.querySelector('.ce-photo-error');
    expect(errEl).toBeTruthy();
    expect(errEl.textContent).toContain('?');
  });

  it('returns 800px displaySize when size="source"', () => {
    fixture.componentRef.setInput('size', 'source');
    fixture.detectChanges();
    expect(component.displaySize()).toBe(800);
  });

  it('honours pixelSize override', () => {
    fixture.componentRef.setInput('pixelSize', 256);
    fixture.detectChanges();
    expect(component.displaySize()).toBe(256);
  });

  it('fetches eagerly by default (lazy=false)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(photosApiGetSpy).toHaveBeenCalledWith('photo-1');
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it('defers the authenticated blob fetch until near-viewport when lazy=true', async () => {
    photosApiGetSpy.calls.reset();
    fixture.componentRef.setInput('lazy', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(photosApiGetSpy).not.toHaveBeenCalled();
    const observer = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
    expect(observer).toBeTruthy();
    expect(observer!.rootMargin).toBe('200px');
    expect(observer!.observed.length).toBe(1);

    observer!.triggerIntersect(observer!.observed[0]!);
    expect(photosApiGetSpy).toHaveBeenCalledWith('photo-1');
  });
});
