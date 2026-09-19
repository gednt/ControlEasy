import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { GatewayControlService } from './gateway-control.service';
import { AccessScanResultComponent } from './components/access-scan-result.component';
import { ScanResult, ScanRefusal } from './access-control.types';

interface UiState {
  qrPayload: string;
  direction: 'entrance' | 'exit';
  busy: boolean;
  result: ScanResult | null;
  refusal: ScanRefusal | null;
  error: string | null;
  cameraStatus: 'idle' | 'starting' | 'active' | 'unavailable';
}

const SCAN_SUPPRESSION_WINDOW_MS = 3000;
const CAMERA_RETRY_LIMIT = 5;
const CAMERA_RETRY_DELAY_MS = 1500;
const REARM_DELAY_MS = 250;
const PAYLOAD_MIN_LENGTH = 8;
const PAYLOAD_MAX_LENGTH = 1024;

const CAMERA_PERMISSION_DENIED = 'Camera permission denied. Use the text input below to paste the QR value.';
const NO_CAMERA = 'No camera detected — paste the QR value below.';
const CAMERA_IN_USE = 'Camera is in use by another app. Close it and reload, or paste the QR value below.';
const CAMERA_START_FAILED = 'Could not start the camera. Use the text input below to paste the QR value.';

const initialState = (): UiState => ({
  qrPayload: '',
  direction: 'entrance',
  busy: false,
  result: null,
  refusal: null,
  error: null,
  cameraStatus: 'idle',
});

