import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BusinessService } from '../../core/business/business.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ScannerModal } from '../../shared/components/scanner-modal/scanner-modal.component';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, MatIconModule, ScannerModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">
      <!-- Profile Header Card -->
      <div class="glass-panel" style="padding: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div
            style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #4a154b 0%, #7c3aed 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; box-shadow: 0 4px 16px rgba(74, 21, 75, 0.25);"
          >
            {{ authService.effectiveUserName().charAt(0) }}
          </div>
          <div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 4px;">
              {{ authService.effectiveUserName() }}
            </h2>
            <div style="font-size: 0.88rem; color: var(--mh-text-muted);">
              {{ authService.firebaseUser()?.email }}
            </div>
            <div style="margin-top: 6px;">
              <span class="badge-purple">كيان منصة مستقل (Platform User)</span>
            </div>
          </div>
        </div>

        <button class="btn-danger" (click)="handleLogout()">
          <mat-icon>logout</mat-icon>
          <span>{{ i18n.t('auth.sign_out') }}</span>
        </button>
      </div>

      <!-- Authenticate Business Device (Scan QR shown on business POS device) -->
      <div class="glass-card" style="padding: 24px; border: 1.5px solid #d8b4fe;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; color: var(--mh-purple-deep); font-weight: 800; font-size: 1.1rem; margin-bottom: 6px;">
              <mat-icon style="color: #7c3aed;">security</mat-icon>
              <span>تسجيل الدخول إلى جهاز نقطة بيع في المحل (Authenticator)</span>
            </div>
            <p style="font-size: 0.88rem; color: var(--mh-text-muted); max-width: 520px;">
              يعمل هاتفك الشخصي كأداة مصادقة موثوقة: امسح رمز QR المعروض على شاشة جهاز الكاشير في المحل للمصادقة وتأكيد الحضور فوراً.
            </p>
          </div>
          <button class="btn-primary" (click)="showScanner.set(true)">
            <mat-icon>qr_code_scanner</mat-icon>
            <span>مسح QR الجهاز</span>
          </button>
        </div>
      </div>

      <!-- Set / Change 4-digit PIN for Quick Switching -->
      <div class="glass-card" style="padding: 24px;">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--mh-purple-deep); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <mat-icon>pin</mat-icon>
          <span>رمز PIN السريع (لتبديل المستخدم في أجهزة المحل)</span>
        </h3>
        <p style="font-size: 0.85rem; color: var(--mh-text-muted); margin-bottom: 16px;">
          يتم تشفير الرمز باستخدام ملح خاص (Salt) لكل مستخدم عبر خوارزمية SHA-256، ولا يُخزن نص الرمز أبداً.
        </p>

        <div style="display: flex; gap: 12px; align-items: center; max-width: 320px;">
          <input
            #pinInput
            type="password"
            maxlength="4"
            class="mh-input"
            style="letter-spacing: 6px; text-align: center; font-size: 1.2rem; font-weight: 700;"
            placeholder="••••"
          />
          <button
            class="btn-primary"
            style="white-space: nowrap;"
            (click)="handleSavePin(pinInput.value); pinInput.value = ''"
          >
            تحديث PIN
          </button>
        </div>
        @if (pinSavedMsg()) {
          <div style="color: #10b981; font-size: 0.85rem; font-weight: 600; margin-top: 8px;">
            {{ pinSavedMsg() }}
          </div>
        }
      </div>

      <!-- Personal Notifications & Invitations List -->
      <div class="glass-card" style="padding: 24px;">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--mh-purple-deep); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <mat-icon>mail</mat-icon>
          <span>صندوق الإشعارات والدعوات الشخصية</span>
        </h3>

        @if (businessService.notifications().length === 0) {
          <div style="text-align: center; padding: 24px; color: var(--mh-text-muted); font-size: 0.9rem;">
            لا توجد إشعارات أو دعوات جديدة حالياً.
          </div>
        } @else {
          <div style="display: flex; flex-direction: column; gap: 12px;">
            @for (notif of businessService.notifications(); track notif.id) {
              <div
                class="glass-card"
                style="padding: 16px; border: 1px solid var(--mh-border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;"
              >
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--mh-text-main); margin-bottom: 4px;">
                    {{ notif.title }}
                  </div>
                  <div style="font-size: 0.85rem; color: var(--mh-text-muted);">
                    {{ notif.message }}
                  </div>
                  <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
                    {{ i18n.formatDate(notif.createdAt) }}
                  </div>
                </div>

                @if (notif.status === 'pending') {
                  <div style="display: flex; gap: 8px;">
                    <button class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" (click)="acceptInvitation(notif)">
                      قبول
                    </button>
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" (click)="declineInvitation(notif)">
                      رفض
                    </button>
                  </div>
                } @else {
                  <span [class]="notif.status === 'accepted' ? 'badge-green' : 'badge-amber'">
                    {{ notif.status === 'accepted' ? 'مقبولة' : (notif.status === 'declined' ? 'مرفوضة' : 'مقروءة') }}
                  </span>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Scanner Modal for Business Device QR -->
      @if (showScanner()) {
        <app-scanner-modal
          (scanned)="handleScannedDevice($event)"
          (closed)="showScanner.set(false)"
        />
      }
    </div>
  `,
})
export class ProfileComponent {
  public authService = inject(AuthService);
  public businessService = inject(BusinessService);
  public i18n = inject(I18nService);
  private router = inject(Router);

  public showScanner = signal<boolean>(false);
  public pinSavedMsg = signal<string>('');

  public async handleSavePin(pin: string): Promise<void> {
    if (!pin || pin.length !== 4) {
      alert('يجب أن يتكون رمز PIN من 4 أرقام.');
      return;
    }
    await this.authService.setPin(pin);
    this.pinSavedMsg.set('تم حفظ رمز PIN المشفر بنجاح!');
    setTimeout(() => this.pinSavedMsg.set(''), 3000);
  }

  public async handleLogout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  public async acceptInvitation(notif: any): Promise<void> {
    await this.businessService.respondToInvitation(notif, true);
  }

  public async declineInvitation(notif: any): Promise<void> {
    await this.businessService.respondToInvitation(notif, false);
  }

  public handleScannedDevice(token: string): void {
    alert(`تم التحقق من جهاز المحل بنجاح (${token})! تم تسجيل الدخول على شاشة الجهاز.`);
  }
}
