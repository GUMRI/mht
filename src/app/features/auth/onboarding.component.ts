import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BusinessService } from '../../core/business/business.service';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, SUPPORTED_LOCALES, SupportedLocale } from '../../core/i18n/i18n.service';
import { ScannerModal } from '../../shared/components/scanner-modal/scanner-modal.component';

@Component({
  selector: 'app-onboarding',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, ScannerModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="onboarding-wrapper">
      <div class="glass-panel onboarding-card">
        <!-- Step 1: Initial Choice -->
        @if (currentStep() === 'choice') {
          <div style="text-align: center; margin-bottom: 28px;">
            <div class="step-icon-badge">
              <mat-icon style="font-size: 36px; color: #ffffff;">rocket_launch</mat-icon>
            </div>
            <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 6px;">
              {{ i18n.t('auth.welcome') }}
            </h2>
            <p style="font-size: 0.95rem; color: var(--mh-text-muted);">
              {{ i18n.t('auth.onboarding_choice') }}
            </p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div
              (click)="currentStep.set('create_business')"
              class="glass-card choice-box"
            >
              <div class="choice-icon" style="background: #ede9fe; color: #6b21a8;">
                <mat-icon style="font-size: 30px;">add_business</mat-icon>
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 1.05rem; color: var(--mh-text-main);">
                  {{ i18n.t('auth.create_business') }}
                </div>
                <div style="font-size: 0.85rem; color: var(--mh-text-muted); margin-top: 2px;">
                  أنت المالك، وتريد بدء نشاط تجاري جديد أو نقل نشاطك القائم
                </div>
              </div>
              <mat-icon style="color: #94a3b8;">chevron_left</mat-icon>
            </div>

            <div
              (click)="currentStep.set('join')"
              class="glass-card choice-box"
            >
              <div class="choice-icon" style="background: #e0f2fe; color: #0284c7;">
                <mat-icon style="font-size: 30px;">qr_code_scanner</mat-icon>
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 1.05rem; color: var(--mh-text-main);">
                  {{ i18n.t('auth.join_business') }}
                </div>
                <div style="font-size: 0.85rem; color: var(--mh-text-muted); margin-top: 2px;">
                  انضم إلى فريق عمل نشاط تجاري قائم عبر رمز QR أو دعوة بريدية
                </div>
              </div>
              <mat-icon style="color: #94a3b8;">chevron_left</mat-icon>
            </div>
          </div>
        }

        <!-- Step 2: Create Business Form -->
        @if (currentStep() === 'create_business') {
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
              <button
                type="button"
                (click)="currentStep.set('choice')"
                style="background: none; border: none; cursor: pointer; color: var(--mh-purple-deep);"
              >
                <mat-icon>arrow_forward</mat-icon>
              </button>
              <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--mh-purple-deep);">
                {{ i18n.t('auth.create_business') }}
              </h2>
            </div>

            <!-- Start Mode: New Business vs Migrating Business -->
            <div class="tabs-segmented" style="margin-bottom: 20px;">
              <button
                type="button"
                class="seg-btn"
                [class.active]="!isMigrating()"
                (click)="isMigrating.set(false)"
              >
                نشاط جديد بالكامل
              </button>
              <button
                type="button"
                class="seg-btn"
                [class.active]="isMigrating()"
                (click)="isMigrating.set(true)"
              >
                نشاط قائم (ترحيل أرصدة)
              </button>
            </div>

            <form [formGroup]="createBizForm" (ngSubmit)="handleCreateBusiness()">
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">اسم النشاط التجاري</label>
                  <input
                    type="text"
                    formControlName="name"
                    class="mh-input"
                    placeholder="مثال: محلات النور للتجارة"
                    required
                  />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="form-label">نوع النشاط</label>
                    <select formControlName="businessType" class="mh-select">
                      <option value="retail">تجارة تجزئة (Retail)</option>
                      <option value="restaurant">مطعم / مقهى (Cafe)</option>
                      <option value="services">خدمات واستشارات</option>
                      <option value="wholesale">تجارة جملة (Wholesale)</option>
                      <option value="other">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label class="form-label">المنطقة والعملة</label>
                    <select formControlName="locale" class="mh-select" (change)="onLocaleSelect($event)">
                      @for (loc of localeOptions; track loc.code) {
                        <option [value]="loc.code">{{ loc.name }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div>
                  <label class="form-label">رابط الشعار (اختياري)</label>
                  <input
                    type="url"
                    formControlName="logo"
                    class="mh-input"
                    placeholder="https://..."
                  />
                </div>

                <!-- Opening Balances for Migrating Businesses -->
                @if (isMigrating()) {
                  <div style="background: #faf5ff; border: 1px solid #d8b4fe; border-radius: 14px; padding: 16px; margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--mh-purple-deep); margin-bottom: 12px;">
                      <mat-icon style="font-size: 20px;">account_balance_wallet</mat-icon>
                      <span>الأرصدة الافتتاحية (يتم ترحيلها في قيد افتتاحي متوازن):</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                      <div>
                        <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">النقدية بالصندوق (1111)</label>
                        <input type="number" formControlName="openingCash" class="mh-input" placeholder="0.00" />
                      </div>
                      <div>
                        <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">قيمة المخزون الحالي (1131)</label>
                        <input type="number" formControlName="openingInventory" class="mh-input" placeholder="0.00" />
                      </div>
                      <div>
                        <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">ديون مستحقة على العملاء (1121)</label>
                        <input type="number" formControlName="openingReceivables" class="mh-input" placeholder="0.00" />
                      </div>
                      <div>
                        <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">ديون مستحقة للموردين (2111)</label>
                        <input type="number" formControlName="openingPayables" class="mh-input" placeholder="0.00" />
                      </div>
                    </div>
                  </div>
                }

                @if (errorMsg()) {
                  <div style="color: #ef4444; font-size: 0.85rem; font-weight: 600;">
                    {{ errorMsg() }}
                  </div>
                }

                <button
                  type="submit"
                  class="btn-primary"
                  style="height: 48px; margin-top: 10px;"
                  [disabled]="createBizForm.invalid || isSubmitting()"
                >
                  <mat-icon>check_circle</mat-icon>
                  <span>{{ isSubmitting() ? 'جارٍ الإنشاء وتوليد الحسابات...' : 'تأكيد وإنشاء النشاط' }}</span>
                </button>
              </div>
            </form>
          </div>
        }

        <!-- Step 3: Join via QR / Invitation Code -->
        @if (currentStep() === 'join') {
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
              <button
                type="button"
                (click)="currentStep.set('choice')"
                style="background: none; border: none; cursor: pointer; color: var(--mh-purple-deep);"
              >
                <mat-icon>arrow_forward</mat-icon>
              </button>
              <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--mh-purple-deep);">
                {{ i18n.t('auth.join_business') }}
              </h2>
            </div>

            <!-- List user pending invitations if any -->
            @if (businessService.notifications().length > 0) {
              <div style="margin-bottom: 20px;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--mh-purple-deep); margin-bottom: 10px;">
                  لديك دعوات معلقة:
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  @for (n of businessService.notifications(); track n.id) {
                    @if (n.status === 'pending') {
                      <div class="glass-card" style="padding: 14px;">
                        <div style="font-weight: 700; color: var(--mh-text-main); margin-bottom: 4px;">
                          {{ n.title }}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--mh-text-muted); margin-bottom: 12px;">
                          {{ n.message }}
                        </div>
                        <div style="display: flex; gap: 8px;">
                          <button
                            class="btn-primary"
                            style="padding: 6px 14px; font-size: 0.85rem;"
                            (click)="handleAcceptInvitation(n)"
                          >
                            قبول الدعوة
                          </button>
                          <button
                            class="btn-secondary"
                            style="padding: 6px 14px; font-size: 0.85rem;"
                            (click)="handleDeclineInvitation(n)"
                          >
                            رفض
                          </button>
                        </div>
                      </div>
                    }
                  }
                </div>
              </div>
            }

            <div style="text-align: center; margin: 24px 0;">
              <button
                type="button"
                class="btn-primary"
                style="width: 100%; height: 50px; font-size: 1rem;"
                (click)="showScanner.set(true)"
              >
                <mat-icon>qr_code_scanner</mat-icon>
                <span>مسح رمز QR الخاص بالنشاط</span>
              </button>
            </div>

            <!-- Barcode / QR Scanner Modal -->
            @if (showScanner()) {
              <app-scanner-modal
                (scanned)="handleScannedCode($event)"
                (closed)="showScanner.set(false)"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .onboarding-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle at 10% 20%, #ede9fe 0%, #f6f3fc 90%);
    }

    .onboarding-card {
      width: 100%;
      max-width: 540px;
      padding: 36px 32px;
    }

    .step-icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: linear-gradient(135deg, #4a154b 0%, #7c3aed 100%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 8px 24px rgba(74, 21, 75, 0.25);
    }

    .choice-box {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .choice-box:hover {
      border-color: #7c3aed;
      transform: translateY(-2px);
    }

    .choice-icon {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tabs-segmented {
      display: flex;
      background: #f1e9fa;
      padding: 4px;
      border-radius: 14px;
    }

    .seg-btn {
      flex: 1;
      padding: 8px 12px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: #64748b;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .seg-btn.active {
      background: #ffffff;
      color: var(--mh-purple-deep);
      box-shadow: 0 2px 8px rgba(74, 21, 75, 0.1);
    }

    .form-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--mh-text-main);
      margin-bottom: 4px;
      display: block;
    }
  `],
})
export class OnboardingComponent {
  public businessService = inject(BusinessService);
  public authService = inject(AuthService);
  public i18n = inject(I18nService);
  private router = inject(Router);

  public currentStep = signal<'choice' | 'create_business' | 'join'>('choice');
  public isMigrating = signal<boolean>(false);
  public isSubmitting = signal<boolean>(false);
  public showScanner = signal<boolean>(false);
  public errorMsg = signal<string>('');

  public localeOptions = Object.values(SUPPORTED_LOCALES);

  public createBizForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    businessType: new FormControl('retail', [Validators.required]),
    locale: new FormControl('TN', [Validators.required]),
    logo: new FormControl(''),
    openingCash: new FormControl(0),
    openingInventory: new FormControl(0),
    openingReceivables: new FormControl(0),
    openingPayables: new FormControl(0),
  });

  public onLocaleSelect(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const loc = select.value as SupportedLocale;
    this.i18n.setLocale(loc);
  }

  public async handleCreateBusiness(): Promise<void> {
    if (this.createBizForm.invalid) return;
    this.isSubmitting.set(true);
    this.errorMsg.set('');

    const formVal = this.createBizForm.value;
    const loc = SUPPORTED_LOCALES[formVal.locale as SupportedLocale] || SUPPORTED_LOCALES.TN;

    let openingBalances;
    if (this.isMigrating()) {
      openingBalances = {
        cash: Number(formVal.openingCash || 0),
        inventory: Number(formVal.openingInventory || 0),
        receivables: Number(formVal.openingReceivables || 0),
        payables: Number(formVal.openingPayables || 0),
        equity: 0,
      };
    }

    try {
      await this.businessService.createBusiness(
        {
          name: formVal.name!,
          businessType: formVal.businessType!,
          currency: loc.currencyCode,
          locale: loc.code,
          logo: formVal.logo || '',
        },
        openingBalances
      );
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'فشل إنشاء النشاط التجاري.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  public async handleAcceptInvitation(notif: any): Promise<void> {
    try {
      await this.businessService.respondToInvitation(notif, true);
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'فشل قبول الدعوة.');
    }
  }

  public async handleDeclineInvitation(notif: any): Promise<void> {
    await this.businessService.respondToInvitation(notif, false);
  }

  public handleScannedCode(code: string): void {
    // If scanning QR for business or invitation
    alert(`تم مسح الرمز: ${code}. يرجى التحقق من الدعوة.`);
  }
}
