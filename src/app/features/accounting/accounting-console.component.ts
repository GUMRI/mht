import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AccountingService } from '../../core/accounting/accounting.service';
import { BusinessService } from '../../core/business/business.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Account, JournalEntry } from '../../core/models';

@Component({
  selector: 'app-accounting-console',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Console Header Bar -->
      <div class="glass-panel no-print" style="padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #4a154b 0%, #7c3aed 100%); color: #ffffff; display: flex; align-items: center; justify-content: center;">
              <mat-icon style="font-size: 20px;">account_balance</mat-icon>
            </div>
            <h1 style="font-size: 1.5rem; font-weight: 800; color: var(--mh-purple-deep);">
              {{ i18n.t('accounting.title') }}
            </h1>
          </div>
          <p style="font-size: 0.88rem; color: var(--mh-text-muted); margin-top: 4px;">
            دليل الحسابات الموحد، القيود المزدوجة، ميزان المراجعة والقوائم المالية الختامية
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn-secondary" (click)="accountingService.printReport()">
            <mat-icon>print</mat-icon>
            <span>{{ i18n.t('common.export_pdf') }}</span>
          </button>

          <button class="btn-secondary" (click)="handleExportCsv()">
            <mat-icon>table_view</mat-icon>
            <span>{{ i18n.t('common.export_csv') }}</span>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs Toolbar for Accounting -->
      <div class="glass-panel no-print" style="padding: 10px 14px;">
        <div style="display: flex; gap: 6px; overflow-x: auto;">
          <button
            class="acc-tab-btn"
            [class.active]="activePage() === 'home'"
            (click)="activePage.set('home')"
          >
            <mat-icon>analytics</mat-icon>
            <span>{{ i18n.t('accounting.overview') }}</span>
          </button>

          <button
            class="acc-tab-btn"
            [class.active]="activePage() === 'chart'"
            (click)="activePage.set('chart')"
          >
            <mat-icon>account_tree</mat-icon>
            <span>{{ i18n.t('accounting.chart') }}</span>
          </button>

          <button
            class="acc-tab-btn"
            [class.active]="activePage() === 'journals'"
            (click)="activePage.set('journals')"
          >
            <mat-icon>menu_book</mat-icon>
            <span>{{ i18n.t('accounting.journals') }}</span>
          </button>

          <button
            class="acc-tab-btn"
            [class.active]="activePage() === 'ledger'"
            (click)="activePage.set('ledger')"
          >
            <mat-icon>history_edu</mat-icon>
            <span>{{ i18n.t('accounting.ledger') }}</span>
          </button>

          <button
            class="acc-tab-btn"
            [class.active]="activePage() === 'trial_balance'"
            (click)="activePage.set('trial_balance')"
          >
            <mat-icon>balance</mat-icon>
            <span>{{ i18n.t('accounting.trial_balance') }}</span>
          </button>

          <button
            class="acc-tab-btn"
            [class.active]="activePage() === 'income_statement'"
            (click)="activePage.set('income_statement')"
          >
            <mat-icon>trending_up</mat-icon>
            <span>{{ i18n.t('accounting.income_statement') }}</span>
          </button>

          <button
            class="acc-tab-btn"
            [class.active]="activePage() === 'balance_sheet'"
            (click)="activePage.set('balance_sheet')"
          >
            <mat-icon>assessment</mat-icon>
            <span>{{ i18n.t('accounting.balance_sheet') }}</span>
          </button>
        </div>
      </div>

      <!-- PAGE 1: ACCOUNTING HOME (Key Figures & Summary) -->
      @if (activePage() === 'home') {
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
            <div class="glass-card" style="padding: 20px;">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">إجمالي الأصول (Assets)</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: #16a34a; margin-top: 8px;">
                {{ i18n.formatCurrency(accountingService.balanceSheet().totalAssets) }}
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                متداولة: {{ i18n.formatCurrency(currentAssetsTotal()) }}
              </div>
            </div>

            <div class="glass-card" style="padding: 20px;">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">إجمالي الخصوم (Liabilities)</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: #dc2626; margin-top: 8px;">
                {{ i18n.formatCurrency(accountingService.balanceSheet().totalLiabilities) }}
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                متداولة: {{ i18n.formatCurrency(currentLiabTotal()) }}
              </div>
            </div>

            <div class="glass-card" style="padding: 20px;">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">حقوق الملكية (Equity)</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--mh-purple-deep); margin-top: 8px;">
                {{ i18n.formatCurrency(accountingService.balanceSheet().totalEquity) }}
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                شاملة صافي أرباح الفترة
              </div>
            </div>

            <div class="glass-card" style="padding: 20px;">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--mh-text-muted);">صافي الربح / الخسارة (Net Profit)</span>
              <div style="font-size: 1.5rem; font-weight: 800; margin-top: 8px;" [style.color]="accountingService.incomeStatement().netProfit >= 0 ? '#16a34a' : '#dc2626'">
                {{ i18n.formatCurrency(accountingService.incomeStatement().netProfit) }}
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                إيرادات: {{ i18n.formatCurrency(accountingService.incomeStatement().totalRevenues) }}
              </div>
            </div>
          </div>

          <!-- Quick Reconciliation Card -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--mh-purple-deep);">
                توازن المعادلة المحاسبية الأساسية
              </h3>
              <span [class]="accountingService.balanceSheet().isBalanced ? 'badge-green' : 'badge-red'">
                {{ accountingService.balanceSheet().isBalanced ? 'الميزانية متوازنة تماماً ✓' : 'يوجد فرق محاسبي!' }}
              </span>
            </div>
            <p style="font-size: 0.88rem; color: var(--mh-text-muted);">
              الأصول ({{ i18n.formatCurrency(accountingService.balanceSheet().totalAssets) }}) = الخصوم ({{ i18n.formatCurrency(accountingService.balanceSheet().totalLiabilities) }}) + حقوق الملكية ({{ i18n.formatCurrency(accountingService.balanceSheet().totalEquity) }})
            </p>
          </div>
        </div>
      }

      <!-- PAGE 2: CHART OF ACCOUNTS -->
      @if (activePage() === 'chart') {
        <div class="glass-panel" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep);">
                دليل الحسابات الموحد (Universal Chart of Accounts)
              </h3>
              <p style="font-size: 0.85rem; color: var(--mh-text-muted);">
                5 مجموعات رئيسية (1000–5000)، 24 حساب مستوى 2، وتصنيف متداول/غير متداول للأصول والخصوم. الحسابات النظامية مقفلة.
              </p>
            </div>

            <button class="btn-primary" (click)="openAddAccountModal.set(true)">
              <mat-icon>add</mat-icon>
              <span>إضافة حساب فرعي (Leaf)</span>
            </button>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>رمز الحساب</th>
                  <th>اسم الحساب (مجموعة - فرعية - تفصيل)</th>
                  <th>المستوى</th>
                  <th>التصنيف</th>
                  <th>النوع</th>
                  <th>الرصيد المحسوب</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                @for (acc of accountingService.accountsWithCalculatedBalances(); track acc.id) {
                  <tr
                    [style.background]="highlightCode() === acc.code ? '#faf5ff' : 'transparent'"
                    [style.border-right]="highlightCode() === acc.code ? '4px solid #7c3aed' : 'none'"
                  >
                    <td style="font-family: monospace; font-weight: 700; color: var(--mh-purple-deep);">
                      {{ acc.code }}
                    </td>
                    <td style="font-weight: 600;">
                      <span [style.padding-right.px]="(acc.code.length - 1) * 8">
                        {{ acc.displayName || acc.name_ar }}
                      </span>
                    </td>
                    <td>
                      <span class="badge-purple">
                        {{ acc.code.length === 1 ? 'رئيسي (مجموعة)' : (acc.code.length === 2 ? 'مساعد' : (acc.code.length === 3 ? 'مستوى 2' : 'فرعي')) }}
                      </span>
                    </td>
                    <td>
                      @if (acc.classification) {
                        <span class="badge-amber">
                          {{ acc.classification === 'current' ? 'متداول' : 'غير متداول' }}
                        </span>
                      } @else {
                        <span style="color: #94a3b8;">—</span>
                      }
                    </td>
                    <td>
                      @if (acc.is_system) {
                        <span class="badge-purple">نظامي مقفل 🔒</span>
                      } @else {
                        <span class="badge-green">حساب مخصص</span>
                      }
                    </td>
                    <td style="font-weight: 800;">
                      {{ i18n.formatCurrency(acc.balance) }}
                    </td>
                    <td>
                      <a
                        (click)="viewAccountLedger(acc.code)"
                        style="color: #7c3aed; font-weight: 600; font-size: 0.85rem; cursor: pointer; text-decoration: underline;"
                      >
                        دفتر الأستاذ
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- PAGE 3: JOURNAL ENTRIES -->
      @if (activePage() === 'journals') {
        <div class="glass-panel" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep);">
                قيود اليومية العامة (Journal Entries)
              </h3>
              <p style="font-size: 0.85rem; color: var(--mh-text-muted);">
                قيود غير قابلة للتعديل أو الحذف المباشر (Immutable). التصحيح يتم حصراً عبر القيد العكسي.
              </p>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            @for (je of accountingService.journalEntries(); track je.id) {
              <div class="glass-card" style="padding: 18px; border: 1px solid var(--mh-border-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 800; font-size: 1.05rem; color: var(--mh-purple-deep);">
                      #{{ je.entry_number }}
                    </span>
                    <span class="badge-purple">{{ je.event_type }}</span>
                    @if (je.is_reversed) {
                      <span class="badge-red">تم عكسه بقيد تصحيحي</span>
                    }
                  </div>

                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 0.85rem; color: #64748b;">{{ i18n.formatDate(je.date) }}</span>
                    @if (!je.is_reversed) {
                      <button
                        class="btn-danger"
                        style="padding: 4px 10px; font-size: 0.78rem;"
                        (click)="handleReversePrompt(je)"
                      >
                        قيد عكسي (تصحيح)
                      </button>
                    }
                  </div>
                </div>

                <div style="font-size: 0.9rem; color: #334155; margin-bottom: 12px; font-weight: 600;">
                  البيان: {{ je.description }}
                </div>

                <!-- Lines Table -->
                <div class="data-table-container">
                  <table class="data-table" style="font-size: 0.85rem;">
                    <thead>
                      <tr>
                        <th>رمز الحساب</th>
                        <th>اسم الحساب</th>
                        <th>مدين (Debit)</th>
                        <th>دائن (Credit)</th>
                        <th>الشرح</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (l of je.lines; track l.accountCode + l.debit + l.credit) {
                        <tr>
                          <td style="font-family: monospace; font-weight: 700;">{{ l.accountCode }}</td>
                          <td style="font-weight: 600;">{{ l.accountName }}</td>
                          <td style="font-weight: 700; color: #16a34a;">{{ l.debit > 0 ? i18n.formatCurrency(l.debit) : '—' }}</td>
                          <td style="font-weight: 700; color: #dc2626;">{{ l.credit > 0 ? i18n.formatCurrency(l.credit) : '—' }}</td>
                          <td>{{ l.description || '—' }}</td>
                        </tr>
                      }
                      <tr style="background: #f8f6fc; font-weight: 800;">
                        <td colspan="2" style="text-align: end;">الإجمالي المتوازن:</td>
                        <td style="color: #16a34a;">{{ i18n.formatCurrency(je.debit_total) }}</td>
                        <td style="color: #dc2626;">{{ i18n.formatCurrency(je.credit_total) }}</td>
                        <td>✓ متطابق</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- PAGE 4: GENERAL LEDGER -->
      @if (activePage() === 'ledger') {
        <div class="glass-panel" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep);">
                دفتر الأستاذ العام (General Ledger)
              </h3>
              <p style="font-size: 0.85rem; color: var(--mh-text-muted);">
                كشف حركة الحسابات التفصيلية
              </p>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <label style="font-weight: 600; font-size: 0.88rem;">اختر الحساب:</label>
              <select
                class="mh-select"
                style="max-width: 280px;"
                [value]="selectedLedgerAccountCode()"
                (change)="selectedLedgerAccountCode.set($any($event.target).value)"
              >
                @for (acc of accountingService.accounts(); track acc.id) {
                  @if (acc.is_leaf) {
                    <option [value]="acc.code">{{ acc.code }} - {{ acc.name_ar }}</option>
                  }
                }
              </select>
            </div>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>رقم القيد</th>
                  <th>البيان</th>
                  <th>مدين</th>
                  <th>دائن</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredLedgerRows(); track row.entryId) {
                  <tr>
                    <td>{{ i18n.formatDate(row.date) }}</td>
                    <td style="font-weight: 700; color: var(--mh-purple-deep);">#{{ row.entryNumber }}</td>
                    <td>{{ row.description }}</td>
                    <td style="font-weight: 700; color: #16a34a;">{{ row.debit > 0 ? i18n.formatCurrency(row.debit) : '—' }}</td>
                    <td style="font-weight: 700; color: #dc2626;">{{ row.credit > 0 ? i18n.formatCurrency(row.credit) : '—' }}</td>
                  </tr>
                }
                @if (filteredLedgerRows().length === 0) {
                  <tr>
                    <td colspan="5" style="text-align: center; padding: 24px; color: var(--mh-text-muted);">
                      لا توجد حركات مسجلة على هذا الحساب بعد.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- PAGE 5: TRIAL BALANCE -->
      @if (activePage() === 'trial_balance') {
        <div class="glass-panel" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep);">
                ميزان المراجعة بالأرصدة والمجاميع (Trial Balance)
              </h3>
              <p style="font-size: 0.85rem; color: var(--mh-text-muted);">
                التحقق النهائي من توازن كامل أرصدة الدليل المحاسبي
              </p>
            </div>
            <span [class]="accountingService.trialBalance().isBalanced ? 'badge-green' : 'badge-red'">
              {{ accountingService.trialBalance().isBalanced ? 'الميزان متوازن ✓' : 'الميزان غير متوازن!' }}
            </span>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>رمز الحساب</th>
                  <th>اسم الحساب</th>
                  <th>مجموع المدين</th>
                  <th>مجموع الدائن</th>
                  <th>صافي مدين</th>
                  <th>صافي دائن</th>
                </tr>
              </thead>
              <tbody>
                @for (item of accountingService.trialBalance().items; track item.account.id) {
                  <tr>
                    <td style="font-family: monospace; font-weight: 700;">{{ item.account.code }}</td>
                    <td style="font-weight: 600;">{{ item.account.name_ar }}</td>
                    <td>{{ i18n.formatCurrency(item.debit) }}</td>
                    <td>{{ i18n.formatCurrency(item.credit) }}</td>
                    <td style="font-weight: 700; color: #16a34a;">{{ item.netDebit > 0 ? i18n.formatCurrency(item.netDebit) : '—' }}</td>
                    <td style="font-weight: 700; color: #dc2626;">{{ item.netCredit > 0 ? i18n.formatCurrency(item.netCredit) : '—' }}</td>
                  </tr>
                }
                <tr style="background: #f8f6fc; font-weight: 800; font-size: 1rem;">
                  <td colspan="4" style="text-align: end;">الإجمالي العام لميزان المراجعة:</td>
                  <td style="color: #16a34a;">{{ i18n.formatCurrency(accountingService.trialBalance().totalDebit) }}</td>
                  <td style="color: #dc2626;">{{ i18n.formatCurrency(accountingService.trialBalance().totalCredit) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- PAGE 6: INCOME STATEMENT -->
      @if (activePage() === 'income_statement') {
        <div class="glass-panel" style="padding: 24px;">
          <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 20px;">
            قائمة الدخل والأرباح والخسائر (Income Statement)
          </h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- Revenues Column -->
            <div class="glass-card" style="padding: 20px;">
              <h4 style="font-size: 1.1rem; font-weight: 800; color: #16a34a; margin-bottom: 14px; border-bottom: 1px solid var(--mh-border-subtle); padding-bottom: 8px;">
                الإيرادات (Revenues 4000)
              </h4>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                @for (r of accountingService.incomeStatement().revenues; track r.id) {
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span>{{ r.name_ar }}</span>
                    <span style="font-weight: 700;">{{ i18n.formatCurrency(r.balance) }}</span>
                  </div>
                }
                <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1rem; border-top: 1px dashed var(--mh-border-subtle); padding-top: 10px; margin-top: 6px; color: #16a34a;">
                  <span>إجمالي الإيرادات:</span>
                  <span>{{ i18n.formatCurrency(accountingService.incomeStatement().totalRevenues) }}</span>
                </div>
              </div>
            </div>

            <!-- Expenses Column -->
            <div class="glass-card" style="padding: 20px;">
              <h4 style="font-size: 1.1rem; font-weight: 800; color: #dc2626; margin-bottom: 14px; border-bottom: 1px solid var(--mh-border-subtle); padding-bottom: 8px;">
                المصروفات والتكاليف (Expenses 5000)
              </h4>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                @for (e of accountingService.incomeStatement().expenses; track e.id) {
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span>{{ e.name_ar }}</span>
                    <span style="font-weight: 700;">{{ i18n.formatCurrency(e.balance) }}</span>
                  </div>
                }
                <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1rem; border-top: 1px dashed var(--mh-border-subtle); padding-top: 10px; margin-top: 6px; color: #dc2626;">
                  <span>إجمالي المصروفات:</span>
                  <span>{{ i18n.formatCurrency(accountingService.incomeStatement().totalExpenses) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Net Profit Calculation -->
          <div class="glass-card" style="margin-top: 20px; padding: 20px; text-align: center; background: #faf8ff;">
            <div style="font-size: 1rem; font-weight: 700; color: var(--mh-text-muted);">
              صافي الربح / الخسارة عن الفترة (Net Income)
            </div>
            <div style="font-size: 2rem; font-weight: 900; margin-top: 6px;" [style.color]="accountingService.incomeStatement().netProfit >= 0 ? '#16a34a' : '#dc2626'">
              {{ i18n.formatCurrency(accountingService.incomeStatement().netProfit) }}
            </div>
          </div>
        </div>
      }

      <!-- PAGE 7: BALANCE SHEET -->
      @if (activePage() === 'balance_sheet') {
        <div class="glass-panel" style="padding: 24px;">
          <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 20px;">
            الميزانية العمومية (Balance Sheet)
          </h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- Assets Side -->
            <div class="glass-card" style="padding: 20px;">
              <h4 style="font-size: 1.15rem; font-weight: 800; color: #16a34a; margin-bottom: 14px; border-bottom: 2px solid #bbf7d0; padding-bottom: 8px;">
                الأصول (Assets)
              </h4>

              <div style="font-weight: 700; font-size: 0.95rem; color: var(--mh-purple-deep); margin: 10px 0 6px;">
                الأصول المتداولة:
              </div>
              @for (a of accountingService.balanceSheet().currentAssets; track a.id) {
                <div style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 3px 0;">
                  <span>{{ a.name_ar }}</span>
                  <span style="font-weight: 700;">{{ i18n.formatCurrency(a.balance) }}</span>
                </div>
              }

              <div style="font-weight: 700; font-size: 0.95rem; color: var(--mh-purple-deep); margin: 16px 0 6px;">
                الأصول غير المتداولة (الثابتة):
              </div>
              @for (a of accountingService.balanceSheet().fixedAssets; track a.id) {
                <div style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 3px 0;">
                  <span>{{ a.name_ar }}</span>
                  <span style="font-weight: 700;">{{ i18n.formatCurrency(a.balance) }}</span>
                </div>
              }

              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.15rem; border-top: 2px solid #bbf7d0; padding-top: 14px; margin-top: 20px; color: #16a34a;">
                <span>مجموع الأصول:</span>
                <span>{{ i18n.formatCurrency(accountingService.balanceSheet().totalAssets) }}</span>
              </div>
            </div>

            <!-- Liabilities & Equity Side -->
            <div class="glass-card" style="padding: 20px;">
              <h4 style="font-size: 1.15rem; font-weight: 800; color: #dc2626; margin-bottom: 14px; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">
                الخصوم وحقوق الملكية
              </h4>

              <div style="font-weight: 700; font-size: 0.95rem; color: var(--mh-purple-deep); margin: 10px 0 6px;">
                الالتزامات المتداولة:
              </div>
              @for (l of accountingService.balanceSheet().currentLiab; track l.id) {
                <div style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 3px 0;">
                  <span>{{ l.name_ar }}</span>
                  <span style="font-weight: 700;">{{ i18n.formatCurrency(l.balance) }}</span>
                </div>
              }

              <div style="font-weight: 700; font-size: 0.95rem; color: var(--mh-purple-deep); margin: 16px 0 6px;">
                حقوق الملكية والأرباح:
              </div>
              @for (eq of accountingService.balanceSheet().equity; track eq.id) {
                <div style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 3px 0;">
                  <span>{{ eq.name_ar }}</span>
                  <span style="font-weight: 700;">{{ i18n.formatCurrency(eq.balance) }}</span>
                </div>
              }
              <div style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 3px 0; color: #16a34a; font-weight: 600;">
                <span>صافي أرباح الفترة الحالية:</span>
                <span>{{ i18n.formatCurrency(accountingService.balanceSheet().netProfit) }}</span>
              </div>

              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.15rem; border-top: 2px solid #fecaca; padding-top: 14px; margin-top: 20px; color: var(--mh-purple-deep);">
                <span>مجموع الخصوم والملكية:</span>
                <span>{{ i18n.formatCurrency(accountingService.balanceSheet().totalLiabilitiesAndEquity) }}</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Add Leaf Account Modal -->
      @if (openAddAccountModal()) {
        <div class="modal-backdrop" (click)="openAddAccountModal.set(false)">
          <div class="modal-content" style="padding: 24px;" (click)="$event.stopPropagation()">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--mh-purple-deep); margin-bottom: 16px;">
              إضافة حساب فرعي جديد في شجرة الحسابات
            </h3>

            <form [formGroup]="addAccountForm" (ngSubmit)="handleAddAccountSubmit()">
              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label class="form-label">الحساب الرئيسي الأب (Parent)</label>
                  <select formControlName="parent" class="mh-select" required>
                    @for (acc of nonSystemParents(); track acc.code) {
                      <option [value]="acc.code">{{ acc.code }} - {{ acc.displayName || acc.name_ar }}</option>
                    }
                  </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="form-label">كود الحساب الفرعي</label>
                    <input type="text" formControlName="code" class="mh-input" placeholder="مثال: 5304" required />
                  </div>
                  <div>
                    <label class="form-label">المجموعة الرئيسية</label>
                    <select formControlName="group" class="mh-select">
                      <option [value]="1000">1000 - الأصول</option>
                      <option [value]="2000">2000 - الخصوم</option>
                      <option [value]="3000">3000 - حقوق الملكية</option>
                      <option [value]="4000">4000 - الإيرادات</option>
                      <option [value]="5000">5000 - المصروفات</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="form-label">اسم الحساب بالعربية</label>
                  <input type="text" formControlName="name_ar" class="mh-input" placeholder="مصروف اشتراك برمجي..." required />
                </div>

                <div>
                  <label class="form-label">اسم الحساب بالإنجليزية</label>
                  <input type="text" formControlName="name_en" class="mh-input" placeholder="Software Subscription..." required />
                </div>

                <button type="submit" class="btn-primary" style="height: 48px; margin-top: 10px;" [disabled]="addAccountForm.invalid">
                  حفظ الحساب في الدليل
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .acc-tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: #64748b;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }

    .acc-tab-btn.active {
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
export class AccountingConsoleComponent {
  public accountingService = inject(AccountingService);
  public businessService = inject(BusinessService);
  public i18n = inject(I18nService);
  private route = inject(ActivatedRoute);

  public activePage = signal<
    'home' | 'chart' | 'journals' | 'ledger' | 'trial_balance' | 'income_statement' | 'balance_sheet'
  >('home');

  public highlightCode = signal<string>('');
  public selectedLedgerAccountCode = signal<string>('1111');
  public openAddAccountModal = signal<boolean>(false);

  public addAccountForm = new FormGroup({
    parent: new FormControl('5300', [Validators.required]),
    code: new FormControl('', [Validators.required]),
    name_ar: new FormControl('', [Validators.required]),
    name_en: new FormControl('', [Validators.required]),
    group: new FormControl(5000, [Validators.required]),
  });

  constructor() {
    this.route.queryParams.subscribe((params) => {
      if (params['highlight']) {
        this.highlightCode.set(params['highlight']);
        this.activePage.set('chart');
      }
      if (params['account']) {
        this.selectedLedgerAccountCode.set(params['account']);
        this.activePage.set('ledger');
      }
    });
  }

  public currentAssetsTotal = computed(() => {
    return this.accountingService
      .balanceSheet()
      .currentAssets.reduce((sum, a) => sum + (a.balance || 0), 0);
  });

  public currentLiabTotal = computed(() => {
    return this.accountingService
      .balanceSheet()
      .currentLiab.reduce((sum, a) => sum + (a.balance || 0), 0);
  });

  public nonSystemParents = computed(() => {
    return this.accountingService.accounts().filter((a) => !a.is_leaf);
  });

  public filteredLedgerRows = computed(() => {
    const code = this.selectedLedgerAccountCode();
    const rows: any[] = [];
    for (const entry of this.accountingService.journalEntries()) {
      for (const line of entry.lines) {
        if (line.accountCode === code) {
          rows.push({
            entryId: entry.id,
            entryNumber: entry.entry_number,
            date: entry.date,
            description: line.description || entry.description,
            debit: line.debit,
            credit: line.credit,
          });
        }
      }
    }
    return rows;
  });

  public viewAccountLedger(code: string): void {
    this.selectedLedgerAccountCode.set(code);
    this.activePage.set('ledger');
  }

  public async handleReversePrompt(entry: JournalEntry): Promise<void> {
    const reason = prompt('أدخل سبب القيد العكسي والتصحيحي:');
    if (reason) {
      await this.accountingService.reverseEntry(entry, reason);
      alert('تم إنشاء القيد العكسي بنجاح!');
    }
  }

  public async handleAddAccountSubmit(): Promise<void> {
    if (this.addAccountForm.invalid) return;
    const v = this.addAccountForm.value;
    const parentAcc = this.accountingService.accounts().find((a) => a.code === v.parent);

    await this.accountingService.addAccount({
      code: v.code!,
      name_ar: v.name_ar!,
      name_en: v.name_en!,
      group: Number(v.group),
      parent: v.parent!,
      classification: parentAcc?.classification || null,
    });

    this.openAddAccountModal.set(false);
    this.addAccountForm.reset();
  }

  public handleExportCsv(): void {
    const headers = ['Account Code', 'Account Name', 'Group', 'Balance'];
    const rows = this.accountingService
      .accountsWithCalculatedBalances()
      .map((a) => [a.code, a.name_ar, a.group, a.balance]);
    this.accountingService.exportToCsv('Mahalat_Chart_Of_Accounts', headers, rows);
  }
}
