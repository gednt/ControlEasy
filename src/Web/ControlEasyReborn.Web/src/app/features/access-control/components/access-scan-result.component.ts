import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GatewayControlService } from '../gateway-control.service';
import { ScanResult, ScanRefusal } from '../access-control.types';

@Component({
  selector: 'ce-access-scan-result',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (decision() === 'recorded') {
      <div class="result result--recorded" role="status" aria-live="polite">
        <h3>Access recorded</h3>
        <p>{{ subjectType() }} -> {{ direction() }} at {{ destinationBlock() }}/{{ destinationUnit() }}</p>
      </div>
    } @else if (decision() === 'duplicate_confirmation_required') {
      <div class="result result--duplicate" role="status" aria-live="polite">
        <h3>Duplicate scan</h3>
        <p>Confirm with attendant before proceeding.</p>
      </div>
    } @else if (decision() === 'policy_action_required') {
      <div class="result result--policy" role="status" aria-live="polite">
        <h3>Policy action required</h3>
        <p>Hand off to consent workflow.</p>
      </div>
    } @else if (decision() === 'refused') {
      <div class="result result--refused" role="status" aria-live="polite">
        <h3>Access refused</h3>
        <p>
          Reason: <code>{{ failureCode() }}</code>
        </p>
      </div>
    } @else {
      <div class="result result--unavailable" role="status" aria-live="polite">
        <h3>Service unavailable</h3>
      </div>
    }
  `,
})
export class AccessScanResultComponent {
  readonly decision = input.required<ScanResult['decision']>();
  readonly subjectType = input<string>('');
  readonly direction = input<string>('');
  readonly destinationBlock = input<string>('');
  readonly destinationUnit = input<string>('');
  readonly failureCode = input<string>('');
}
