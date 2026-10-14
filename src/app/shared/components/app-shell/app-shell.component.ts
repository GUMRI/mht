import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { BusinessService } from '../../../core/business/business.service';
import { I18nService, SUPPORTED_LOCALES, SupportedLocale } from '../../../core/i18n/i18n.service';
import { PinModal } from '../pin-modal/pin-modal.component';

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterModule, MatIconModule, PinModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell-layout">
      <!-- Desktop Responsive Side Rail -->
      <aside class="desktop-side-rail no-print">
        <div class="rail-brand">
          <div class="brand-avatar">
            <mat-icon style="font-size: 26px; color: #ffffff;">storefront</mat-icon>
          </div>
          <div class="brand-info">
            <div class="brand-title">{{ businessService.currentBusiness()?.name || i18n.t('app.name') }}</div>
            <div class="brand-subtitle">{{ businessService.activeShop()?.name || 'الفرع الرئيسي' }}</div>
          </div>
        </div>

        <nav class="rail-nav">
          <a
            routerLink="/home"
            routerLinkActive="active-tab"
            class="rail-item"
            title="الرئيسية والعمليات"
          >
            <mat-icon>dashboard</mat-icon>
            <span>{{ i18n.t('nav.home') }}</span>
          </a>

          <a
            routerLink="/pos"
            routerLinkActive="active-tab"
            class="rail-item"
            title="نقطة البيع"
          >
            <mat-icon>point_of_sale</mat-icon>
            <span>{{ i18n.t('nav.pos') }}</span>
          </a>

          <!-- Accounting tab: ONLY place that shows accounting terms -->
          @if (businessService.canAccessAccounting()) {
            <a
              routerLink="/accounting"
              routerLinkActive="active-tab"
              class="rail-item"
              title="المحاسبة العامة"
            >
              <mat-icon>account_balance</mat-icon>
              <span>{{ i18n.t('nav.accounting') }}</span>
            </a>
          }

          <a
            routerLink="/settings"
            routerLinkActive="active-tab"
            class="rail-item"
            title="الإعدادات وإدارة النشاط"
          >
            <mat-icon>settings</mat-icon>
            <span>{{ i18n.t('nav.settings') }}</span>
          </a>

          <!-- FUTURE: AI Workers Tab Hook -->
          <!-- <a class="rail-item disabled-future"><mat-icon>smart_toy</mat-icon><span>عامل الذكاء الاصطناعي</span></a> -->
        </nav>

        <!-- User Switching & Profile Footer -->
        <div class="rail-footer">
          <div class="active-user-badge" (click)="showPinModal.set(true)" title="انقر لتبديل المستخدم النشط">
            <div class="user-avatar">
              {{ authService.effectiveUserName().charAt(0) }}
            </div>
            <div class="user-details">
              <div class="user-name">{{ authService.effectiveUserName() }}</div>
              <div class="user-role">{{ getRoleTitle(authService.effectiveRole()) }}</div>
            </div>
            <mat-icon style="font-size: 18px; color: #7c3aed;">sync_alt</mat-icon>
          </div>

          <div class="lang-locale-bar">
            <button
              (click)="toggleLang()"
              class="pill-btn"
              [title]="i18n.currentLang() === 'ar' ? 'Switch to English' : 'التحويل للعربية'"
            >
              {{ i18n.currentLang() === 'ar' ? 'English' : 'عربي' }}
            </button>

            <select
              class="locale-select"
              [value]="i18n.currentLocale()"
              (change)="onLocaleChange($event)"
              title="تغيير العملة والمنطقة"
            >
              @for (loc of localeOptions; track loc.code) {
                <option [value]="loc.code">{{ loc.name }}</option>
              }
            </select>
          </div>
        </div>
      </aside>

      <!-- Main App Content Area -->
      <main class="main-content-area">
        <!-- Top Header Bar -->
        <header class="app-topbar no-print">
          <div class="topbar-left">
            @if (businessService.shops().length > 1) {
              <div class="shop-badge">
                <mat-icon style="font-size: 18px; color: var(--mh-purple-deep);">store</mat-icon>
                <select
                  class="shop-select"
                  [value]="businessService.activeShop()?.id"
                  (change)="onShopSelect($event)"
                >
                  @for (shop of businessService.shops(); track shop.id) {
                    <option [value]="shop.id">{{ shop.name }} ({{ shop.type }})</option>
                  }
                </select>
              </div>
            } @else {
              <div class="shop-badge">
                <mat-icon style="font-size: 18px; color: var(--mh-purple-deep);">store</mat-icon>
                <span>{{ businessService.activeShop()?.name || 'الفرع الرئيسي' }}</span>
              </div>
            }
          </div>

          <div class="topbar-right">
            <button
              class="topbar-btn"
              (click)="showPinModal.set(true)"
              title="تبديل المستخدم النشط"
            >
              <mat-icon style="font-size: 20px;">switch_account</mat-icon>
              <span class="desktop-only">{{ authService.effectiveUserName() }}</span>
            </button>

            <!-- Notifications / In-Platform Invitations Indicator -->
            <button
              routerLink="/settings/profile"
              class="topbar-btn position-relative"
              title="الإشعارات والدعوات"
            >
              <mat-icon style="font-size: 20px;">notifications</mat-icon>
              @if (pendingNotificationsCount() > 0) {
                <span class="notif-dot">{{ pendingNotificationsCount() }}</span>
              }
            </button>
          </div>
        </header>

        <!-- Router Outlet for Child Views -->
        <div class="page-body">
          <ng-content></ng-content>
        </div>

        <!-- FUTURE: AI Assistant Floating Action Button (FAB) Hook -->
        <!-- <div class="future-ai-fab" title="مساعد الذكاء الاصطناعي (قريباً)"><mat-icon>auto_awesome</mat-icon></div> -->
      </main>

      <!-- Mobile 4 Bottom Tabs (Home, POS, Accounting, Settings) -->
      <nav class="mobile-bottom-tabs no-print">
        <a routerLink="/home" routerLinkActive="active-mobile-tab" class="mobile-tab-item">
          <mat-icon>home</mat-icon>
          <span>{{ i18n.t('nav.home') }}</span>
        </a>

        <a routerLink="/pos" routerLinkActive="active-mobile-tab" class="mobile-tab-item">
          <mat-icon>point_of_sale</mat-icon>
          <span>{{ i18n.t('nav.pos') }}</span>
        </a>

        @if (businessService.canAccessAccounting()) {
          <a routerLink="/accounting" routerLinkActive="active-mobile-tab" class="mobile-tab-item">
            <mat-icon>account_balance</mat-icon>
            <span>{{ i18n.t('nav.accounting') }}</span>
          </a>
        }

        <a routerLink="/settings" routerLinkActive="active-mobile-tab" class="mobile-tab-item">
          <mat-icon>settings</mat-icon>
          <span>{{ i18n.t('nav.settings') }}</span>
        </a>
      </nav>

      <!-- PIN Switch Modal -->
      @if (showPinModal()) {
        <app-pin-modal (closed)="showPinModal.set(false)" />
      }
    </div>
  `,
  styles: [`
    .shell-layout {
      display: flex;
      min-height: 100vh;
      background-color: var(--mh-bg);
    }

    .desktop-side-rail {
      width: 260px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      border-inline-end: 1px solid var(--mh-border-subtle);
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      height: 100vh;
      z-index: 50;
      padding: 20px 16px;
    }

    .rail-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 30px;
      padding: 8px;
    }

    .brand-avatar {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #4a154b 0%, #7c3aed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(74, 21, 75, 0.25);
    }

    .brand-title {
      font-weight: 800;
      font-size: 1.15rem;
      color: var(--mh-purple-deep);
      line-height: 1.2;
    }

    .brand-subtitle {
      font-size: 0.8rem;
      color: var(--mh-text-muted);
    }

    .rail-nav {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }

    .rail-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 14px;
      color: #475569;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }

    .rail-item mat-icon {
      font-size: 22px;
      color: #64748b;
      transition: color 0.2s ease;
    }

    .rail-item:hover {
      background: rgba(124, 58, 237, 0.08);
      color: var(--mh-purple-deep);
    }

    .rail-item:hover mat-icon {
      color: #7c3aed;
    }

    .active-tab {
      background: linear-gradient(135deg, rgba(74, 21, 75, 0.12) 0%, rgba(124, 58, 237, 0.15) 100%) !important;
      color: var(--mh-purple-deep) !important;
      border-inline-start: 4px solid var(--mh-purple-deep);
    }

    .active-tab mat-icon {
      color: var(--mh-purple-deep) !important;
    }

    .rail-footer {
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-top: 1px solid var(--mh-border-subtle);
      padding-top: 16px;
    }

    .active-user-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f8f6fc;
      border: 1px solid #ebdffc;
      cursor: pointer;
      transition: all 0.2s;
    }

    .active-user-badge:hover {
      background: #f1e9fa;
      border-color: #d8b4fe;
    }

    .user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #7c3aed;
      color: #ffffff;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }

    .user-details {
      flex: 1;
      overflow: hidden;
    }

    .user-name {
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--mh-text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role {
      font-size: 0.75rem;
      color: #7c3aed;
      font-weight: 600;
    }

    .lang-locale-bar {
      display: flex;
      gap: 8px;
    }

    .pill-btn {
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--mh-border-subtle);
      background: #ffffff;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--mh-purple-deep);
      cursor: pointer;
    }

    .locale-select {
      flex: 1;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid var(--mh-border-subtle);
      background: #ffffff;
      font-size: 0.78rem;
      color: var(--mh-text-main);
      outline: none;
      cursor: pointer;
    }

    .main-content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding-bottom: 70px;
    }

    @media (min-width: 900px) {
      .main-content-area {
        padding-bottom: 0;
      }
    }

    .app-topbar {
      height: 64px;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--mh-border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .shop-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(237, 233, 254, 0.6);
      padding: 6px 12px;
      border-radius: 10px;
      border: 1px solid #ddd6fe;
      font-weight: 600;
      font-size: 0.88rem;
      color: var(--mh-purple-deep);
    }

    .shop-select {
      border: none;
      background: transparent;
      font-weight: 600;
      font-size: 0.88rem;
      color: var(--mh-purple-deep);
      outline: none;
      cursor: pointer;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .topbar-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--mh-border-subtle);
      background: rgba(255, 255, 255, 0.9);
      color: var(--mh-text-main);
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      position: relative;
    }

    .notif-dot {
      position: absolute;
      top: -4px;
      inset-inline-end: -4px;
      background: #ef4444;
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 700;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .page-body {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }

    /* Mobile Bottom Navigation */
    .mobile-bottom-tabs {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 64px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--mh-border-subtle);
      z-index: 100;
      align-items: center;
      justify-content: space-around;
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04);
    }

    .mobile-tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      color: #64748b;
      text-decoration: none;
      font-size: 0.75rem;
      font-weight: 600;
      width: 25%;
      height: 100%;
    }

    .mobile-tab-item mat-icon {
      font-size: 22px;
    }

    .active-mobile-tab {
      color: var(--mh-purple-deep) !important;
    }

    .active-mobile-tab mat-icon {
      color: var(--mh-purple-deep) !important;
    }

    @media (max-width: 899px) {
      .desktop-side-rail {
        display: none;
      }
      .mobile-bottom-tabs {
        display: flex;
      }
      .desktop-only {
        display: none;
      }
      .page-body {
        padding: 16px;
      }
    }
  `],
})
export class AppShell {
  public authService = inject(AuthService);
  public businessService = inject(BusinessService);
  public i18n = inject(I18nService);
  private router = inject(Router);

  public showPinModal = signal<boolean>(false);
  public localeOptions = Object.values(SUPPORTED_LOCALES);

  public pendingNotificationsCount = () => {
    return this.businessService.notifications().filter((n) => n.status === 'pending').length;
  };

  public toggleLang(): void {
    const next = this.i18n.currentLang() === 'ar' ? 'en' : 'ar';
    this.i18n.setLanguage(next);
  }

  public onLocaleChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    if (select.value) {
      this.i18n.setLocale(select.value as SupportedLocale);
    }
  }

  public onShopSelect(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const shop = this.businessService.shops().find((s) => s.id === select.value);
    if (shop) {
      this.businessService.activeShop.set(shop);
    }
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
}
