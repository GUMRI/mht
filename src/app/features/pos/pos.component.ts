import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PosOrdersService } from '../../core/pos/pos-orders.service';
import { ProductService } from '../../core/pos/product.service';
import { ShiftService } from '../../core/pos/shift.service';
import { PartyService } from '../../core/pos/party.service';
import { InvoiceService } from '../../core/pos/invoice.service';
import { BusinessService } from '../../core/business/business.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ScannerModal } from '../../shared/components/scanner-modal/scanner-modal.component';
import { Party, Product, InvoicePayment } from '../../core/models';

@Component({
  selector: 'app-pos',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, ScannerModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pos-container">
      <!-- 1. Parallel Orders Top Browser Tabs Toolbar -->
      <div class="order-tabs-bar no-print">
        <div class="tabs-scroll-area">
          @for (tab of posOrders.orders(); track tab.id) {
            <div
              class="order-tab"
              [class.active-order]="tab.id === posOrders.activeOrderId()"
              (click)="posOrders.selectOrder(tab.id)"
            >
              <div class="tab-title-text">{{ tab.title }}</div>
              @if (tab.items.length > 0) {
                <span class="tab-count-badge">{{ tab.items.length }}</span>
              }
              <button
                class="tab-close-btn"
                (click)="$event.stopPropagation(); posOrders.closeOrderTab(tab.id)"
                title="إغلاق الطلب"
              >
                <mat-icon style="font-size: 16px;">close</mat-icon>
              </button>
            </div>
          }

          <!-- Auto New Order Button '+' -->
          <button
            class="add-order-tab-btn"
            (click)="posOrders.createNewOrder()"
            title="فتح طلب جديد موازٍ"
          >
            <mat-icon>add</mat-icon>
          </button>
        </div>

        <!-- Shift Info & Completed Orders Archive Folder (📁) -->
        <div class="tabs-actions">
          <button
            class="archive-folder-btn"
            (click)="showCompletedModal.set(true)"
            title="أرشيف الطلبات المكتملة بالوردية"
          >
            <mat-icon>folder_open</mat-icon>
            <span class="desktop-only">المكتملة ({{ posOrders.completedShiftOrders().length }})</span>
          </button>

          @if (shiftService.isShiftOpen()) {
            <button class="shift-btn open" (click)="openCloseShiftModal.set(true)">
              <mat-icon>point_of_sale</mat-icon>
              <span>وردية نشطة (إغلاق)</span>
            </button>
          } @else {
            <button class="shift-btn closed" (click)="openShiftModal.set(true)">
              <mat-icon>lock_open</mat-icon>
              <span>فتح وردية جديدة</span>
            </button>
          }
        </div>
      </div>

      <!-- No Shift Gate Warning -->
      @if (!shiftService.isShiftOpen()) {
        <div class="no-shift-banner glass-panel">
          <div style="font-size: 40px; margin-bottom: 8px;">🔒</div>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 6px;">
            {{ i18n.t('pos.no_open_shift') }}
          </h2>
          <p style="font-size: 0.9rem; color: var(--mh-text-muted); max-width: 480px; margin-bottom: 20px;">
            وفقاً لسياسة النظام المالي الصارمة، لا يمكن إنشاء أي مبيعات أو فواتير إلا بوجود وردية كاشير مفتوحة ذات عهدة نقدية محددة.
          </p>
          <button class="btn-primary" style="height: 48px; padding: 0 24px;" (click)="openShiftModal.set(true)">
            <mat-icon>key</mat-icon>
            <span>فتح وردية الكاشير الآن</span>
          </button>
        </div>
      } @else {
        <!-- Active Order Content: Two Subviews Switch -->
        <div class="pos-main-layout">
          <!-- View Switcher Toolbar (POS vs Status) -->
          <div class="view-switcher-bar no-print">
            <button
              class="subview-btn"
              [class.active]="posOrders.activeOrder()?.activeSubView === 'pos'"
              (click)="posOrders.setSubView('pos')"
            >
              <mat-icon>point_of_sale</mat-icon>
              <span>{{ i18n.t('pos.tab_pos') }}</span>
            </button>

            <button
              class="subview-btn"
              [class.active]="posOrders.activeOrder()?.activeSubView === 'status'"
              (click)="posOrders.setSubView('status')"
            >
              <mat-icon>soup_kitchen</mat-icon>
              <span>{{ i18n.t('pos.tab_status') }}</span>
              @if (posOrders.activeUnfinishedCount() > 0) {
                <span class="status-counter-dot">{{ posOrders.activeUnfinishedCount() }}</span>
              }
            </button>
          </div>

          <!-- SUBVIEW A: POS SCANNING & CART -->
          @if (posOrders.activeOrder()?.activeSubView === 'pos') {
            <div class="pos-split-grid">
              <!-- Left Column: Product Catalog & Search/Barcode -->
              <div class="catalog-column glass-panel">
                <div class="search-barcode-box">
                  <div style="display: flex; gap: 8px; flex: 1;">
                    <div style="position: relative; flex: 1;">
                      <mat-icon style="position: absolute; right: 12px; top: 12px; color: #94a3b8;">search</mat-icon>
                      <input
                        #searchBox
                        type="text"
                        class="mh-input"
                        style="padding-right: 40px;"
                        [placeholder]="i18n.t('pos.scan_barcode')"
                        (input)="catalogSearch.set(searchBox.value)"
                        (keyup.enter)="handleSearchEnter(searchBox.value); searchBox.value = ''"
                      />
                    </div>
                    <button class="btn-primary" (click)="showScannerModal.set(true)" title="مسح باركود بالكاميرا">
                      <mat-icon>qr_code_scanner</mat-icon>
                    </button>
                  </div>
                </div>

                <!-- Products Grid -->
                <div class="products-grid">
                  @for (prod of filteredProducts(); track prod.id) {
                    <div
                      class="product-pos-card"
                      (click)="posOrders.addItemToActiveOrder(prod)"
                    >
                      <div class="prod-badge-row">
                        <span class="prod-unit">{{ prod.unit }}</span>
                        @if (prod.type === 'physical') {
                          <span [class]="prod.stock <= prod.minStock ? 'stock-pill low' : 'stock-pill'">
                            {{ prod.stock }} متاح
                          </span>
                        }
                      </div>
                      <div class="prod-name">{{ prod.name }}</div>
                      <div class="prod-price">{{ i18n.formatCurrency(prod.sellingPrice) }}</div>
                    </div>
                  }
                  @if (filteredProducts().length === 0) {
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
                      لا توجد منتجات مطابقة لعملية البحث
                    </div>
                  }
                </div>
              </div>

              <!-- Right Column: Active Cart & Totals & Payments -->
              <div class="cart-column glass-panel">
                <!-- Customer Selection Header -->
                <div class="customer-bar">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <mat-icon style="color: var(--mh-purple-deep); font-size: 20px;">person</mat-icon>
                    <select
                      class="customer-select"
                      [value]="posOrders.activeOrder()?.customer?.id || ''"
                      (change)="onCustomerSelect($event)"
                    >
                      <option value="">عميل نقدي عابر (افتراضي)</option>
                      @for (c of partyService.customers(); track c.id) {
                        <option [value]="c.id">{{ c.name }} (حد: {{ c.customerProfile?.creditLimit }})</option>
                      }
                    </select>
                  </div>
                  <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" (click)="openNewCustomerModal.set(true)">
                    + جديد
                  </button>
                </div>

                <!-- Cart Items List -->
                <div class="cart-items-scroll">
                  @if (!posOrders.activeOrder() || posOrders.activeOrder()!.items.length === 0) {
                    <div class="cart-empty-state">
                      <mat-icon style="font-size: 48px; color: #cbd5e1;">shopping_bag</mat-icon>
                      <p>{{ i18n.t('pos.cart_empty') }}</p>
                    </div>
                  } @else {
                    @for (item of posOrders.activeOrder()!.items; track item.productId) {
                      <div class="cart-item-row">
                        <div class="item-info">
                          <div class="item-name">{{ item.name }}</div>
                          <div class="item-unit-price">{{ i18n.formatCurrency(item.unitPrice) }}</div>
                        </div>

                        <div class="item-qty-controls">
                          <button class="qty-btn" (click)="posOrders.updateItemQuantity(item.productId, -1)">-</button>
                          <span class="qty-num">{{ item.quantity }}</span>
                          <button class="qty-btn" (click)="posOrders.updateItemQuantity(item.productId, 1)">+</button>
                        </div>

                        <div class="item-total-price">
                          {{ i18n.formatCurrency(item.total) }}
                        </div>

                        <button class="item-del-btn" (click)="posOrders.removeItem(item.productId)">
                          <mat-icon style="font-size: 16px;">delete</mat-icon>
                        </button>
                      </div>
                    }
                  }
                </div>

                <!-- Totals & Checkout -->
                <div class="cart-summary-box">
                  <div class="summary-line">
                    <span>{{ i18n.t('pos.subtotal') }}</span>
                    <span>{{ i18n.formatCurrency(activeCartSubtotal()) }}</span>
                  </div>

                  @if (activeCartDiscount() > 0) {
                    <div class="summary-line" style="color: #16a34a;">
                      <span>{{ i18n.t('pos.discount') }}</span>
                      <span>-{{ i18n.formatCurrency(activeCartDiscount()) }}</span>
                    </div>
                  }

                  <div class="summary-line grand-total">
                    <span>{{ i18n.t('pos.grand_total') }}</span>
                    <span>{{ i18n.formatCurrency(activeCartGrandTotal()) }}</span>
                  </div>

                  <!-- Checkout Payment Button -->
                  <button
                    class="btn-primary checkout-btn"
                    [disabled]="!posOrders.activeOrder() || posOrders.activeOrder()!.items.length === 0"
                    (click)="openPaymentModal.set(true)"
                  >
                    <mat-icon>shopping_cart_checkout</mat-icon>
                    <span>{{ i18n.t('pos.pay') }} ({{ i18n.formatCurrency(activeCartGrandTotal()) }})</span>
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- SUBVIEW B: PREPARATION & STATUS PROGRESS -->
          @if (posOrders.activeOrder()?.activeSubView === 'status') {
            <div class="status-view glass-panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep);">
                  متابعة حالة تجهيز الطلب {{ posOrders.activeOrder()?.title }}
                </h3>
                <div class="badge-purple">
                  المتبقي للتجهيز: {{ posOrders.activeUnfinishedCount() }} أصناف
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 12px;">
                @for (item of posOrders.activeOrder()?.items; track item.productId) {
                  <div
                    class="glass-card status-item-card"
                    [class.done]="item.preparationDone"
                    (click)="posOrders.toggleItemPreparation(item.productId)"
                  >
                    <div class="check-box-circle" [class.checked]="item.preparationDone">
                      @if (item.preparationDone) {
                        <mat-icon style="font-size: 18px; color: #ffffff;">check</mat-icon>
                      }
                    </div>

                    <div style="flex: 1;">
                      <div class="status-item-name" [style.text-decoration]="item.preparationDone ? 'line-through' : 'none'">
                        {{ item.name }}
                      </div>
                      <div style="font-size: 0.8rem; color: var(--mh-text-muted);">
                        الكمية: {{ item.quantity }}
                      </div>
                    </div>

                    <span [class]="item.preparationDone ? 'badge-green' : 'badge-amber'">
                      {{ item.preparationDone ? 'تم التجهيز' : 'قيد التحضير' }}
                    </span>
                  </div>
                }
                @if (posOrders.activeOrder()?.items?.length === 0) {
                  <div style="text-align: center; padding: 40px; color: var(--mh-text-muted);">
                    لا توجد أصناف في هذا الطلب بعد.
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Open Shift Modal -->
      @if (openShiftModal()) {
        <div class="modal-backdrop" (click)="openShiftModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
              {{ i18n.t('pos.shift_open') }}
            </h3>
            <p style="font-size: 0.88rem; color: var(--mh-text-muted); margin-bottom: 20px;">
              أدخل مبلغ العهدة النقدية الموجودة في الصندوق لبدء الوردية.
            </p>

            <form [formGroup]="openShiftForm" (ngSubmit)="handleOpenShift()">
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">العهدة النقدية الأولية (الافتتاحية)</label>
                  <input type="number" formControlName="openingCash" class="mh-input" placeholder="0.00" required />
                </div>
                <div>
                  <label class="form-label">ملاحظات (اختياري)</label>
                  <input type="text" formControlName="notes" class="mh-input" placeholder="استلام وردية الصباح..." />
                </div>
                <button type="submit" class="btn-primary" style="height: 48px; margin-top: 10px;">
                  تأكيد فتح الوردية
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Close Shift Modal with Cash Count & Auto Shortage/Overage Posting -->
      @if (openCloseShiftModal()) {
        <div class="modal-backdrop" (click)="openCloseShiftModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 12px;">
              {{ i18n.t('pos.shift_close') }}
            </h3>
            <p style="font-size: 0.85rem; color: var(--mh-text-muted); margin-bottom: 16px;">
              العد النقدي للصندوق: سيقوم النظام بحساب أي عجز أو فائض وتوليد قيد محاسبي آلي في حساب الفروقات (5601 / 4401).
            </p>

            <div style="background: #f8f6fc; padding: 14px; border-radius: 12px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px;">
                <span>العهدة الافتتاحية:</span>
                <span style="font-weight: 700;">{{ i18n.formatCurrency(shiftService.activeShift()?.openingCash || 0) }}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                <span>المبيعات النقدية المقدرة:</span>
                <span style="font-weight: 700; color: #16a34a;">+{{ i18n.formatCurrency(activeShiftSalesTotal()) }}</span>
              </div>
            </div>

            <form [formGroup]="closeShiftForm" (ngSubmit)="handleCloseShift()">
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">المبلغ النقدي المحسوب فعلياً بالصندوق</label>
                  <input
                    type="number"
                    formControlName="actualCash"
                    class="mh-input"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label class="form-label">ملاحظات الإغلاق</label>
                  <input type="text" formControlName="notes" class="mh-input" placeholder="تسليم للمناوب القادم..." />
                </div>
                <button type="submit" class="btn-primary" style="height: 48px; margin-top: 10px;">
                  إغلاق الوردية وترحيل الفروقات
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Payment & Checkout Modal (Cash, Card, Bank, Credit Debt, Partial/Mixed) -->
      @if (openPaymentModal()) {
        <div class="modal-backdrop" (click)="openPaymentModal.set(false)">
          <div class="modal-content" style="padding: 24px; max-width: 520px;" (click)="$event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--mh-purple-deep);">
                سداد الفاتورة - {{ i18n.formatCurrency(activeCartGrandTotal()) }}
              </h3>
              <button (click)="openPaymentModal.set(false)" style="background: none; border: none; cursor: pointer;">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Customer status check for credit -->
            @if (posOrders.activeOrder()?.customer) {
              <div style="background: #ede9fe; padding: 12px; border-radius: 12px; margin-bottom: 16px; font-size: 0.88rem;">
                <div style="font-weight: 700; color: #6b21a8;">
                  العميل: {{ posOrders.activeOrder()?.customer?.name }}
                </div>
                <div style="color: #475569; font-size: 0.8rem; margin-top: 2px;">
                  الحد الائتماني: {{ i18n.formatCurrency(posOrders.activeOrder()?.customer?.customerProfile?.creditLimit || 0) }} | المديونية الحالية: {{ i18n.formatCurrency(posOrders.activeOrder()?.customer?.customerProfile?.currentDebt || 0) }}
                </div>
              </div>
            }

            <!-- Payment Methods Selectors -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px;">
              <button
                type="button"
                class="pay-method-btn"
                [class.selected]="selectedPaymentMethod() === 'cash'"
                (click)="selectedPaymentMethod.set('cash')"
              >
                <mat-icon>payments</mat-icon>
                <span>نقداً</span>
              </button>

              <button
                type="button"
                class="pay-method-btn"
                [class.selected]="selectedPaymentMethod() === 'card'"
                (click)="selectedPaymentMethod.set('card')"
              >
                <mat-icon>credit_card</mat-icon>
                <span>بطاقة بنكية</span>
              </button>

              <button
                type="button"
                class="pay-method-btn"
                [class.selected]="selectedPaymentMethod() === 'bank_transfer'"
                (click)="selectedPaymentMethod.set('bank_transfer')"
              >
                <mat-icon>account_balance</mat-icon>
                <span>تحويل بنكي</span>
              </button>

              <button
                type="button"
                class="pay-method-btn"
                [class.selected]="selectedPaymentMethod() === 'credit'"
                (click)="selectedPaymentMethod.set('credit')"
              >
                <mat-icon>receipt</mat-icon>
                <span>آجل (دين)</span>
              </button>
            </div>

            <!-- Amount Input (Supports Partial / Mixed) -->
            <div style="margin-bottom: 20px;">
              <label class="form-label">المبلغ المدفوع</label>
              <input
                type="number"
                [value]="paymentAmount()"
                (input)="paymentAmount.set(+$any($event.target).value)"
                class="mh-input"
                style="font-size: 1.4rem; font-weight: 800; text-align: center; color: var(--mh-purple-deep);"
              />
            </div>

            @if (paymentError()) {
              <div style="color: #ef4444; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">
                {{ paymentError() }}
              </div>
            }

            <button
              class="btn-primary"
              style="width: 100%; height: 50px; font-size: 1.05rem;"
              (click)="executeSalePayment()"
            >
              <mat-icon>done_all</mat-icon>
              <span>تأكيد وطباعة الإيصال</span>
            </button>
          </div>
        </div>
      }

      <!-- Completed Orders Drawer Modal (📁) -->
      @if (showCompletedModal()) {
        <div class="modal-backdrop" (click)="showCompletedModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep);">
                الطلبات المكتملة بالوردية (📁)
              </h3>
              <button (click)="showCompletedModal.set(false)" style="background: none; border: none; cursor: pointer;">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; max-height: 380px; overflow-y: auto;">
              @for (co of posOrders.completedShiftOrders(); track co.id) {
                <div class="glass-card" style="padding: 14px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 700; color: var(--mh-text-main);">{{ co.title }}</div>
                    <div style="font-size: 0.8rem; color: var(--mh-text-muted);">
                      {{ co.items.length }} أصناف • {{ i18n.formatDate(co.createdAt) }}
                    </div>
                  </div>
                  <span class="badge-green">مكتمل</span>
                </div>
              }
              @if (posOrders.completedShiftOrders().length === 0) {
                <div style="text-align: center; padding: 30px; color: var(--mh-text-muted);">
                  لا توجد طلبات مكتملة في هذه الوردية بعد.
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Printable Receipt Modal -->
      @if (showReceiptModal()) {
        <div class="modal-backdrop" (click)="showReceiptModal.set(false)">
          <div class="modal-content printable-area" style="padding: 24px; max-width: 380px;" (click)="$event.stopPropagation()">
            <div class="no-print" style="display: flex; justify-content: space-between; margin-bottom: 14px;">
              <button class="btn-primary" (click)="printReceipt()">
                <mat-icon>print</mat-icon>
                <span>طباعة</span>
              </button>
              <button (click)="showReceiptModal.set(false)" style="background: none; border: none; cursor: pointer;">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 12px;">
              <div style="font-weight: 800; font-size: 1.2rem; color: var(--mh-purple-deep);">
                {{ businessService.currentBusiness()?.name }}
              </div>
              <div style="font-size: 0.8rem; color: #64748b;">
                {{ businessService.activeShop()?.name }}
              </div>
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
                فاتورة مبيعات مبسطة
              </div>
            </div>

            @if (lastCompletedInvoice()) {
              <div style="font-size: 0.8rem; margin-bottom: 12px; display: flex; justify-content: space-between;">
                <span>رقم الفاتورة: #{{ lastCompletedInvoice()?.invoiceNumber }}</span>
                <span>{{ i18n.formatDate(lastCompletedInvoice()?.createdAt) }}</span>
              </div>

              <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px;">
                @for (item of lastCompletedInvoice()?.items; track item.productId) {
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                    <span>{{ item.quantity }} × {{ item.name }}</span>
                    <span>{{ i18n.formatCurrency(item.total) }}</span>
                  </div>
                }
              </div>

              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.1rem; color: var(--mh-purple-deep);">
                <span>الإجمالي الصافي:</span>
                <span>{{ i18n.formatCurrency(lastCompletedInvoice()?.grandTotal || 0) }}</span>
              </div>
            }

            <div style="text-align: center; margin-top: 16px; font-size: 0.78rem; color: #94a3b8;">
              شكراً لزيارتكم!
            </div>
          </div>
        </div>
      }

      <!-- Scanner Modal -->
      @if (showScannerModal()) {
        <app-scanner-modal
          (scanned)="handleScannedBarcode($event)"
          (closed)="showScannerModal.set(false)"
        />
      }
    </div>
  `,
  styles: [`
    .pos-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: calc(100vh - 110px);
    }

    .order-tabs-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      padding: 8px 12px;
      border-radius: 16px;
      border: 1px solid var(--mh-border-subtle);
      overflow-x: auto;
    }

    .tabs-scroll-area {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      flex: 1;
    }

    .order-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 12px;
      background: #f1e9fa;
      color: #64748b;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      white-space: nowrap;
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .order-tab.active-order {
      background: var(--mh-purple-deep);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(74, 21, 75, 0.2);
    }

    .tab-count-badge {
      background: #7c3aed;
      color: #ffffff;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      font-size: 0.7rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tab-close-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: inherit;
      opacity: 0.7;
      display: flex;
      align-items: center;
    }

    .tab-close-btn:hover {
      opacity: 1;
    }

    .add-order-tab-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1.5px dashed #a855f7;
      background: #faf5ff;
      color: #7c3aed;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .tabs-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .archive-folder-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--mh-border-subtle);
      background: #ffffff;
      color: var(--mh-purple-deep);
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .shift-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 10px;
      border: none;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .shift-btn.open {
      background: #dcfce7;
      color: #15803d;
    }

    .shift-btn.closed {
      background: #fee2e2;
      color: #b91c1c;
    }

    .no-shift-banner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 24px;
      text-align: center;
      flex: 1;
    }

    .pos-main-layout {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .view-switcher-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .subview-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 10px;
      border: 1px solid var(--mh-border-subtle);
      background: #ffffff;
      color: #64748b;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      position: relative;
    }

    .subview-btn.active {
      background: #ede9fe;
      color: #6b21a8;
      border-color: #d8b4fe;
    }

    .status-counter-dot {
      background: #ef4444;
      color: #ffffff;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 0.7rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }

    .pos-split-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 16px;
      flex: 1;
      min-height: 0;
    }

    @media (max-width: 950px) {
      .pos-split-grid {
        grid-template-columns: 1fr;
      }
    }

    .catalog-column {
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .search-barcode-box {
      margin-bottom: 14px;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      overflow-y: auto;
      flex: 1;
      padding: 4px;
    }

    .product-pos-card {
      background: #ffffff;
      border: 1px solid var(--mh-border-subtle);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
      transition: all 0.2s;
      min-height: 105px;
    }

    .product-pos-card:hover {
      border-color: #7c3aed;
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(74, 21, 75, 0.08);
    }

    .prod-badge-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: #94a3b8;
    }

    .stock-pill {
      background: #f1f5f9;
      color: #475569;
      padding: 2px 6px;
      border-radius: 6px;
    }

    .stock-pill.low {
      background: #fee2e2;
      color: #b91c1c;
    }

    .prod-name {
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--mh-text-main);
      margin: 6px 0;
      line-height: 1.25;
    }

    .prod-price {
      font-weight: 800;
      font-size: 0.95rem;
      color: #16a34a;
    }

    .cart-column {
      display: flex;
      flex-direction: column;
      padding: 16px;
      min-height: 0;
    }

    .customer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--mh-border-subtle);
      padding-bottom: 12px;
      margin-bottom: 12px;
    }

    .customer-select {
      border: none;
      background: transparent;
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--mh-purple-deep);
      outline: none;
      max-width: 220px;
    }

    .cart-items-scroll {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .cart-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
      text-align: center;
      gap: 8px;
      font-size: 0.9rem;
    }

    .cart-item-row {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid var(--mh-border-subtle);
      padding: 10px;
      border-radius: 12px;
    }

    .item-info {
      flex: 1;
    }

    .item-name {
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--mh-text-main);
    }

    .item-unit-price {
      font-size: 0.78rem;
      color: #64748b;
    }

    .item-qty-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f8f6fc;
      border-radius: 8px;
      padding: 2px 4px;
    }

    .qty-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: #ffffff;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
    }

    .qty-num {
      font-weight: 700;
      font-size: 0.85rem;
      min-width: 16px;
      text-align: center;
    }

    .item-total-price {
      font-weight: 800;
      font-size: 0.9rem;
      color: var(--mh-purple-deep);
      min-width: 65px;
      text-align: end;
    }

    .item-del-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
    }

    .item-del-btn:hover {
      color: #ef4444;
    }

    .cart-summary-box {
      border-top: 1px solid var(--mh-border-subtle);
      padding-top: 14px;
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      color: #64748b;
    }

    .summary-line.grand-total {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--mh-purple-deep);
      border-top: 1px dashed var(--mh-border-subtle);
      padding-top: 8px;
    }

    .checkout-btn {
      height: 48px;
      font-size: 1rem;
      margin-top: 6px;
    }

    .status-view {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    }

    .status-item-card {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      border: 1px solid var(--mh-border-subtle);
    }

    .status-item-card.done {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    .check-box-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .check-box-circle.checked {
      background: #10b981;
      border-color: #10b981;
    }

    .status-item-name {
      font-weight: 700;
      font-size: 1rem;
      color: var(--mh-text-main);
    }

    .pay-method-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 6px;
      border-radius: 12px;
      border: 1px solid var(--mh-border-subtle);
      background: #ffffff;
      color: #64748b;
      font-weight: 600;
      font-size: 0.78rem;
      cursor: pointer;
    }

    .pay-method-btn.selected {
      background: #ede9fe;
      border-color: #7c3aed;
      color: var(--mh-purple-deep);
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
export class PosComponent {
  public posOrders = inject(PosOrdersService);
  public productService = inject(ProductService);
  public shiftService = inject(ShiftService);
  public partyService = inject(PartyService);
  public invoiceService = inject(InvoiceService);
  public businessService = inject(BusinessService);
  public i18n = inject(I18nService);

  public catalogSearch = signal<string>('');
  public openShiftModal = signal<boolean>(false);
  public openCloseShiftModal = signal<boolean>(false);
  public openPaymentModal = signal<boolean>(false);
  public showCompletedModal = signal<boolean>(false);
  public showScannerModal = signal<boolean>(false);
  public showReceiptModal = signal<boolean>(false);
  public openNewCustomerModal = signal<boolean>(false);

  public selectedPaymentMethod = signal<'cash' | 'card' | 'bank_transfer' | 'credit'>('cash');
  public paymentAmount = signal<number>(0);
  public paymentError = signal<string>('');
  public lastCompletedInvoice = signal<any>(null);

  public openShiftForm = new FormGroup({
    openingCash: new FormControl(50, [Validators.required]),
    notes: new FormControl(''),
  });

  public closeShiftForm = new FormGroup({
    actualCash: new FormControl(0, [Validators.required]),
    notes: new FormControl(''),
  });

  public filteredProducts = computed(() => {
    const q = this.catalogSearch().toLowerCase().trim();
    if (!q) return this.productService.products().filter((p) => p.isActive);
    return this.productService
      .products()
      .filter((p) => p.isActive && (p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))));
  });

  public activeCartSubtotal = computed(() => {
    const order = this.posOrders.activeOrder();
    if (!order) return 0;
    return order.items.reduce((sum, item) => sum + item.total, 0);
  });

  public activeCartDiscount = computed(() => {
    const order = this.posOrders.activeOrder();
    if (!order || !order.discountPercent) return 0;
    return Number(((this.activeCartSubtotal() * order.discountPercent) / 100).toFixed(4));
  });

  public activeCartGrandTotal = computed(() => {
    return Number((this.activeCartSubtotal() - this.activeCartDiscount()).toFixed(4));
  });

  public activeShiftSalesTotal = computed(() => {
    const shift = this.shiftService.activeShift();
    if (!shift) return 0;
    return this.invoiceService
      .invoices()
      .filter((i) => i.shiftId === shift.id && i.type === 'sale')
      .reduce((sum, i) => sum + i.grandTotal, 0);
  });

  public onCustomerSelect(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const customer = this.partyService.customers().find((c) => c.id === select.value);
    this.posOrders.setCustomer(customer);
  }

  public handleSearchEnter(val: string): void {
    const trimmed = val.trim();
    if (!trimmed) return;
    const prod = this.productService.findByBarcode(trimmed);
    if (prod) {
      this.posOrders.addItemToActiveOrder(prod);
    }
  }

  public handleScannedBarcode(code: string): void {
    const prod = this.productService.findByBarcode(code);
    if (prod) {
      this.posOrders.addItemToActiveOrder(prod);
    } else {
      alert(`لم يتم العثور على منتج مسجل بالباركود: ${code}`);
    }
  }

  public async handleOpenShift(): Promise<void> {
    if (this.openShiftForm.invalid) return;
    const v = this.openShiftForm.value;
    await this.shiftService.openShift(Number(v.openingCash || 0), v.notes || '');
    this.openShiftModal.set(false);
  }

  public async handleCloseShift(): Promise<void> {
    if (this.closeShiftForm.invalid) return;
    const v = this.closeShiftForm.value;
    const opening = this.shiftService.activeShift()?.openingCash || 0;
    const expected = opening + this.activeShiftSalesTotal();
    await this.shiftService.closeShift(Number(v.actualCash || 0), expected, v.notes || '');
    this.openCloseShiftModal.set(false);
  }

  public async executeSalePayment(): Promise<void> {
    const order = this.posOrders.activeOrder();
    const shop = this.businessService.activeShop();
    const shift = this.shiftService.activeShift();
    if (!order || !shop || !shift || order.items.length === 0) return;

    const total = this.activeCartGrandTotal();
    const method = this.selectedPaymentMethod();

    this.paymentError.set('');

    const payments: InvoicePayment[] = [
      {
        method,
        amount: total,
      },
    ];

    try {
      const result = await this.invoiceService.completeSale({
        shopId: shop.id,
        shiftId: shift.id,
        items: order.items,
        customer: order.customer,
        discountTotal: this.activeCartDiscount(),
        payments,
      });

      this.lastCompletedInvoice.set(result.invoice);
      this.posOrders.completeOrder(order.id);
      this.openPaymentModal.set(false);
      this.showReceiptModal.set(true);
    } catch (err: any) {
      this.paymentError.set(err.message || 'فشلت عملية البيع.');
    }
  }

  public printReceipt(): void {
    window.print();
  }
}
