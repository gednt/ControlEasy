import { ComponentFixture, TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CePhotoPanelComponent } from './photo-panel.component';
import { PhotosApiService, type PhotoResponse } from '../../../features/photos/photos-api.service';
import { ToastService } from '../..';
import { CE_LUCIDE_ICONS } from '../icon/icon.registry';

describe('CePhotoPanelComponent', () => {
  let fixture: ComponentFixture<CePhotoPanelComponent>;
  let component: CePhotoPanelComponent;
  let photosApiSpy: jasmine.SpyObj<PhotosApiService>;

  const mockPhoto1: PhotoResponse = {
    id: 'p-1',
    tenantId: 'tenant-1',
    filePath: '/photos/p-1.jpg',
    thumbnailPath: null,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    capturedAtUtc: null,
    createdAtUtc: '2026-01-01T00:00:00Z',
    deletedAtUtc: null,
  };

  const mockPhoto2: PhotoResponse = {
    id: 'p-2',
    tenantId: 'tenant-1',
    filePath: '/photos/p-2.jpg',
    thumbnailPath: null,
    mimeType: 'image/png',
    sizeBytes: 2048,
    capturedAtUtc: null,
    createdAtUtc: '2026-01-02T00:00:00Z',
    deletedAtUtc: null,
  };

  beforeEach(async () => {
    photosApiSpy = jasmine.createSpyObj<PhotosApiService>('PhotosApiService', ['list', 'delete', 'get']);
    photosApiSpy.list.and.returnValue(of([mockPhoto1]));
    photosApiSpy.delete.and.returnValue(of(undefined));
    photosApiSpy.get.and.returnValue(of(new Blob(['photo'], { type: 'image/jpeg' })));

    await TestBed.configureTestingModule({
      imports: [CePhotoPanelComponent],
      providers: [
        importProvidersFrom(CE_LUCIDE_ICONS),
        { provide: PhotosApiService, useValue: photosApiSpy },
        {
          provide: ToastService,
          useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CePhotoPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('entityType', 'resident');
  });

  it('creates successfully with null entity without throwing signal write errors', () => {
    fixture.componentRef.setInput('entity', null);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.photos()).toEqual([]);
    expect(photosApiSpy.list).not.toHaveBeenCalled();
  });

  it('queries API when entity is provided and populates the photos signal', () => {
    fixture.componentRef.setInput('entity', { id: 'res-1', displayName: 'Resident One' });
    fixture.detectChanges();

    expect(photosApiSpy.list).toHaveBeenCalledWith(0, 50, { entityType: 'resident', entityId: 'res-1' });
    expect(component.photos()).toEqual([mockPhoto1]);
  });

  it('keeps previous photos when API list call fails', () => {
    photosApiSpy.list.and.returnValue(throwError(() => new Error('Network error')));

    fixture.componentRef.setInput('entity', { id: 'res-1', displayName: 'Resident One' });
    fixture.detectChanges();

    expect(component.photos()).toEqual([]);
  });

  it('updates photos signal when a photo is uploaded', () => {
    fixture.componentRef.setInput('entity', { id: 'res-1', displayName: 'Resident One' });
    fixture.detectChanges();

    component.onPhotoUploaded(mockPhoto2);
    expect(component.photos()).toContain(mockPhoto2);
    expect(component.photos().map((p) => p.id)).toEqual([mockPhoto2.id, mockPhoto1.id]);
  });

  it('deletes photo, calls api, and updates signal', async () => {
    fixture.componentRef.setInput('entity', { id: 'res-1', displayName: 'Resident One' });
    fixture.detectChanges();

    await component.onPhotoDeleted('p-1');

    expect(photosApiSpy.delete).toHaveBeenCalledWith('p-1');
    expect(component.photos().find((p) => p.id === 'p-1')).toBeUndefined();
  });
});