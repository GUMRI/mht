import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, Router } from '@angular/router';
import { BusinessService } from '../../core/business/business.service';
import { InvoiceService } from '../../core/pos/invoice.service';
import { ProductService } from '../../core/pos/product.service';
import { PartyService } from '../../core/pos/party.service';
import { ShiftService } from '../../core/pos/shift.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Product, Party, Invoice } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      @if (!businessService.currentBusiness()) {
        <div class="glass-card" style="padding: 24px; border: 2px dashed #a855f7; background: rgba(237, 233, 254, 0.7); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 48px; height: 48px; border-radius: 14px; background: #6b21a8; color: #fff; display: flex; align-items: center; justify-content: center;">
              <mat-icon style="font-size: 28px;">business</mat-icon>
            </div>
            <div>
              <div style="font-weight: 800; font-size: 1.15rem; color: var(--mh-purple-deep);">لم يتم إنشاء أو ربط نشاط تجاري بعد</div>
              <div style="font-size: 0.9rem; color: var(--mh-text-muted); margin-top: 2px;">للبدء في إضافة الأصناف والبيع وإدارة العمليات، يرجى إنشاء نشاط تجاري أو الانضمام لنشاطك.</div>
            </div>
          </div>
          <a routerLink="/auth/onboarding" class="btn-primary" style="text-decoration: none;">
            <mat-icon>add_business</mat-icon>
            <span>إنشاء نشاط تجاري الآن</span>
          </a>
        </div>
      }

      <!-- Top Welcome Banner & Quick Action Buttons -->
      <div class="glass-panel" style="padding: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 4px;">
            مرحباً بك في {{ businessService.currentBusiness()?.name || 'محلات' }}
          </h1>
          <p style="font-size: 0.9rem; color: var(--mh-text-muted);">
            لوحة العمليات اليومية وإدارة المحل: المنتجات، المبيعات، المشتريات وسندات الخزينة
          </p>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <a routerLink="/pos" class="btn-primary" style="text-decoration: none;">
            <mat-icon>point_of_sale</mat-icon>
            <span>فتح شاشة البيع (POS)</span>
          </a>

          <button class="btn-secondary" (click)="openAddProductModal.set(true)">
            <mat-icon>add_box</mat-icon>
            <span>إضافة منتج جديد</span>
          </button>
        </div>
      </div>

      <!-- Merchant Metric Cards (NO Accounting Jargon here!) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        <div class="glass-card" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">مبيعات اليوم</span>
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #ede9fe; color: #6b21a8; display: flex; align-items: center; justify-content: center;">
              <mat-icon style="font-size: 20px;">payments</mat-icon>
            </div>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--mh-purple-deep);">
            {{ i18n.formatCurrency(todaySalesTotal()) }}
          </div>
          <div style="font-size: 0.8rem; color: #10b981; margin-top: 4px; font-weight: 600;">
            {{ todayInvoicesCount() }} عملية مكتملة
          </div>
        </div>

        <div class="glass-card" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">المنتجات النشطة</span>
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center;">
              <mat-icon style="font-size: 20px;">inventory_2</mat-icon>
            </div>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--mh-purple-deep);">
            {{ productService.products().length }}
          </div>
          <div style="font-size: 0.8rem; color: var(--mh-text-muted); margin-top: 4px;">
            منتجات وخدمات مسجلة
          </div>
        </div>

        <div class="glass-card" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">تنبيهات انخفاض المخزون</span>
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #fee2e2; color: #b91c1c; display: flex; align-items: center; justify-content: center;">
              <mat-icon style="font-size: 20px;">warning</mat-icon>
            </div>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #b91c1c;">
            {{ productService.lowStockProducts().length }}
          </div>
          <div style="font-size: 0.8rem; color: #b91c1c; margin-top: 4px; font-weight: 600;">
            منتجات قاربت على النفاد
          </div>
        </div>

        <div class="glass-card" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">حالة الوردية الحالية</span>
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center;">
              <mat-icon style="font-size: 20px;">lock_clock</mat-icon>
            </div>
          </div>
          <div style="font-size: 1.2rem; font-weight: 800; color: var(--mh-purple-deep);">
            {{ shiftService.isShiftOpen() ? 'مفتوحة (نشطة)' : 'مغلقة' }}
          </div>
          <div style="font-size: 0.8rem; color: var(--mh-text-muted); margin-top: 4px;">
            {{ shiftService.activeShift()?.userName || 'لا يوجد كاشير نشط' }}
          </div>
        </div>
      </div>

      <!-- Operations Tabs: Products, Invoices, Purchases, Treasury -->
      <div class="glass-panel" style="padding: 20px;">
        <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--mh-border-subtle); padding-bottom: 12px; margin-bottom: 20px; overflow-x: auto;">
          <button
            class="seg-tab-btn"
            [class.active]="activeSubTab() === 'products'"
            (click)="activeSubTab.set('products')"
          >
            <mat-icon>inventory_2</mat-icon>
            <span>المنتجات والمخزون</span>
          </button>

          <button
            class="seg-tab-btn"
            [class.active]="activeSubTab() === 'invoices'"
            (click)="activeSubTab.set('invoices')"
          >
            <mat-icon>receipt_long</mat-icon>
            <span>فواتير المبيعات</span>
          </button>

          <button
            class="seg-tab-btn"
            [class.active]="activeSubTab() === 'purchases'"
            (click)="activeSubTab.set('purchases')"
          >
            <mat-icon>shopping_cart_checkout</mat-icon>
            <span>المشتريات والتوريد</span>
          </button>

          <button
            class="seg-tab-btn"
            [class.active]="activeSubTab() === 'vouchers'"
            (click)="activeSubTab.set('vouchers')"
          >
            <mat-icon>account_balance_wallet</mat-icon>
            <span>سندات الخزينة والمصاريف</span>
          </button>
        </div>

        <!-- 1. PRODUCTS SUBTAB -->
        @if (activeSubTab() === 'products') {
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <input
                type="text"
                class="mh-input"
                style="max-width: 320px;"
                placeholder="ابحث بالاسم أو الباركود..."
                (input)="productSearchText.set($any($event.target).value)"
              />
              <button class="btn-primary" (click)="openAddProductModal.set(true)">
                <mat-icon>add</mat-icon>
                <span>إضافة صنف</span>
              </button>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>اسم الصنف</th>
                    <th>النوع</th>
                    <th>الباركود</th>
                    <th>سعر الشراء</th>
                    <th>سعر البيع</th>
                    <th>المخزون المتوفر</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  @for (prod of filteredProducts(); track prod.id) {
                    <tr>
                      <td style="font-weight: 700; color: var(--mh-text-main);">{{ prod.name }}</td>
                      <td>
                        <span class="badge-purple">
                          {{ prod.type === 'physical' ? 'سلعة ملموسة' : (prod.type === 'service' ? 'خدمة' : 'إضافة') }}
                        </span>
                      </td>
                      <td style="font-family: monospace; color: #64748b;">{{ prod.barcode || '—' }}</td>
                      <td>{{ i18n.formatCurrency(prod.costPrice) }}</td>
                      <td style="font-weight: 700; color: #16a34a;">{{ i18n.formatCurrency(prod.sellingPrice) }}</td>
                      <td>
                        @if (prod.type === 'physical') {
                          <span [class]="prod.stock <= prod.minStock ? 'badge-red' : 'badge-green'">
                            {{ prod.stock }} {{ prod.unit }}
                          </span>
                        } @else {
                          <span style="color: #94a3b8;">غير محدود</span>
                        }
                      </td>
                      <td>
                        <span [class]="prod.isActive ? 'badge-green' : 'badge-amber'">
                          {{ prod.isActive ? 'نشط' : 'معطل' }}
                        </span>
                      </td>
                    </tr>
                  }
                  @if (filteredProducts().length === 0) {
                    <tr>
                      <td colspan="7" style="text-align: center; padding: 24px; color: var(--mh-text-muted);">
                        لم يتم العثور على منتجات مطابقة.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- 2. INVOICES SUBTAB -->
        @if (activeSubTab() === 'invoices') {
          <div>
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>التاريخ</th>
                    <th>العميل</th>
                    <th>عدد الأصناف</th>
                    <th>الإجمالي</th>
                    <th>طريقة السداد</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of invoiceService.invoices(); track inv.id) {
                    @if (inv.type === 'sale') {
                      <tr>
                        <td style="font-weight: 700; color: var(--mh-purple-deep);">#{{ inv.invoiceNumber }}</td>
                        <td>{{ i18n.formatDate(inv.createdAt) }}</td>
                        <td>{{ inv.partyName || 'عميل نقدي مباشر' }}</td>
                        <td>{{ inv.items.length }} صنف</td>
                        <td style="font-weight: 800; color: #16a34a;">{{ i18n.formatCurrency(inv.grandTotal) }}</td>
                        <td>
                          @for (p of inv.payments; track p.method) {
                            <span class="badge-purple" style="margin-inline-end: 4px;">
                              {{ p.method === 'cash' ? 'نقداً' : (p.method === 'card' ? 'بطاقة' : (p.method === 'credit' ? 'آجل' : 'تحويل')) }}
                            </span>
                          }
                        </td>
                        <td><span class="badge-green">مكتملة</span></td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- 3. PURCHASES SUBTAB -->
        @if (activeSubTab() === 'purchases') {
          <div>
            <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
              <button class="btn-primary" (click)="openAddPurchaseModal.set(true)">
                <mat-icon>add_shopping_cart</mat-icon>
                <span>تسجيل فاتورة مشتريات جديدة</span>
              </button>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>التاريخ</th>
                    <th>المورد</th>
                    <th>المبلغ الإجمالي</th>
                    <th>طريقة الدفع</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pur of invoiceService.invoices(); track pur.id) {
                    @if (pur.type === 'purchase') {
                      <tr>
                        <td style="font-weight: 700;">#{{ pur.invoiceNumber }}</td>
                        <td>{{ i18n.formatDate(pur.createdAt) }}</td>
                        <td style="font-weight: 600;">{{ pur.partyName || 'مورد عام' }}</td>
                        <td style="font-weight: 800;">{{ i18n.formatCurrency(pur.grandTotal) }}</td>
                        <td>
                          <span class="badge-purple">
                            {{ pur.paymentStatus === 'paid' ? 'مسددة نقداً' : 'آجل على الحساب' }}
                          </span>
                        </td>
                        <td><span class="badge-green">مستلمة ومرحلة للمخزن</span></td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- 4. VOUCHERS SUBTAB -->
        @if (activeSubTab() === 'vouchers') {
          <div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px;">
              <button class="btn-primary" (click)="openVoucherModal.set(true)">
                <mat-icon>add_card</mat-icon>
                <span>إصدار سند جديد</span>
              </button>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>رقم السند</th>
                    <th>النوع</th>
                    <th>التاريخ</th>
                    <th>البيان / السبب</th>
                    <th>الطرف المعني</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  @for (vch of invoiceService.vouchers(); track vch.id) {
                    <tr>
                      <td style="font-weight: 700;">#{{ vch.voucherNumber }}</td>
                      <td>
                        <span [class]="vch.type.includes('receipt') ? 'badge-green' : 'badge-amber'">
                          {{ getVoucherTypeLabel(vch.type) }}
                        </span>
                      </td>
                      <td>{{ i18n.formatDate(vch.createdAt) }}</td>
                      <td>{{ vch.reason }}</td>
                      <td>{{ vch.partyName || '—' }}</td>
                      <td style="font-weight: 800;">{{ i18n.formatCurrency(vch.amount) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>

      <!-- Add Product Modal -->
      @if (openAddProductModal()) {
        <div class="modal-backdrop" (click)="openAddProductModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--mh-purple-deep);">إضافة منتج أو خدمة</h3>
              <button (click)="openAddProductModal.set(false)" style="background: none; border: none; cursor: pointer;">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="productForm" (ngSubmit)="handleSaveProduct()">
              @if (productErrorMsg()) {
                <div style="background: #fee2e2; color: #b91c1c; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; font-weight: 600;">
                  {{ productErrorMsg() }}
                </div>
              }
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">اسم المنتج</label>
                  <input type="text" formControlName="name" class="mh-input" placeholder="قهوة إسبريسو / علبة حليب..." required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="form-label">النوع</label>
                    <select formControlName="type" class="mh-select">
                      <option value="physical">سلعة ملموسة (مخزون)</option>
                      <option value="service">خدمة / استشارة</option>
                      <option value="addon">إضافة / ملحق</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label">الباركود</label>
                    <input type="text" formControlName="barcode" class="mh-input" placeholder="619..." />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="form-label">سعر البيع</label>
                    <input type="number" formControlName="sellingPrice" class="mh-input" placeholder="0.00" required />
                  </div>
                  <div>
                    <label class="form-label">سعر التكلفة / الشراء</label>
                    <input type="number" formControlName="costPrice" class="mh-input" placeholder="0.00" required />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="form-label">المخزون الأولي</label>
                    <input type="number" formControlName="stock" class="mh-input" placeholder="0" />
                  </div>
                  <div>
                    <label class="form-label">الحد الأدنى للإنذار</label>
                    <input type="number" formControlName="minStock" class="mh-input" placeholder="5" />
                  </div>
                </div>

                <button type="submit" class="btn-primary" style="height: 46px; margin-top: 10px;" [disabled]="productForm.invalid">
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Add Purchase Modal -->
      @if (openAddPurchaseModal()) {
        <div class="modal-backdrop" (click)="openAddPurchaseModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--mh-purple-deep);">فاتورة توريد مشتريات</h3>
              <button (click)="openAddPurchaseModal.set(false)" style="background: none; border: none; cursor: pointer;">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="purchaseForm" (ngSubmit)="handleSavePurchase()">
              @if (purchaseErrorMsg()) {
                <div style="background: #fee2e2; color: #b91c1c; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; font-weight: 600;">
                  {{ purchaseErrorMsg() }}
                </div>
              }
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">الصنف المراد توريده</label>
                  <select formControlName="productId" class="mh-select" required>
                    @for (p of productService.products(); track p.id) {
                      @if (p.type === 'physical') {
                        <option [value]="p.id">{{ p.name }} (تكلفة سابقة: {{ p.costPrice }})</option>
                      }
                    }
                  </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="form-label">الكمية المشتراة</label>
                    <input type="number" formControlName="quantity" class="mh-input" required />
                  </div>
                  <div>
                    <label class="form-label">سعر الشراء للوحدة</label>
                    <input type="number" formControlName="unitCost" class="mh-input" required />
                  </div>
                </div>

                <div>
                  <label class="form-label">المورد</label>
                  <select formControlName="supplierId" class="mh-select">
                    @for (s of partyService.suppliers(); track s.id) {
                      <option [value]="s.id">{{ s.name }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="form-label">طريقة السداد</label>
                  <select formControlName="paymentMethod" class="mh-select">
                    <option value="cash">سداد نقدي من الصندوق</option>
                    <option value="credit">آجل على حساب المورد</option>
                  </select>
                </div>

                <button type="submit" class="btn-primary" style="height: 46px; margin-top: 10px;" [disabled]="purchaseForm.invalid">
                  تأكيد التوريد وتحديث المخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Voucher Modal -->
      @if (openVoucherModal()) {
        <div class="modal-backdrop" (click)="openVoucherModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--mh-purple-deep);">إصدار سند خزينة أو تسوية</h3>
              <button (click)="openVoucherModal.set(false)" style="background: none; border: none; cursor: pointer;">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="voucherForm" (ngSubmit)="handleSaveVoucher()">
              @if (voucherErrorMsg()) {
                <div style="background: #fee2e2; color: #b91c1c; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; font-weight: 600;">
                  {{ voucherErrorMsg() }}
                </div>
              }
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">نوع السند</label>
                  <select formControlName="type" class="mh-select">
                    <option value="expense">مصروف تشغيلي (كهرباء، إيجار، نظافة...)</option>
                    <option value="customer_receipt">قبض وتحصيل دفعة من عميل</option>
                    <option value="supplier_payment">صرف وسداد دفعة لمورد</option>
                    <option value="stock_waste">تسجيل هالك / تالف مخزون</option>
                    <option value="owner_drawing">مسحوبات المالك الشخصية</option>
                    <option value="capital_injection">إيداع زيادة رأس المال</option>
                  </select>
                </div>

                <div>
                  <label class="form-label">المبلغ</label>
                  <input type="number" formControlName="amount" class="mh-input" placeholder="0.00" required />
                </div>

                <div>
                  <label class="form-label">البيان / سبب المعاملة</label>
                  <input type="text" formControlName="reason" class="mh-input" placeholder="فاتورة صيانة، سداد قسط..." required />
                </div>

                <button type="submit" class="btn-primary" style="height: 46px; margin-top: 10px;" [disabled]="voucherForm.invalid">
                  ترحيل السند
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .seg-tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: #f8f6fc;
      color: #64748b;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }

    .seg-tab-btn.active {
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
export class DashboardComponent {
  public businessService = inject(BusinessService);
  public invoiceService = inject(InvoiceService);
  public productService = inject(ProductService);
  public partyService = inject(PartyService);
  public shiftService = inject(ShiftService);
  public i18n = inject(I18nService);
  private router = inject(Router);

  public activeSubTab = signal<'products' | 'invoices' | 'purchases' | 'vouchers'>('products');
  public productSearchText = signal<string>('');

  public openAddProductModal = signal<boolean>(false);
  public openAddPurchaseModal = signal<boolean>(false);
  public openVoucherModal = signal<boolean>(false);

  public productErrorMsg = signal<string>('');
  public purchaseErrorMsg = signal<string>('');
  public voucherErrorMsg = signal<string>('');

  public todayInvoicesCount = computed(() => {
    return this.invoiceService.invoices().filter((i) => i.type === 'sale').length;
  });

  public todaySalesTotal = computed(() => {
    return this.invoiceService
      .invoices()
      .filter((i) => i.type === 'sale')
      .reduce((sum, i) => sum + i.grandTotal, 0);
  });

  public filteredProducts = computed(() => {
    const q = this.productSearchText().toLowerCase().trim();
    if (!q) return this.productService.products();
    return this.productService.products().filter(
      (p) => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))
    );
  });

  public productForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    type: new FormControl('physical', [Validators.required]),
    barcode: new FormControl(''),
    sellingPrice: new FormControl(0, [Validators.required]),
    costPrice: new FormControl(0, [Validators.required]),
    stock: new FormControl(10),
    minStock: new FormControl(5),
  });

  public purchaseForm = new FormGroup({
    productId: new FormControl('', [Validators.required]),
    quantity: new FormControl(1, [Validators.required]),
    unitCost: new FormControl(0, [Validators.required]),
    supplierId: new FormControl(''),
    paymentMethod: new FormControl('cash'),
  });

  public voucherForm = new FormGroup({
    type: new FormControl<'expense' | 'customer_receipt' | 'supplier_payment' | 'stock_waste' | 'owner_drawing' | 'capital_injection'>('expense', [Validators.required]),
    amount: new FormControl(0, [Validators.required]),
    reason: new FormControl('', [Validators.required]),
  });

  public async handleSaveProduct(): Promise<void> {
    if (this.productForm.invalid) return;
    this.productErrorMsg.set('');

    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) {
      this.productErrorMsg.set('لا يوجد نشاط تجاري نشط حالياً. يرجى إنشاء نشاط تجاري أولاً.');
      this.router.navigate(['/auth/onboarding']);
      return;
    }

    const v = this.productForm.value;
    try {
      await this.productService.saveProduct({
        name: v.name!,
        type: v.type as any,
        barcode: v.barcode || '',
        sellingPrice: Number(v.sellingPrice),
        costPrice: Number(v.costPrice),
        stock: Number(v.stock),
        minStock: Number(v.minStock),
      });
      this.openAddProductModal.set(false);
      this.productForm.reset({ type: 'physical', stock: 10, minStock: 5 });
    } catch (err: any) {
      this.productErrorMsg.set(err.message || 'فشل حفظ المنتج.');
    }
  }

  public async handleSavePurchase(): Promise<void> {
    if (this.purchaseForm.invalid) return;
    this.purchaseErrorMsg.set('');

    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) {
      this.purchaseErrorMsg.set('لا يوجد نشاط تجاري نشط حالياً.');
      return;
    }

    const shop = this.businessService.activeShop();
    const shift = this.shiftService.activeShift();
    if (!shop) {
      this.purchaseErrorMsg.set('لا يوجد محل نشط حالياً.');
      return;
    }

    const v = this.purchaseForm.value;
    const prod = this.productService.products().find((p) => p.id === v.productId);
    if (!prod) {
      this.purchaseErrorMsg.set('الصنف المحدد غير موجود.');
      return;
    }

    const qty = Number(v.quantity);
    const unitCost = Number(v.unitCost);
    const supplier = this.partyService.suppliers().find((s) => s.id === v.supplierId) || {
      id: 'supp_default',
      businessId: biz.id,
      name: 'مورد عام',
      roles: ['SUPPLIER'],
      balance: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.invoiceService.completePurchase({
        shopId: shop.id,
        shiftId: shift?.id || 'shift_auto',
        items: [
          {
            productId: prod.id,
            name: prod.name,
            quantity: qty,
            unitPrice: unitCost,
            costPrice: unitCost,
            subtotal: qty * unitCost,
            discount: 0,
            total: qty * unitCost,
          },
        ],
        supplier,
        isPaidCash: v.paymentMethod === 'cash',
      });
      this.openAddPurchaseModal.set(false);
    } catch (err: any) {
      this.purchaseErrorMsg.set(err.message || 'فشل تسجيل فاتورة الشراء.');
    }
  }

  public async handleSaveVoucher(): Promise<void> {
    if (this.voucherForm.invalid) return;
    this.voucherErrorMsg.set('');

    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) {
      this.voucherErrorMsg.set('لا يوجد نشاط تجاري نشط حالياً.');
      return;
    }

    const shop = this.businessService.activeShop();
    const shift = this.shiftService.activeShift();
    if (!shop) {
      this.voucherErrorMsg.set('لا يوجد محل نشط حالياً.');
      return;
    }

    const v = this.voucherForm.value;
    const amount = Number(v.amount);
    const reason = v.reason!;

    try {
      if (v.type === 'customer_receipt' || v.type === 'supplier_payment') {
        const party = this.partyService.parties()[0] || {
          id: 'party_default',
          businessId: shop.businessId,
          name: 'طرف عام',
          roles: ['CUSTOMER'],
          balance: 0,
          createdAt: new Date().toISOString(),
        };
        await this.invoiceService.createTreasuryVoucher({
          shopId: shop.id,
          shiftId: shift?.id || 'shift_auto',
          type: v.type,
          party,
          amount,
          reason,
        });
      } else {
        await this.invoiceService.createAdjustmentVoucher({
          shopId: shop.id,
          shiftId: shift?.id || 'shift_auto',
          type: v.type as any,
          amount,
          reason,
        });
      }
      this.openVoucherModal.set(false);
    } catch (err: any) {
      this.voucherErrorMsg.set(err.message || 'فشل ترحيل السند.');
    }
  }

  public getVoucherTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      customer_receipt: 'قبض من عميل',
      supplier_payment: 'سداد لمورد',
      expense: 'مصروف',
      stock_waste: 'هالك مخزون',
      owner_drawing: 'مسحوبات مالك',
      capital_injection: 'إيداع رأس مال',
      cash_difference: 'تسوية عجز/فائض',
    };
    return labels[type] || type;
  }
}
