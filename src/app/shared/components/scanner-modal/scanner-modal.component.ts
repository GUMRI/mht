import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-scanner-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-content" style="max-width: 440px; padding: 24px;" (click)="$event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--mh-purple-deep);">
            ماسح الباركود ورمز QR
          </h3>
          <button (click)="close()" style="background: none; border: none; cursor: pointer; color: #94a3b8;">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div style="background: #1e1b4b; border-radius: 16px; height: 180px; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 20px;">
          <!-- Laser scanning beam animation -->
          <div
            style="position: absolute; left: 10%; right: 10%; height: 2px; background: #a855f7; box-shadow: 0 0 12px 2px #c084fc; animation: laserScan 2s infinite ease-in-out;"
          ></div>
          <mat-icon style="color: rgba(255,255,255,0.4); font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px;">
            qr_code_scanner
          </mat-icon>
          <div style="color: #ffffff; font-size: 0.85rem; font-weight: 600;">
            وجّه الباركود أمام الكاميرا أو القارئ
          </div>
        </div>

        <!-- Manual Barcode Input -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <input
            #barcodeInput
            type="text"
            class="mh-input"
            placeholder="أدخل رقم الباركود يدوياً..."
            (keyup.enter)="submitCode(barcodeInput.value)"
          />
          <button class="btn-primary" (click)="submitCode(barcodeInput.value)">
            مسح
          </button>
        </div>

        <!-- Quick Demo Codes for Testing -->
        <div style="background: #f8f6fc; padding: 12px; border-radius: 12px;">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--mh-text-muted); margin-bottom: 8px;">
            أكواد تجريبية سريعة:
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            @for (code of ['619123456789', '619987654321', '619555666777', 'SERVICE-01']; track code) {
              <button
                (click)="submitCode(code)"
                style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--mh-border-subtle); background: #ffffff; font-size: 0.78rem; cursor: pointer; color: var(--mh-purple-deep);"
              >
                {{ code }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes laserScan {
      0% { top: 15%; }
      50% { top: 85%; }
      100% { top: 15%; }
    }
  `],
})
export class ScannerModal {
  public scanned = output<string>();
  public closed = output<void>();

  public submitCode(val: string): void {
    const trimmed = val.trim();
    if (trimmed) {
      this.scanned.emit(trimmed);
      this.close();
    }
  }

  public close(): void {
    this.closed.emit();
  }
}
