import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserQRCodeSvgWriter } from '@zxing/browser';
import { CeButtonComponent, CeModalComponent } from '../../../design-system';

@Component({
  selector: 'ce-qr-pass-modal',
  standalone: true,
  imports: [CommonModule, CeButtonComponent, CeModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ce-modal [open]="open()" title="Access QR Pass" size="md" (openChange)="onOpenChange($event)">
      <div class="pass-wrapper">
        <div class="pass-card" id="printable-qr-pass">
          <div class="pass-header">
            <span class="pass-condo-title">ControlEasy Reborn</span>
            <span class="pass-type-badge">{{ subjectType() }} Pass</span>
          </div>

          <div class="qr-container-box">
            <div #qrContainer class="qr-svg-target"></div>
            @if (!qrPayload()) {
              <p class="no-payload-hint">No QR payload provided.</p>
            }
          </div>

          <div class="pass-details">
            <div class="detail-row">
              <span class="detail-label">Name</span>
              <strong class="detail-value">{{ subjectName() || 'Guest' }}</strong>
            </div>

            @if (destination()) {
              <div class="detail-row">
                <span class="detail-label">Destination</span>
                <strong class="detail-value">{{ destination() }}</strong>
              </div>
            }

            <div class="detail-row">
              <span class="detail-label">Valid until</span>
              <span class="detail-value">{{ expiresAt() ? (expiresAt() | date: 'short') : 'Until visit ends' }}</span>
            </div>
          </div>

          <div class="token-box">
            <span class="token-label">Token:</span>
            <code class="token-value">{{ maskedToken() }}</code>
            <button
              type="button"
              class="ce-button variant-ghost size-sm copy-btn"
              (click)="copyToken()"
              [title]="copied() ? 'Copied!' : 'Copy full token'"
            >
              {{ copied() ? '✓ Copied' : 'Copy' }}
            </button>
          </div>
        </div>

        <div class="security-banner" role="note">
          <strong>Security notice:</strong> This cryptographic QR token is displayed only once upon generation. The
          visitor or resident can scan this pass directly from their phone screen or a printed copy.
        </div>
      </div>

      <div ce-modal-footer>
        <ce-button variant="ghost" size="sm" type="button" (click)="close()">Close</ce-button>
        <ce-button variant="secondary" size="sm" type="button" (click)="printPass()"> Print pass </ce-button>
      </div>
    </ce-modal>
  `,
  styles: [
    `
      .pass-wrapper {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
        align-items: center;
      }

      .pass-card {
        background: #ffffff;
        border: 2px solid var(--color-border, #e2e8f0);
        border-radius: var(--radius-lg, 12px);
        padding: var(--space-4, 16px);
        width: 100%;
        max-width: 340px;
        box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        box-sizing: border-box;
      }

      .pass-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
        padding-bottom: var(--space-2, 8px);
        margin-bottom: var(--space-3, 12px);
      }

      .pass-condo-title {
        font-weight: 700;
        font-size: 0.85rem;
        color: var(--color-primary, #2c5cdc);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .pass-type-badge {
        background: rgba(44, 92, 220, 0.12);
        color: var(--color-primary, #2c5cdc);
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .qr-container-box {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2, 8px);
        background: #ffffff;
        min-height: 220px;
        min-width: 220px;
      }

      .qr-svg-target svg {
        display: block;
        max-width: 220px;
        max-height: 220px;
        width: 220px;
        height: 220px;
      }

      .no-payload-hint {
        color: var(--color-text-secondary, #64748b);
        font-size: 0.85rem;
      }

      .pass-details {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
        margin-top: var(--space-3, 12px);
        border-top: 1px dashed var(--color-border, #e2e8f0);
        padding-top: var(--space-2, 8px);
        font-size: 0.85rem;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }

      .detail-label {
        color: var(--color-text-secondary, #64748b);
      }

      .detail-value {
        color: var(--color-text-primary, #1e293b);
      }

      .token-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        background: var(--color-surface-subtle, #f8fafc);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: var(--radius-sm, 6px);
        padding: 4px 8px;
        margin-top: var(--space-3, 12px);
        font-size: 0.75rem;
      }

      .token-label {
        color: var(--color-text-secondary, #64748b);
        font-weight: 600;
      }

      .token-value {
        font-family: monospace;
        color: var(--color-text-muted, #475569);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 160px;
      }

      .copy-btn {
        padding: 2px 6px;
        font-size: 0.75rem;
        height: auto;
      }

      .security-banner {
        background: rgba(245, 158, 11, 0.1);
        border-left: 3px solid #f59e0b;
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border-radius: var(--radius-sm, 4px);
        font-size: 0.8rem;
        color: #92400e;
        width: 100%;
        box-sizing: border-box;
      }

      @media print {
        body * {
          visibility: hidden;
        }
        #printable-qr-pass,
        #printable-qr-pass * {
          visibility: visible;
        }
        #printable-qr-pass {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 2px solid #000;
          box-shadow: none;
        }
      }
    `,
  ],
})
export class QrPassModalComponent {
  @ViewChild('qrContainer', { static: false })
  qrContainer?: ElementRef<HTMLDivElement>;

  open = input<boolean>(false);
  qrPayload = input<string | null>(null);
  subjectName = input<string>('');
  subjectType = input<string>('Visitor');
  destination = input<string>('');
  expiresAt = input<string | null>(null);

  closed = output<void>();
  openChange = output<boolean>();

  copied = signal(false);

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const payload = this.qrPayload();
      if (isOpen && payload) {
        // Render QR Code via @zxing/browser
        setTimeout(() => this.renderQr(payload), 50);
      }
    });
  }

  maskedToken(): string {
    const p = this.qrPayload();
    if (!p) return '—';
    if (p.length <= 16) return p;
    return `${p.substring(0, 8)}...${p.substring(p.length - 8)}`;
  }

  private renderQr(payload: string): void {
    if (!this.qrContainer?.nativeElement) return;
    const container = this.qrContainer.nativeElement;
    container.innerHTML = '';
    try {
      const writer = new BrowserQRCodeSvgWriter();
      const svg = writer.write(payload, 220, 220);
      container.appendChild(svg);
    } catch (err) {
      console.error('Failed to render QR SVG:', err);
    }
  }

  copyToken(): void {
    const p = this.qrPayload();
    if (!p) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(p).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }

  printPass(): void {
    window.print();
  }

  onOpenChange(open: boolean): void {
    if (!open) this.close();
  }

  close(): void {
    this.copied.set(false);
    this.openChange.emit(false);
    this.closed.emit();
  }
}