function cryptoRandom(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    const v6 = b[6] ?? 0;
    const v8 = b[8] ?? 0;
    b[6] = (v6 & 0x0f) | 0x40;
    b[8] = (v8 & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

@Component({
  selector: 'ce-qr-scan-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AccessScanResultComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .qr-camera {
        position: relative;
        width: 100%;
        max-width: 480px;
        aspect-ratio: 1 / 1;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        margin: 0.75rem 0;
      }
      .qr-camera.is-hidden {
        display: none;
      }
      .qr-camera-video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.2s ease-in-out;
      }
      .qr-camera-video.is-mirrored {
        transform: scaleX(-1);
      }
      .camera-flip-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 10;
        background: rgba(0, 0, 0, 0.65);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 0.75rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        backdrop-filter: blur(4px);
        font-weight: 500;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .camera-flip-btn:hover {
        background: rgba(0, 0, 0, 0.85);
        border-color: rgba(255, 255, 255, 0.6);
      }
      .qr-camera-reticle {
        position: absolute;
        inset: 18%;
        border: 2px solid rgba(255, 255, 255, 0.7);
        border-radius: 12px;
        pointer-events: none;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25);
      }
      .qr-camera-status {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
        margin: 0;
        font-size: 0.95rem;
      }
      .qr-scan-page .error {
        color: #b00020;
        background: #fdecea;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        margin: 0.5rem 0;
      }
      .qr-scan-page .busy-hint {
        font-size: 0.85rem;
        color: #666;
        margin: 0.25rem 0;
      }
      .scan-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .field-title {
        font-weight: 600;
        font-size: 0.875rem;
      }
      .field-help {
        font-size: 0.75rem;
        color: #64748b;
      }
      .manual-fallback-hint {
        margin-top: 0.75rem;
        padding: 0.5rem 0.75rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .manual-lookup-link {
        color: #2c5cdc;
        font-weight: 600;
        text-decoration: underline;
      }
    `,
  ],
  template: `
    <section class="qr-scan-page">
      <h2>QR Scan</h2>
      <p class="hint">Point the camera at the credential QR. The raw QR is never stored.</p>

      <div class="qr-camera" [class.is-hidden]="!showCameraPanel()" data-testid="qr-camera-panel">
        <video #video class="qr-camera-video" [class.is-mirrored]="isMirrored()" playsinline muted></video>
        @if (showCameraPanel()) {
          <div class="qr-camera-reticle" aria-hidden="true"></div>
          @if (state().cameraStatus === 'starting') {
            <p class="qr-camera-status" role="status" aria-live="polite">Starting camera…</p>
          }
          <button
            type="button"
            class="camera-flip-btn"
            (click)="toggleMirror()"
            title="Invert camera horizontally"
            aria-label="Invert camera horizontally"
          >
            ⇄ Flip camera
          </button>
        }
      </div>

      @if (state().error) {
        <div class="error" role="alert" data-testid="qr-camera-error">{{ state().error }}</div>
      }

      <form (ngSubmit)="submit()" novalidate class="scan-form">
        <label class="field-group">
          <span class="field-title">Or enter QR credential token or UUID manually</span>
          <span class="field-help"
            >Enter the cryptographic access pass token or the active Subject / Credential UUID.</span
          >
          <input
            name="qrPayload"
            type="text"
            [ngModel]="state().qrPayload"
            (ngModelChange)="onQrPayloadChange($event)"
            placeholder="Paste QR token or Subject UUID..."
            autocomplete="off"
            required
            [maxlength]="1024"
            data-testid="qr-payload-input"
          />
        </label>
        <label class="field-group">
          <span class="field-title">Direction</span>
          <select name="direction" [ngModel]="state().direction" (ngModelChange)="onDirectionChange($event)">
            <option value="entrance">Entrance</option>
            <option value="exit">Exit</option>
          </select>
        </label>
        <button type="submit" [disabled]="state().busy || !state().qrPayload" data-testid="qr-submit-button">
          {{ state().busy ? 'Scanning...' : 'Submit scan' }}
        </button>
        @if (state().busy) {
          <p class="busy-hint" role="status" aria-live="polite" data-testid="qr-busy-hint">
            Already scanning — please wait.
          </p>
        }

        <div class="manual-fallback-hint">
          <span>Visitor or resident has no QR code?</span>
          <a routerLink="/gatehouse/manual" class="manual-lookup-link">Open Manual Lookup</a>
        </div>
      </form>

      <div aria-live="polite">
        @if (state().result) {
          <ce-access-scan-result
            [decision]="state().result!.decision"
            [subjectType]="state().result!.subjectType"
            [direction]="state().result!.direction"
            [destinationBlock]="state().result!.destinationBlock"
            [destinationUnit]="state().result!.destinationUnit"
          />
        } @else if (state().refusal) {
          <ce-access-scan-result [decision]="state().refusal!.decision" [failureCode]="state().refusal!.failureCode" />
        }
      </div>
    </section>
  `,
})
export class QrScanPage implements AfterViewInit, OnDestroy {
  private readonly gateway = inject(GatewayControlService);
  private readonly reader = new BrowserMultiFormatReader();
  private scannerControls: IScannerControls | null = null;
  private currentSessionId = 0;
  private rearmHandle: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private lastScannedPayload: string | null = null;
  private lastScannedAt = 0;
  private intentionalStopInProgress = false;
  private destroyed = false;

  @ViewChild('video', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;

  readonly isMirrored = signal(true);

  toggleMirror(): void {
    this.isMirrored.update((v) => !v);
  }

  readonly state = signal<UiState>(initialState());
  readonly showCameraPanel = computed(
    () => this.state().cameraStatus === 'starting' || this.state().cameraStatus === 'active',
  );

  ngAfterViewInit(): void {
    this.startScanner();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopScanner();
    if (this.rearmHandle !== null) {
      clearTimeout(this.rearmHandle);
      this.rearmHandle = null;
    }
    const videoEl = this.videoRef?.nativeElement;
    if (videoEl) {
      videoEl.srcObject = null;
      videoEl.load();
    }
  }

  submit(): void {
    if (this.destroyed) return;
    const current = this.state();
    if (!current.qrPayload || current.busy) return;
    const trimmed = current.qrPayload.trim();
    if (trimmed.length < PAYLOAD_MIN_LENGTH || trimmed.length > PAYLOAD_MAX_LENGTH) return;
    const scanAttemptId = cryptoRandom();
    this.currentSessionId += 1;
    this.state.set({ ...current, qrPayload: trimmed, busy: true, error: null, result: null, refusal: null });
    this.stopScanner();

    this.gateway
      .recordScan({
        qrPayload: trimmed,
        direction: current.direction,
        scanAttemptId,
      })
      .subscribe({
        next: (result: ScanResult) => {
          if (this.destroyed) return;
          this.armSuppression(trimmed);
          this.state.update((s) => ({ ...s, busy: false, result, refusal: null, qrPayload: '' }));
          this.scheduleRearm();
        },
        error: (err: { error?: { failureCode?: ScanRefusal['failureCode']; decision?: ScanRefusal['decision'] } }) => {
          if (this.destroyed) return;
          const problem = err?.error;
          const refusal: ScanRefusal | null =
            problem?.failureCode && problem?.decision
              ? { failureCode: problem.failureCode, decision: problem.decision }
              : null;
          if (refusal) {
            this.armSuppression(trimmed);
          }
          this.state.update((s) => ({
            ...s,
            busy: false,
            refusal,
            result: null,
            error: refusal ? null : 'Scan service unavailable.',
            qrPayload: refusal ? '' : s.qrPayload,
          }));
          if (!refusal) {
            this.armSuppression(trimmed);
          }
          this.scheduleRearm();
        },
      });
  }

  onQrPayloadChange(value: string): void {
    this.state.update((s) => ({ ...s, qrPayload: value }));
  }

  onDirectionChange(value: 'entrance' | 'exit'): void {
    this.state.update((s) => ({ ...s, direction: value }));
  }

  private startScanner(): void {
    if (this.destroyed) return;
    if (this.scannerControls || this.state().cameraStatus === 'unavailable') return;
    const videoEl = this.videoRef?.nativeElement;
    if (!videoEl) {
      this.state.update((s) => ({ ...s, cameraStatus: 'unavailable', error: NO_CAMERA }));
      return;
    }
    this.attachVideoLifecycleListeners(videoEl);
    this.state.update((s) => ({ ...s, cameraStatus: 'starting' }));
    const sessionId = this.currentSessionId;
    this.retryCount = 0;

    this.reader
      .decodeFromVideoDevice(undefined, videoEl, (result, _err, controls) => {
        if (this.destroyed || sessionId !== this.currentSessionId) {
          controls.stop();
          return;
        }
        this.scannerControls = controls;
        if (this.state().cameraStatus !== 'unavailable') {
          this.state.update((s) => ({ ...s, cameraStatus: 'active' }));
        }
        if (!result) {
          return;
        }
        if (this.state().busy) {
          return;
        }
        const text = result.getText();
        if (!text || text.length > PAYLOAD_MAX_LENGTH) return;
        const trimmed = text.trim();
        if (!trimmed || trimmed.length < PAYLOAD_MIN_LENGTH) return;
        if (this.isSuppressedRescan(trimmed)) return;
        this.state.update((s) => ({
          ...s,
          qrPayload: trimmed,
        }));
        this.submit();
      })
      .catch((err: unknown) => {
        if (this.destroyed || sessionId !== this.currentSessionId) return;
        this.handleCameraError(err);
      });
  }

  private armSuppression(payload: string): void {
    this.lastScannedPayload = payload;
    this.lastScannedAt = Date.now();
  }

  private isSuppressedRescan(payload: string): boolean {
    if (payload !== this.lastScannedPayload) return false;
    return Date.now() - this.lastScannedAt < SCAN_SUPPRESSION_WINDOW_MS;
  }

  private attachVideoLifecycleListeners(videoEl: HTMLVideoElement): void {
    const el = videoEl as HTMLVideoElement & { __ceEndedHandler?: () => void };
    if (el.__ceEndedHandler) {
      videoEl.removeEventListener('ended', el.__ceEndedHandler);
    }
    const handler = (): void => {
      if (this.destroyed) return;
      if (this.intentionalStopInProgress || videoEl.srcObject === null) {
        // Either an intentional stop (submit/destroy) or a detached stream:
        // the track going inactive is expected and must not be treated as a
        // camera failure. A genuine mid-scan stream death always has an
        // attached srcObject when the event dispatches.
        return;
      }
      if (this.state().cameraStatus !== 'unavailable') {
        this.handleCameraError({ name: 'NotReadableError' });
      }
    };
    el.__ceEndedHandler = handler;
    videoEl.addEventListener('ended', handler);
  }

  private handleCameraError(err: unknown): void {
    const name = (err as { name?: string } | null)?.name ?? '';
    let message = CAMERA_START_FAILED;
    let terminal = false;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      message = CAMERA_PERMISSION_DENIED;
      terminal = true;
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
      message = NO_CAMERA;
      terminal = true;
    } else if (name === 'NotReadableError') {
      message = CAMERA_IN_USE;
    }
    this.currentSessionId += 1;
    this.state.update((s) => ({ ...s, cameraStatus: 'unavailable', error: message }));
    this.scannerControls = null;
    if (!terminal && !this.destroyed && this.retryCount < CAMERA_RETRY_LIMIT) {
      this.retryCount += 1;
      this.scheduleRetry();
    }
  }

  private stopScanner(): void {
    this.currentSessionId += 1;
    if (this.scannerControls) {
      this.intentionalStopInProgress = true;
      this.scannerControls.stop();
      this.scannerControls = null;
    }
    const videoEl = this.videoRef?.nativeElement;
    if (videoEl) {
      const stream = videoEl.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
      }
      videoEl.srcObject = null;
      videoEl.load();
    }
  }

  private scheduleRearm(): void {
    if (this.rearmHandle !== null) {
      clearTimeout(this.rearmHandle);
    }
    this.rearmHandle = setTimeout(() => {
      this.rearmHandle = null;
      if (this.destroyed) return;
      this.intentionalStopInProgress = false;
      this.startScanner();
    }, REARM_DELAY_MS);
  }

  private scheduleRetry(): void {
    if (this.rearmHandle !== null) {
      clearTimeout(this.rearmHandle);
    }
    this.rearmHandle = setTimeout(() => {
      this.rearmHandle = null;
      if (this.destroyed) return;
      this.intentionalStopInProgress = false;
      this.state.update((s) => ({ ...s, cameraStatus: 'idle' }));
      this.startScanner();
    }, CAMERA_RETRY_DELAY_MS);
  }
}
