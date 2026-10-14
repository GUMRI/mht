import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BusinessService } from '../../core/business/business.service';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { QrDisplayModal } from '../../shared/components/qr-display-modal/qr-display-modal.component';
import { Membership, Role, Shop } from '../../core/models';

@Component({
  selector: 'app-business-management',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, QrDisplayModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Page Layout Mandate: Two selects at top (shop, shop type), then page title, then tabs toolbar -->
      <div class="glass-panel" style="padding: 20px 24px;">
        <!-- 1. Two selects at top -->
        <div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-weight: 700; font-size: 0.88rem; color: var(--mh-purple-deep);">
              {{ i18n.t('biz.select_shop') }}:
            </label>
            <select
              class="mh-select"
              style="width: 200px;"
              [value]="businessService.activeShop()?.id"
              (change)="onShopSelect($event)"
            >
              @for (shop of businessService.shops(); track shop.id) {
                <option [value]="shop.id">{{ shop.name }}</option>
              }
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-weight: 700; font-size: 0.88rem; color: var(--mh-purple-deep);">
              {{ i18n.t('biz.shop_type') }}:
            </label>
            <select
              class="mh-select"
              style="width: 180px;"
              [value]="businessService.activeShop()?.type"
              disabled
            >
              <option value="retail">تجزئة (Retail)</option>
              <option value="restaurant">مطعم / مقهى</option>
              <option value="services">خدمات واستشارات</option>
              <option value="wholesale">تجارة جملة</option>
              <option value="other">أخرى</option>
            </select>
          </div>
        </div>

        <!-- 2. Page Title -->
        <div style="margin-bottom: 20px;">
          <h1 style="font-size: 1.6rem; font-weight: 800; color: var(--mh-purple-deep);">
            النشاط: {{ businessService.currentBusiness()?.name }} ({{ i18n.t('biz.title') }})
          </h1>
          <p style="font-size: 0.88rem; color: var(--mh-text-muted);">
            الكيان الأعلى للنشاط (Business)، وتحته المحلات كوحدات عمل تنفيذية. المستخدمون مشتركون عبر المحلات.
          </p>
        </div>

        <!-- 3. Tabs Toolbar: Overview, Shops, Users, Roles, Devices, Settings -->
        <div style="display: flex; gap: 8px; border-top: 1px solid var(--mh-border-subtle); padding-top: 14px; overflow-x: auto;">
          <button
            class="biz-tab-btn"
            [class.active]="activeTab() === 'overview'"
            (click)="activeTab.set('overview')"
          >
            <mat-icon>dashboard</mat-icon>
            <span>{{ i18n.t('biz.overview') }}</span>
          </button>

          <button
            class="biz-tab-btn"
            [class.active]="activeTab() === 'shops'"
            (click)="activeTab.set('shops')"
          >
            <mat-icon>store</mat-icon>
            <span>{{ i18n.t('biz.shops') }}</span>
          </button>

          <button
            class="biz-tab-btn"
            [class.active]="activeTab() === 'users'"
            (click)="activeTab.set('users')"
          >
            <mat-icon>people</mat-icon>
            <span>{{ i18n.t('biz.users') }}</span>
          </button>

          <button
            class="biz-tab-btn"
            [class.active]="activeTab() === 'roles'"
            (click)="activeTab.set('roles')"
          >
            <mat-icon>admin_panel_settings</mat-icon>
            <span>{{ i18n.t('biz.roles') }}</span>
          </button>

          <button
            class="biz-tab-btn"
            [class.active]="activeTab() === 'devices'"
            (click)="activeTab.set('devices')"
          >
            <mat-icon>devices</mat-icon>
            <span>{{ i18n.t('biz.devices') }}</span>
          </button>

          <button
            class="biz-tab-btn"
            [class.active]="activeTab() === 'settings'"
            (click)="activeTab.set('settings')"
          >
            <mat-icon>tune</mat-icon>
            <span>{{ i18n.t('biz.settings') }}</span>
          </button>
        </div>
      </div>

      <!-- 1. OVERVIEW TAB -->
      @if (activeTab() === 'overview') {
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
          <div class="glass-card" style="padding: 20px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted); margin-bottom: 8px;">
              عدد الفروع / المحلات
            </div>
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--mh-purple-deep);">
              {{ businessService.shops().length }}
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
              وحدات تشغيل تابعة للنشاط
            </div>
          </div>

          <div class="glass-card" style="padding: 20px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted); margin-bottom: 8px;">
              فريق العمل والأعضاء
            </div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #16a34a;">
              {{ businessService.memberships().length }}
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
              مستخدمون مسجلون ومشاركون
            </div>
          </div>

          <div class="glass-card" style="padding: 20px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted); margin-bottom: 8px;">
              أجهزة نقاط البيع المسجلة
            </div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #7c3aed;">
              {{ businessService.businessDevices().length }}
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
              أجهزة كاشير مصرح بها
            </div>
          </div>
        </div>
      }

      <!-- 2. SHOPS TAB -->
      @if (activeTab() === 'shops') {
        <div class="glass-panel" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--mh-purple-deep);">
              المحلات والفروع (Shops)
            </h3>
            <button class="btn-primary" (click)="openAddShopModal.set(true)">
              <mat-icon>add_business</mat-icon>
              <span>إضافة محل جديد</span>
            </button>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>اسم المحل</th>
                  <th>النوع</th>
                  <th>العنوان</th>
                  <th>الهاتف</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                @for (shop of businessService.shops(); track shop.id) {
                  <tr>
                    <td style="font-weight: 700; color: var(--mh-text-main);">
                      {{ shop.name }}
                      @if (shop.isDefault) {
                        <span class="badge-purple" style="margin-inline-start: 6px;">الرئيسي</span>
                      }
                    </td>
                    <td>{{ shop.type }}</td>
                    <td>{{ shop.address || '—' }}</td>
                    <td>{{ shop.phone || '—' }}</td>
                    <td><span class="badge-green">نشط</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- 3. USERS TAB: Table + Invite Button -->
      @if (activeTab() === 'users') {
        <div class="glass-panel" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--mh-purple-deep);">
                أعضاء النشاط ومستخدمو المحلات
              </h3>
              <p style="font-size: 0.85rem; color: var(--mh-text-muted);">
                أعضاء المحل عملاء افتراضياً، ويمكن ترقية أدوارهم إلى كاشير، محاسب، أو مدير فرع.
              </p>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn-primary" (click)="openInviteModal.set(true)">
                <mat-icon>person_add</mat-icon>
                <span>{{ i18n.t('biz.invite_user') }}</span>
              </button>
              <button class="btn-secondary" (click)="showInviteQr.set(true)">
                <mat-icon>qr_code</mat-icon>
                <span>دعوة عبر QR</span>
              </button>
            </div>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الدور الوظيفي</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                @for (m of businessService.memberships(); track m.id) {
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: #ede9fe; color: #6b21a8; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                          {{ m.displayName.charAt(0) }}
                        </div>
                        <span style="font-weight: 700; color: var(--mh-text-main);">{{ m.displayName }}</span>
                      </div>
                    </td>
                    <td>{{ m.email }}</td>
                    <td>
                      <span class="badge-purple">{{ getRoleTitle(m.role) }}</span>
                    </td>
                    <td><span class="badge-green">نشط</span></td>
                    <td>
                      @if (businessService.isManagerOrOwner() && m.role !== 'owner') {
                        <button
                          class="btn-secondary"
                          style="padding: 4px 10px; font-size: 0.8rem;"
                          (click)="selectedMemberForRole.set(m); openChangeRoleModal.set(true)"
                        >
                          تعديل الدور
                        </button>
                      } @else {
                        <span style="color: #94a3b8; font-size: 0.8rem;">مالك النشاط</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- 4. ROLES TAB -->
      @if (activeTab() === 'roles') {
        <div class="glass-panel" style="padding: 24px;">
          <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
            هيكل الأدوار والصلاحيات (RBAC)
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
            <div class="glass-card" style="padding: 16px;">
              <div style="font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 6px;">المالك (Owner)</div>
              <p style="font-size: 0.85rem; color: #64748b;">
                كامل الصلاحيات، إدارة الفروع، نقل الملكية، وتعيين المدراء.
              </p>
            </div>

            <div class="glass-card" style="padding: 16px;">
              <div style="font-weight: 800; color: #7c3aed; margin-bottom: 6px;">مدير عام (General Manager)</div>
              <p style="font-size: 0.85rem; color: #64748b;">
                صلاحيات شاملة عبر كافة المحلات، إضافة المستخدمين وتعديل الأدوار.
              </p>
            </div>

            <div class="glass-card" style="padding: 16px;">
              <div style="font-weight: 800; color: #0284c7; margin-bottom: 6px;">مدير فرع (Shop Manager)</div>
              <p style="font-size: 0.85rem; color: #64748b;">
                إدارة العمليات والورديات لمحل محدد فقط.
              </p>
            </div>

            <div class="glass-card" style="padding: 16px;">
              <div style="font-weight: 800; color: #16a34a; margin-bottom: 6px;">كاشير / بائع (Cashier)</div>
              <p style="font-size: 0.85rem; color: #64748b;">
                فتح الورديات، مسح الباركود، وإنشاء فواتير المبيعات. لا يرى المصطلحات المحاسبية.
              </p>
            </div>

            <div class="glass-card" style="padding: 16px;">
              <div style="font-weight: 800; color: #b45309; margin-bottom: 6px;">محاسب (Accountant)</div>
              <p style="font-size: 0.85rem; color: #64748b;">
                صلاحية قراءة كاملة لوحدة المحاسبة العامة والتقارير المالية وتصدير CSV/PDF.
              </p>
            </div>

            <div class="glass-card" style="padding: 16px;">
              <div style="font-weight: 800; color: #64748b; margin-bottom: 6px;">عميل (Customer)</div>
              <p style="font-size: 0.85rem; color: #64748b;">
                الدور الافتراضي لأي عضو جديد.
              </p>
            </div>
          </div>
        </div>
      }

      <!-- 5. DEVICES TAB: Separate My Devices from Business Devices -->
      @if (activeTab() === 'devices') {
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <!-- Business Devices -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
              <div>
                <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--mh-purple-deep);">
                  {{ i18n.t('biz.business_devices') }}
                </h3>
                <p style="font-size: 0.85rem; color: var(--mh-text-muted);">
                  الأجهزة المصرح لها بالعمل كنقاط بيع داخل المحل. المالك والمدير العام معفيان من هذا القيد.
                </p>
              </div>

              <button class="btn-primary" (click)="openRegisterDeviceModal.set(true)">
                <mat-icon>add_to_queue</mat-icon>
                <span>تسجيل جهاز محل جديد</span>
              </button>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>اسم الجهاز</th>
                    <th>المحل المخصص</th>
                    <th>رمز الجهاز</th>
                    <th>الحالة</th>
                    <th>تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody>
                  @for (dev of businessService.businessDevices(); track dev.id) {
                    <tr>
                      <td style="font-weight: 700;">{{ dev.deviceName }}</td>
                      <td>{{ getShopName(dev.shopId) }}</td>
                      <td style="font-family: monospace;">{{ dev.deviceToken }}</td>
                      <td><span class="badge-green">مصرح به للبيع</span></td>
                      <td>{{ i18n.formatDate(dev.createdAt) }}</td>
                    </tr>
                  }
                  @if (businessService.businessDevices().length === 0) {
                    <tr>
                      <td colspan="5" style="text-align: center; padding: 24px; color: var(--mh-text-muted);">
                        لم يتم تسجيل أجهزة محلات بعد.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- My Personal Devices -->
          <div class="glass-panel" style="padding: 24px;">
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 12px;">
              {{ i18n.t('biz.my_devices') }}
            </h3>
            <p style="font-size: 0.85rem; color: var(--mh-text-muted); margin-bottom: 16px;">
              الأجهزة الشخصية الخاصة بحسابك (الهاتف، اللابتوب). تتيح إدارة النشاط والمصادقة.
            </p>

            <div class="glass-card" style="padding: 16px; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <mat-icon style="font-size: 28px; color: #7c3aed;">laptop_mac</mat-icon>
                <div>
                  <div style="font-weight: 700;">هذا المتصفح الحالي (Current Device)</div>
                  <div style="font-size: 0.8rem; color: #64748b;">جلسة نشطة موثوقة</div>
                </div>
              </div>
              <span class="badge-green">نشط الآن</span>
            </div>
          </div>
        </div>
      }

      <!-- 6. SETTINGS TAB: Transfer Ownership & Business Config -->
      @if (activeTab() === 'settings') {
        <div class="glass-panel" style="padding: 24px;">
          <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
            إعدادات النشاط والملكية
          </h3>

          <div style="display: flex; flex-direction: column; gap: 16px; max-width: 600px;">
            <div class="glass-card" style="padding: 18px;">
              <div style="font-weight: 700; color: var(--mh-text-main); margin-bottom: 4px;">
                اسم النشاط: {{ businessService.currentBusiness()?.name }}
              </div>
              <div style="font-size: 0.85rem; color: var(--mh-text-muted);">
                العملة المعتمدة: {{ businessService.currentBusiness()?.currency }}
              </div>
            </div>

            <!-- Transfer Ownership Box (Only for Owner) -->
            @if (businessService.isOwner()) {
              <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 14px; padding: 20px;">
                <div style="font-weight: 800; color: #9f1239; margin-bottom: 6px;">
                  {{ i18n.t('biz.transfer_ownership') }}
                </div>
                <p style="font-size: 0.85rem; color: #881337; margin-bottom: 16px;">
                  يمكن لمالك النشاط نقل الملكية القانونية بالكامل إلى أي عضو مسجل في النشاط. ستتحول رتبتك بعد النقل إلى مدير عام.
                </p>

                <div style="display: flex; gap: 10px;">
                  <select #newOwnerSelect class="mh-select" style="max-width: 320px;">
                    @for (m of businessService.memberships(); track m.id) {
                      @if (m.role !== 'owner') {
                        <option [value]="m.userId">{{ m.displayName }} ({{ m.email }})</option>
                      }
                    }
                  </select>
                  <button class="btn-danger" (click)="handleTransferOwnership(newOwnerSelect.value)">
                    تأكيد نقل الملكية
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Add Shop Modal -->
      @if (openAddShopModal()) {
        <div class="modal-backdrop" (click)="openAddShopModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
              إضافة محل / فرع جديد للنشاط
            </h3>
            <form [formGroup]="shopForm" (ngSubmit)="handleAddShop()">
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">اسم الفرع / المحل</label>
                  <input type="text" formControlName="name" class="mh-input" placeholder="فرع الزهراء / المحل الثاني..." required />
                </div>
                <div>
                  <label class="form-label">النوع</label>
                  <select formControlName="type" class="mh-select">
                    <option value="retail">تجزئة</option>
                    <option value="restaurant">مطعم</option>
                    <option value="services">خدمات</option>
                    <option value="wholesale">جملة</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">العنوان</label>
                  <input type="text" formControlName="address" class="mh-input" placeholder="شارع الحبيب بورقيبة..." />
                </div>
                <div>
                  <label class="form-label">الهاتف</label>
                  <input type="text" formControlName="phone" class="mh-input" placeholder="+216..." />
                </div>
                <button type="submit" class="btn-primary" style="height: 48px; margin-top: 10px;" [disabled]="shopForm.invalid">
                  حفظ الفرع
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Invite User Modal (In-platform search & email) -->
      @if (openInviteModal()) {
        <div class="modal-backdrop" (click)="openInviteModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
              دعوة مستخدم مسجل للانضمام إلى النشاط
            </h3>
            <p style="font-size: 0.85rem; color: var(--mh-text-muted); margin-bottom: 16px;">
              دعوة داخلية بالمنصة: تصل الدعوة فوراً في صندوق إشعارات المستخدم ليقوم بقبولها أو رفضها.
            </p>

            <form [formGroup]="inviteForm" (ngSubmit)="handleSendInvitation()">
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">البريد الإلكتروني للمستخدم</label>
                  <input type="email" formControlName="email" class="mh-input" placeholder="colleague@example.com" required />
                </div>
                <div>
                  <label class="form-label">الدور الوظيفي المقترح</label>
                  <select formControlName="role" class="mh-select">
                    <option value="cashier">كاشير / بائع</option>
                    <option value="shop_manager">مدير فرع</option>
                    <option value="accountant">محاسب</option>
                    <option value="general_manager">مدير عام</option>
                    <option value="customer">عميل عادي</option>
                  </select>
                </div>
                <button type="submit" class="btn-primary" style="height: 48px; margin-top: 10px;" [disabled]="inviteForm.invalid">
                  إرسال الدعوة
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- QR Invite Modal -->
      @if (showInviteQr()) {
        <app-qr-display-modal
          title="رمز QR للدعوة والانضمام للنشاط"
          description="يمكن للموظف مسح هذا الرمز من هاتفه الشخصي لطلب الانضمام فوراً"
          [qrData]="'mahalat://invite/' + businessService.currentBusiness()?.id"
          (closed)="showInviteQr.set(false)"
        />
      }

      <!-- Change Role Modal -->
      @if (openChangeRoleModal()) {
        <div class="modal-backdrop" (click)="openChangeRoleModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
              تغيير دور: {{ selectedMemberForRole()?.displayName }}
            </h3>

            <div style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <label class="form-label">الدور الجديد</label>
                <select #newRoleSelect class="mh-select" [value]="selectedMemberForRole()?.role">
                  <option value="general_manager">مدير عام (كافة الفروع)</option>
                  <option value="shop_manager">مدير فرع</option>
                  <option value="cashier">كاشير / بائع</option>
                  <option value="accountant">محاسب (قراءة وتصدير فقط)</option>
                  <option value="customer">عميل عادي</option>
                </select>
              </div>

              <button
                class="btn-primary"
                style="height: 46px; margin-top: 10px;"
                (click)="handleChangeRoleSubmit(newRoleSelect.value)"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Register Business Device Modal -->
      @if (openRegisterDeviceModal()) {
        <div class="modal-backdrop" (click)="openRegisterDeviceModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
              تسجيل جهاز كاشير جديد في المحل
            </h3>
            <form [formGroup]="deviceForm" (ngSubmit)="handleRegisterDeviceSubmit()">
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">اسم الجهاز</label>
                  <input type="text" formControlName="deviceName" class="mh-input" placeholder="كاشير نقطة 1 (iPad / تابلت)..." required />
                </div>
                <div>
                  <label class="form-label">المحل المخصص له</label>
                  <select formControlName="shopId" class="mh-select">
                    @for (s of businessService.shops(); track s.id) {
                      <option [value]="s.id">{{ s.name }}</option>
                    }
                  </select>
                </div>
                <button type="submit" class="btn-primary" style="height: 48px; margin-top: 10px;" [disabled]="deviceForm.invalid">
                  تسجيل الجهاز وتوليد الرمز
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .biz-tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      color: #64748b;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }

    .biz-tab-btn.active {
      background: var(--mh-purple-deep);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(74, 21, 75, 0.2);
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
export class BusinessManagementComponent {
  public businessService = inject(BusinessService);
  public authService = inject(AuthService);
  public i18n = inject(I18nService);

  public activeTab = signal<'overview' | 'shops' | 'users' | 'roles' | 'devices' | 'settings'>('overview');

  public openAddShopModal = signal<boolean>(false);
  public openInviteModal = signal<boolean>(false);
  public showInviteQr = signal<boolean>(false);
  public openChangeRoleModal = signal<boolean>(false);
  public openRegisterDeviceModal = signal<boolean>(false);
  public selectedMemberForRole = signal<Membership | null>(null);

  public shopForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    type: new FormControl('retail', [Validators.required]),
    address: new FormControl(''),
    phone: new FormControl(''),
  });

  public inviteForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    role: new FormControl<Role>('cashier', [Validators.required]),
  });

  public deviceForm = new FormGroup({
    deviceName: new FormControl('', [Validators.required]),
    shopId: new FormControl('', [Validators.required]),
  });

  public onShopSelect(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const shop = this.businessService.shops().find((s) => s.id === select.value);
    if (shop) {
      this.businessService.activeShop.set(shop);
    }
  }

  public getShopName(shopId: string): string {
    return this.businessService.shops().find((s) => s.id === shopId)?.name || 'الفرع الرئيسي';
  }

  public getRoleTitle(role: string): string {
    const titles: Record<string, string> = {
      owner: 'المالك',
      general_manager: 'مدير عام',
      shop_manager: 'مدير فرع',
      cashier: 'كاشير',
      accountant: 'محاسب',
      customer: 'عميل',
    };
    return titles[role] || role;
  }

  public async handleAddShop(): Promise<void> {
    if (this.shopForm.invalid) return;
    const v = this.shopForm.value;
    await this.businessService.addShop({
      name: v.name!,
      type: v.type as any,
      address: v.address || '',
      phone: v.phone || '',
    });
    this.openAddShopModal.set(false);
    this.shopForm.reset({ type: 'retail' });
  }

  public async handleSendInvitation(): Promise<void> {
    if (this.inviteForm.invalid) return;
    const v = this.inviteForm.value;
    // Target user id by email
    const fakeId = 'target_' + v.email!.replace(/[^a-zA-Z0-9]/g, '_');
    await this.businessService.sendInvitation(v.email!, fakeId, v.role as Role);
    alert(`تم إرسال الدعوة إلى ${v.email} بنجاح!`);
    this.openInviteModal.set(false);
    this.inviteForm.reset({ role: 'cashier' });
  }

  public async handleChangeRoleSubmit(newRole: string): Promise<void> {
    const member = this.selectedMemberForRole();
    if (!member) return;
    await this.businessService.updateMemberRole(member.id, newRole as Role, member.shopIds);
    this.openChangeRoleModal.set(false);
  }

  public async handleTransferOwnership(newOwnerId: string): Promise<void> {
    if (!newOwnerId) return;
    const confirmed = confirm('هل أنت متأكد من رغبتك في نقل ملكية النشاط بالكامل لهذا المستخدم؟');
    if (confirmed) {
      await this.businessService.transferOwnership(newOwnerId);
      alert('تم نقل ملكية النشاط بنجاح!');
    }
  }

  public async handleRegisterDeviceSubmit(): Promise<void> {
    if (this.deviceForm.invalid) return;
    const v = this.deviceForm.value;
    await this.businessService.registerBusinessDevice(v.shopId!, v.deviceName!);
    this.openRegisterDeviceModal.set(false);
    this.deviceForm.reset();
  }
}
