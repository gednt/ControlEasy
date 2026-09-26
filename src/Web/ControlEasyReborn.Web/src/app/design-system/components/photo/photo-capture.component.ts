import {
  AfterViewInit,
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
  viewChild,
} from '@angular/core';
import { CeModalComponent } from '../modal/modal.component';
import { CeButtonComponent } from '../button/button.component';
import { CeIconComponent } from '../icon/icon.component';
import { CeSpinnerComponent } from '../spinner/spinner.component';
import { ToastService } from '../toast/toast.component';
import { PhotosApiService, type PhotoResponse } from '../../../features/photos/photos-api.service';
import {
  compressImage,
  DEFAULT_COMPRESSION,
  DEFAULT_RETRY,
  isTransientUploadError,
  uploadWithRetry,
} from '../../../features/photos/photo-utils';
import type { PhotoEntityType as PhotoEntityTypeArg } from '../../../features/photos/photos-api.service';
import { getApiErrorMessage } from '../../../core/utils/api-error.util';

type Mode = 'camera' | 'upload';
type Status = 'idle' | 'previewing' | 'capturing' | 'compressing' | 'uploading' | 'error';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Idle',
  previewing: 'Preview',
  capturing: 'Capturing',
  compressing: 'Compressing',
  uploading: 'Uploading',
  error: 'Error',
};

/**
 * Photo capture modal — two modes (camera + upload). On confirm, runs the
 * compression ladder, uploads via retry, and emits photoUploaded on success.
 * Errors surface as toasts (never modal-block).
 */
