import { ComponentFixture, TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { of } from 'rxjs';
import { CePhotoLightboxComponent } from './photo-lightbox.component';
import { PhotosApiService, type PhotoResponse } from '../../../features/photos/photos-api.service';
import { CE_LUCIDE_ICONS } from '../icon/icon.registry';

function makePhoto(id: string): PhotoResponse {
  return {
    id,
    tenantId: 'tenant-1',
    filePath: `/photos/${id}.jpg`,
    thumbnailPath: null,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    capturedAtUtc: '2026-09-12T10:00:00Z',
    createdAtUtc: '2026-09-12T10:00:00Z',
    deletedAtUtc: null,
  };
}

describe('CePhotoLightboxComponent', () => {
  let fixture: ComponentFixture<CePhotoLightboxComponent>;
  let component: CePhotoLightboxComponent;
  let photosApi: jasmine.SpyObj<PhotosApiService>;

  beforeEach(async () => {
    photosApi = jasmine.createSpyObj<PhotosApiService>('PhotosApiService', ['get']);
    photosApi.get.and.returnValue(of(new Blob(['photo'], { type: 'image/jpeg' })));
    await TestBed.configureTestingModule({
      imports: [CePhotoLightboxComponent],
      providers: [importProvidersFrom(CE_LUCIDE_ICONS), { provide: PhotosApiService, useValue: photosApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(CePhotoLightboxComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('photos', [makePhoto('a'), makePhoto('b'), makePhoto('c')]);
    fixture.componentRef.setInput('startIndex', 0);
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('does not render overlay when open=false', () => {
    expect(fixture.nativeElement.querySelector('.lightbox-overlay')).toBeNull();
  });

  it('renders overlay when open=true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lightbox-overlay')).toBeTruthy();
  });

  it('loads the selected source through the authenticated photo service', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(photosApi.get).toHaveBeenCalledWith('a');
    expect(fixture.nativeElement.querySelector('ce-photo.lightbox-image')).toBeTruthy();
  });

  it('shows prev/next buttons only when multiple photos', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nav-btn.prev')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.nav-btn.next')).toBeTruthy();

    fixture.componentRef.setInput('photos', [makePhoto('only')]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nav-btn.prev')).toBeNull();
    expect(fixture.nativeElement.querySelector('.nav-btn.next')).toBeNull();
  });

  it('starts at startIndex when photos are set', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('startIndex', 2);
    fixture.detectChanges();
    expect(component.currentIndex()).toBe(2);
    expect(component.currentPhoto()?.id).toBe('c');
  });

  it('next() cycles and wraps around', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    component.currentIndex.set(2);
    component.next();
    expect(component.currentIndex()).toBe(0);
    component.next();
    expect(component.currentIndex()).toBe(1);
  });

  it('prev() cycles and wraps around', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    component.prev();
    expect(component.currentIndex()).toBe(2);
    component.prev();
    expect(component.currentIndex()).toBe(1);
  });

  it('emits closed when backdrop is clicked', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let closed = false;
    component.closed.subscribe(() => (closed = true));
    component.onBackdropClick();
    expect(closed).toBe(true);
  });

  it('does NOT close when the photo container is clicked', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let closed = false;
    component.closed.subscribe(() => (closed = true));
    const ev = new Event('click');
    component.stop(ev);
    expect(closed).toBe(false);
  });

  it('emits photoDeleted when Delete is clicked', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('canDelete', true);
    fixture.detectChanges();
    let deletedId: string | null = null;
    component.photoDeleted.subscribe((id: string) => (deletedId = id));
    component.onDelete(new Event('click'));
    expect(deletedId as string | null).toBe('a');
  });

  it('does not render delete button when canDelete is false', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('canDelete', false);
    fixture.detectChanges();
    // No ce-button host with text Delete is rendered
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const hasDelete = Array.from(buttons).some((b) => b.textContent?.toLowerCase().includes('delete'));
    expect(hasDelete).toBe(false);
  });

  it('falls back gracefully with empty photos array', () => {
    fixture.componentRef.setInput('photos', []);
    fixture.detectChanges();
    expect(component.currentPhoto()).toBeNull();
    expect(component.hasMultiple()).toBe(false);
  });
});
