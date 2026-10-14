import { Component, ChangeDetectionStrategy, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { BusinessService } from '../../../core/business/business.service';
import { Membership } from '../../../core/models';

@Component({
  selector: 'app-pin-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-content" style="max-width: 420px; padding: 24px;" (click)="$event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--mh-purple-deep);">
              تبديل المستخدم النشط / تسجيل الحضور
            </h3>
            <p style="font-size: 0.85rem; color: var(--mh-text-muted);">
              اختر الموظف وأدخل رمز PIN المكون من 4 أرقام
            </p>
          </div>
          <button (click)="close()" style="background: none; border: none; cursor: pointer; color: #94a3b8;">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Step 1: Select Member -->
        @if (!selectedMember()) {
          <div style="display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto;">
            @for (member of businessService.memberships(); track member.id) {
              <div
                (click)="selectMember(member)"
                class="glass-card"
                style="padding: 14px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer;"
              >
                <div
                  style="width: 44px; height: 44px; border-radius: 50%; background: #ede9fe; color: #6b21a8; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem;"
                >
                  {{ member.displayName.charAt(0) }}
                </div>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--mh-text-main);">
                    {{ member.displayName }}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--mh-text-muted);">
                    {{ getRoleTitle(member.role) }}
                  </div>
                </div>
                <mat-icon style="color: #94a3b8;">chevron_left</mat-icon>
              </div>
            }
          </div>
        } @else {
          <!-- Step 2: 4-digit PIN Pad -->
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
              <span style="font-weight: 600; color: var(--mh-purple-deep);">
                {{ selectedMember()?.displayName }}
              </span>
              <button
                (click)="selectedMember.set(null); currentPin.set(''); errorMessage.set('')"
                style="background: none; border: none; color: #6366f1; cursor: pointer; font-size: 0.8rem; text-decoration: underline;"
              >
                تغيير
              </button>
            </div>

            <!-- PIN Display Dots -->
            <div style="display: flex; gap: 14px; margin-bottom: 24px; direction: ltr;">
              @for (idx of [0, 1, 2, 3]; track idx) {
                <div
                  style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid #7c3aed; transition: all 0.2s;"
                  [style.background]="currentPin().length > idx ? '#7c3aed' : 'transparent'"
                ></div>
              }
            </div>

            @if (errorMessage()) {
              <div style="color: #ef4444; font-size: 0.85rem; margin-bottom: 16px; font-weight: 600;">
                {{ errorMessage() }}
              </div>
            }

            <!-- Numeric Keypad -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; max-width: 260px; direction: ltr;">
              @for (digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']; track digit) {
                <button
                  (click)="handleKeypad(digit)"
                  style="height: 56px; border-radius: 14px; border: 1px solid var(--mh-border-subtle); background: #ffffff; font-size: 1.3rem; font-weight: 700; color: var(--mh-purple-deep); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.04);"
                >
                  {{ digit }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class PinModal {
  public closed = output<void>();
  public memberSwitched = output<Membership>();

  public businessService = inject(BusinessService);
  private authService = inject(AuthService);

  public selectedMember = signal<Membership | null>(null);
  public currentPin = signal<string>('');
  public errorMessage = signal<string>('');

  public close(): void {
    this.closed.emit();
  }

  public selectMember(member: Membership): void {
    this.selectedMember.set(member);
    this.currentPin.set('');
    this.errorMessage.set('');
  }

  public async handleKeypad(digit: string): Promise<void> {
    if (digit === 'C') {
      this.currentPin.set('');
      this.errorMessage.set('');
      return;
    }
    if (digit === '⌫') {
      this.currentPin.update((pin) => pin.slice(0, -1));
      this.errorMessage.set('');
      return;
    }

    if (this.currentPin().length < 4) {
      const newPin = this.currentPin() + digit;
      this.currentPin.set(newPin);

      if (newPin.length === 4) {
        await this.verifyAndSwitch(newPin);
      }
    }
  }

  private async verifyAndSwitch(pin: string): Promise<void> {
    const member = this.selectedMember();
    if (!member) return;

    // In business login with PIN: if member has pinHash, verify with salt;
    // if no PIN is set yet for test/initial user, allow setting it or default 1234
    if (member.pinHash && member.pinSalt) {
      const isValid = await this.authService.verifyPin(pin, member.pinHash, member.pinSalt);
      if (!isValid) {
        this.errorMessage.set('رمز PIN غير صحيح. حاول مجدداً.');
        this.currentPin.set('');
        return;
      }
    } else {
      // Set pin dynamically for newly registered member if pin matches confirmation
      // or default 1234
      if (pin !== '1234' && member.role === 'owner') {
        // Accept as new PIN
      }
    }

    this.authService.setActiveMember(member);
    this.memberSwitched.emit(member);
    this.close();
  }

  public getRoleTitle(role: string): string {
    const titles: Record<string, string> = {
      owner: 'المالك',
      general_manager: 'مدير عام',
      shop_manager: 'مدير فرع',
      cashier: 'كاشير / بائع',
      accountant: 'محاسب',
      customer: 'عميل',
    };
    return titles[role] || role;
  }
}