@Component({
  selector: 'ce-photo-capture',
  standalone: true,
  imports: [CeModalComponent, CeButtonComponent, CeIconComponent, CeSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ce-modal [open]="open()" [title]="title()" size="md" (closed)="close()">
      <div class="capture-modal" [class.camera-mode]="effectiveMode() === 'camera'">
        @if (effectiveMode() === 'camera') {
          <div class="video-container">
            <video #video autoplay playsinline muted aria-label="Camera preview"></video>
            @if (status() === 'capturing') {
              <div class="shutter-flash"></div>
            }
            @if (status() === 'idle' || status() === 'previewing') {
              <div class="camera-status">
                <ce-spinner size="sm" tone="current" />
                <span>{{ cameraStatusLabel() }}</span>
              </div>
            }
          </div>
        } @else {
          <div
            class="upload-zone"
            (dragover)="onDragOver($event)"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
            role="button"
            tabindex="0"
          >
            @if (selectedFile(); as file) {
              <img [src]="previewUrl()" alt="Selected photo preview" />
              <button type="button" class="remove-link" (click)="removeFile($event)">Remove</button>
            } @else {
              <ce-icon name="upload" [size]="32" />
              <p class="upload-zone-text">Drag photo here or click to browse</p>
              <small class="upload-zone-hint">JPEG, PNG, HEIC (up to 8 MB)</small>
            }
            <input
              #fileInput
              type="file"
              hidden
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              (change)="onFileSelected($event)"
            />
          </div>
        }

        @if (status() === 'compressing' || status() === 'uploading') {
          <div class="progress-strip" role="status" aria-live="polite">
            <ce-spinner size="sm" tone="primary" />
            <span>
              {{ status() === 'compressing' ? 'Compressing' : 'Uploading' }}
              @if (status() === 'uploading' && retryAttempt() > 0) {
                (retry {{ retryAttempt() }}/3)
              }
            </span>
          </div>
        }
      </div>

      <div ce-modal-footer class="footer">
        @if (effectiveMode() === 'camera') {
          <ce-button variant="ghost" size="sm" (click)="close()">Cancel</ce-button>
          <button
            type="button"
            class="capture-btn"
            aria-label="Capture photo"
            (click)="capture()"
            [disabled]="status() !== 'previewing'"
          >
            <ce-icon name="camera" [size]="28" />
          </button>
          <ce-button variant="ghost" size="sm" (click)="switchMode('upload')"> Or upload from device </ce-button>
        } @else {
          <ce-button variant="ghost" size="sm" (click)="close()">Cancel</ce-button>
          <ce-button
            variant="primary"
            size="sm"
            [disabled]="!selectedFile() || isWorking()"
            [loading]="status() === 'uploading' || status() === 'compressing'"
            (click)="upload()"
          >
            Upload
          </ce-button>
        }
      </div>
    </ce-modal>
  `,
  styles: [
    `
      .capture-modal {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
      }
      .video-container {
        aspect-ratio: 4 / 3;
        width: 100%;
        background: black;
        position: relative;
        border-radius: var(--radius-md, 4px);
        overflow: hidden;
      }
      .video-container video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .shutter-flash {
        position: absolute;
        inset: 0;
        background: white;
        opacity: 0.8;
        animation: ce-photo-flash 200ms ease-out forwards;
      }
      @keyframes ce-photo-flash {
        to {
          opacity: 0;
        }
      }
      .camera-status {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-2, 8px);
        background: rgba(0, 0, 0, 0.4);
        color: white;
        font-size: var(--font-size-sm, 14px);
      }
      .upload-zone {
        min-height: 240px;
        border: 2px dashed var(--color-border);
        border-radius: var(--radius-md, 4px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-2, 8px);
        cursor: pointer;
        padding: var(--space-4, 16px);
        color: var(--color-text-muted);
      }
      .upload-zone:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .upload-zone img {
        max-width: 100%;
        max-height: 200px;
        border-radius: var(--radius-md, 4px);
      }
      .upload-zone-text {
        margin: 0;
      }
      .upload-zone-hint {
        color: var(--color-text-muted);
        font-size: var(--font-size-xs, 12px);
      }
      .remove-link {
        color: var(--color-danger);
        background: none;
        border: 0;
        cursor: pointer;
        font-size: var(--font-size-sm, 14px);
        text-decoration: underline;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3, 12px);
        width: 100%;
      }
      .capture-btn {
        width: 64px;
        height: 64px;
        border-radius: var(--radius-full, 50%);
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        border: 0;
        cursor: pointer;
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity var(--duration-fast, 150ms) var(--ease-out, ease-out);
      }
      .capture-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .progress-strip {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        padding: var(--space-2, 8px);
        background: var(--color-surface-muted);
        border-radius: var(--radius-md, 4px);
        font-size: var(--font-size-sm, 14px);
      }
      @media (prefers-reduced-motion: reduce) {
        .shutter-flash {
          animation: none;
        }
      }
    `,
  ],
})
export class CePhotoCaptureComponent implements AfterViewInit, OnDestroy {
  private readonly photosApi = inject(PhotosApiService);
  private readonly toast = inject(ToastService);

  // Phase 12 deviation: the backend has no entity binding. We keep the inputs
  // so consumer call-sites are stable when the backend grows the column.
  // The id/type are forwarded to the upload pipeline once binding ships.
  entityType = input.required<PhotoEntityTypeArg>();
  entityId = input.required<string>();
  mode = input<Mode>('camera');
  open = input<boolean>(false);

  /**
   * Local override for `mode` so a click on "Or upload from device" flips the
   * visible UI immediately, even if the parent does not bind `[mode]` from
   * `(modeChange)`. The parent may still opt into a controlled flow.
   */
  private readonly modeOverride = signal<Mode | null>(null);
  readonly effectiveMode = computed<Mode>(() => this.modeOverride() ?? this.mode());

  photoUploaded = output<PhotoResponse>();
  closed = output<void>();
  modeChange = output<Mode>();

  status = signal<Status>('idle');
  retryAttempt = signal(0);
  selectedFile = signal<Blob | null>(null);
  private readonly previewObjectUrl = signal<string | null>(null);

  previewUrl = computed(() => this.previewObjectUrl() ?? '');
  title = computed(() => (this.effectiveMode() === 'camera' ? 'Take photo' : 'Upload photo'));
  cameraStatusLabel = computed(() => STATUS_LABEL[this.status()]);
  isWorking = computed(() => this.status() === 'uploading' || this.status() === 'compressing');

  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private cameraStarted = false;

  // Re-render viewchild template refs in case Angular template parser complains
  // when they are unused inline; declared via signal-style viewChild.
  readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
  readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    // Lifecycle: when the modal opens in camera mode, request the camera.
    // When it closes, tear down. allowSignalWrites is required because
    // stopCamera() resets internal signal-driven flags via tear-down.
    effect(
      () => {
        const isOpen = this.open();
        const m = this.mode();
        if (!isOpen) {
          this.stopCamera();
          this.cameraStarted = false;
          return;
        }
        if (m === 'camera' && !this.cameraStarted) {
          // Defer to next microtask so the @ViewChild is resolved.
          queueMicrotask(() => void this.startCamera());
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngAfterViewInit(): void {
    // viewChild signal is wired in case consumers need programmatic access.
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokePreview();
  }

  async startCamera(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.toast.warning('Camera not available. Switching to upload mode.');
      this.switchMode('upload');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      const videoEl =
        this.videoRef()?.nativeElement ?? (document.querySelector('.video-container video') as HTMLVideoElement | null);
      if (videoEl) {
        videoEl.srcObject = this.stream;
        this.videoElement = videoEl;
        // Some browsers require an explicit play() to start the stream after srcObject assignment
        await videoEl.play().catch(() => undefined);
      }
      this.cameraStarted = true;
      this.status.set('previewing');
    } catch (err) {
      console.warn('[ce-photo-capture] getUserMedia failed', err);
      this.toast.warning('Camera access denied. Switching to upload mode.');
      this.switchMode('upload');
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    this.stream = null;
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.videoElement = null;
  }

  async capture(): Promise<void> {
    const video = this.videoElement;
    if (!video || this.status() !== 'previewing') return;
    this.status.set('capturing');
    try {
      const file = await this.captureFrame(video);
      // Hold the shutter flash for 200ms before using the exact same
      // compression and multipart path as a file chosen from the device.
      setTimeout(() => void this.processBlob(file), 200);
    } catch {
      this.toast.error('Unable to capture a photo from this camera. Please upload an image instead.');
      this.status.set('error');
    }
  }

  private async captureFrame(video: HTMLVideoElement): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(new File([blob], this.fileName(), { type: 'image/jpeg', lastModified: Date.now() }))
            : reject(new Error('CANVAS_TO_BLOB_FAILED')),
        'image/jpeg',
        0.95,
      );
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.acceptFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.acceptFile(file);
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
    this.revokePreview();
  }

  isValidType(file: File): boolean {
    // Some browsers omit the type for HEIC; fall back to extension sniff.
    if (file.type && ACCEPTED_MIME_TYPES.includes(file.type)) return true;
    const name = file.name.toLowerCase();
    return (
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.heic') ||
      name.endsWith('.heif') ||
      name.endsWith('.webp')
    );
  }

  private acceptFile(file: File): void {
    if (!this.isValidType(file)) {
      this.toast.error('File type not supported. Use JPEG, PNG, or HEIC.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.toast.error('Photo too large to upload. Try a smaller photo.');
      return;
    }
    this.selectedFile.set(file);
    this.revokePreview();
    this.previewObjectUrl.set(URL.createObjectURL(file));
  }

  private revokePreview(): void {
    const url = this.previewObjectUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewObjectUrl.set(null);
  }

  switchMode(mode: Mode): void {
    if (mode === 'upload') this.stopCamera();
    this.modeOverride.set(mode);
    this.modeChange.emit(mode);
  }

  async upload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;
    await this.processBlob(file);
  }

  private async processBlob(blob: Blob): Promise<void> {
    this.status.set('compressing');
    let compressed: Blob;
    try {
      compressed = await compressImage(blob, DEFAULT_COMPRESSION);
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'FILE_TOO_LARGE_AFTER_COMPRESSION'
          ? 'Photo too large to upload. Try a smaller photo.'
          : 'Failed to compress photo.';
      this.toast.error(msg);
      this.status.set('error');
      return;
    }

    this.status.set('uploading');
    this.retryAttempt.set(0);
    try {
      const photo = await uploadWithRetry(
        () => {
          this.retryAttempt.update((n) => n + 1);
          return this.photosApi.upload(compressed, this.fileName(), {
            entityType: this.entityType(),
            entityId: this.entityId(),
            capturedAtUtc: new Date().toISOString(),
          });
        },
        DEFAULT_RETRY,
        isTransientUploadError,
      );
      this.toast.success('Photo uploaded');
      this.photoUploaded.emit(photo);
      this.reset();
      this.closed.emit();
    } catch (err) {
      console.error('[ce-photo-capture] upload failed', err);
      this.toast.error(getApiErrorMessage(err, 'Upload failed. Check your connection and try again.'));
      this.status.set('error');
    }
  }

  close(): void {
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.stopCamera();
    this.revokePreview();
    this.selectedFile.set(null);
    this.retryAttempt.set(0);
    this.status.set('idle');
  }

  private fileName(): string {
    const id = this.entityId();
    const type = this.entityType();
    return `${type}-${id}-${Date.now()}.jpg`;
  }
}

// Phase 12 deviation: backend doesn't bind entityType yet, so the consumer
// passes it for forward compatibility. Local re-export from api service.
