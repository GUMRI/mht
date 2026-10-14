import { Component, ChangeDetectionStrategy, input, output, ElementRef, viewChild, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-display-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-content" style="max-width: 400px; padding: 24px; text-align: center;" (click)="$event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--mh-purple-deep);">
            {{ title() }}
          </h3>
          <button (click)="close()" style="background: none; border: none; cursor: pointer; color: #94a3b8;">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <p style="font-size: 0.88rem; color: var(--mh-text-muted); margin-bottom: 20px;">
          {{ description() }}
        </p>

        <div style="display: flex; justify-content: center; margin-bottom: 20px;">
          <div style="padding: 12px; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid var(--mh-border-subtle);">
            <canvas #qrCanvas width="220" height="220"></canvas>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: #64748b; background: #f8f6fc; padding: 10px; border-radius: 10px; word-break: break-all;">
          {{ qrData() }}
        </div>

        <div style="margin-top: 20px;">
          <button class="btn-primary" style="width: 100%;" (click)="close()">
            <mat-icon>check</mat-icon>
            تم
          </button>
        </div>
      </div>
    </div>
  `,
})
export class QrDisplayModal {
  public title = input<string>('رمز QR');
  public description = input<string>('امسح الرمز بواسطة كاميرا جهازك أو قارئ QR');
  public qrData = input.required<string>();
  public closed = output<void>();

  private qrCanvas = viewChild<ElementRef<HTMLCanvasElement>>('qrCanvas');

  constructor() {
    afterNextRender(() => {
      this.renderQr();
    });
  }

  public renderQr(): void {
    const canvas = this.qrCanvas()?.nativeElement;
    if (canvas && this.qrData()) {
      QRCode.toCanvas(canvas, this.qrData(), {
        width: 220,
        margin: 1,
        color: {
          dark: '#4a154b',
          light: '#ffffff',
        },
      });
    }
  }

  public close(): void {
    this.closed.emit();
  }
}
