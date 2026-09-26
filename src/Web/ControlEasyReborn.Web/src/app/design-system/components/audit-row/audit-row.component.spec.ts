import { ComponentFixture, TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { of } from 'rxjs';
import { CeAuditRowComponent } from './audit-row.component';
import { CE_LUCIDE_ICONS } from '../icon/icon.registry';
import { PhotosApiService } from '../../../features/photos/photos-api.service';
import type { EntryLogResponse, EntryState } from '../../../features/entry-log/entry-log.service';

describe('CeAuditRowComponent', () => {
  let fixture: ComponentFixture<CeAuditRowComponent>;
  let component: CeAuditRowComponent;

  const baseEntry: EntryLogResponse = {
    id: 'e-1',
    tenantId: 't-1',
    entryState: 'entered_with_consent' as EntryState,
    subjectType: 'visitor',
    subjectName: 'Jane Doe',
    photoId: 'p-1',
    recordedAt: '2026-02-15T14:30:00.123Z',
    performedByProfileId: 'profile-1',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeAuditRowComponent],
      providers: [
        importProvidersFrom(CE_LUCIDE_ICONS),
        { provide: PhotosApiService, useValue: { get: () => of(new Blob(['photo'], { type: 'image/jpeg' })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CeAuditRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('entry', baseEntry);
    fixture.detectChanges();
  });

  it('renders the subject name', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Jane Doe');
  });

  it('renders the entry-state badge', () => {
    const badge: HTMLElement | null = fixture.nativeElement.querySelector('ce-entry-state-badge');
    expect(badge).toBeTruthy();
  });

  it('shows a photo for entries with photoId', () => {
    const photo = fixture.nativeElement.querySelector('ce-photo');
    expect(photo).toBeTruthy();
  });

  it('shows em-dash placeholder when no photoId', () => {
    fixture.componentRef.setInput('entry', {
      ...baseEntry,
      photoId: undefined,
    });
    fixture.detectChanges();
    const photo = fixture.nativeElement.querySelector('ce-photo');
    expect(photo).toBeNull();
    const noPhoto = fixture.nativeElement.querySelector('.no-photo');
    expect(noPhoto).toBeTruthy();
    expect(noPhoto.textContent).toContain('—');
  });

  it('applies override-row class only when entryState is entered_override', () => {
    fixture.componentRef.setInput('entry', {
      ...baseEntry,
      entryState: 'entered_override',
      overrideReason: 'emergency',
    });
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('tr');
    expect(row.classList.contains('override-row')).toBe(true);
  });

  it('does NOT apply override-row class for other states', () => {
    fixture.componentRef.setInput('entry', {
      ...baseEntry,
      entryState: 'entered_without_consent',
    });
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('tr');
    expect(row.classList.contains('override-row')).toBe(false);
  });

  it('exposes a photoClicked output that can be subscribed', () => {
    const clicked = jasmine.createSpy('clicked');
    component.photoClicked.subscribe(clicked);
    fixture.componentRef.setInput('entry', baseEntry);
    fixture.detectChanges();
    // The OutputEmitterRef is created and accepts subscribers. We assert
    // by binding a subscriber without error.
    expect(typeof component.photoClicked.subscribe).toBe('function');
  });

  it('formats subject type with leading capital', () => {
    expect(component.subjectTypeLabel()).toBe('Visitor');
    fixture.componentRef.setInput('entry', {
      ...baseEntry,
      subjectType: 'service_provider',
    });
    fixture.detectChanges();
    expect(component.subjectTypeLabel()).toBe('Service provider');
  });

  it('renders the resolved porteiro name when supplied, never the raw GUID', () => {
    fixture.componentRef.setInput('entry', {
      ...baseEntry,
      performedByProfileId: '11111111-1111-1111-1111-111111111111',
    });
    fixture.componentRef.setInput('porteiroName', 'Synthetic Porteiro One');
    fixture.detectChanges();

    const porteiroCell = fixture.nativeElement.querySelector('.cell-porteiro') as HTMLElement;
    expect(porteiroCell.textContent).toContain('Synthetic Porteiro One');
    expect(porteiroCell.textContent).not.toContain('11111111-1111-1111-1111-111111111111');
  });

  it('falls back to em-dash when porteiroName is not supplied', () => {
    fixture.componentRef.setInput('entry', {
      ...baseEntry,
      performedByProfileId: '22222222-2222-2222-2222-222222222222',
    });
    fixture.componentRef.setInput('porteiroName', undefined);
    fixture.detectChanges();

    const porteiroCell = fixture.nativeElement.querySelector('.cell-porteiro') as HTMLElement;
    expect(porteiroCell.textContent?.trim()).toBe('—');
    expect(porteiroCell.textContent).not.toContain('22222222-2222-2222-2222-222222222222');
  });

  it('still applies the override-row highlight when entryState is entered_override and porteiroName is set', () => {
    fixture.componentRef.setInput('entry', {
      ...baseEntry,
      entryState: 'entered_override',
      overrideReason: 'emergency',
    });
    fixture.componentRef.setInput('porteiroName', 'Synthetic Porteiro Two');
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('tr');
    expect(row.classList.contains('override-row')).toBe(true);
    const reasonCell = fixture.nativeElement.querySelectorAll('td')[5] as HTMLElement;
    expect(reasonCell.textContent).toContain('emergency');
    const porteiroCell = fixture.nativeElement.querySelector('.cell-porteiro') as HTMLElement;
    expect(porteiroCell.textContent).toContain('Synthetic Porteiro Two');
  });
});
