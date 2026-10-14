import { Injectable } from '@angular/core';
import {
  Account,
  AccountingEventType,
  JournalEntry,
  JournalLine,
  Invoice,
  Voucher,
} from '../models';

export interface PostingPayload {
  business_id: string;
  shop_id: string;
  branch_id?: string;
  source_document_id?: string;
  shift_id?: string;
  event_type: AccountingEventType;
  date?: string;
  description: string;
  lines: JournalLine[];
  createdBy?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PostingEngineService {
  /**
   * Validates and constructs a deterministic balanced JournalEntry.
   * Throws if unbalanced, has empty lines, or touches non-leaf accounts.
   */
  public createJournalEntry(
    payload: PostingPayload,
    accountsMap: Map<string, Account> | Record<string, Account>
  ): JournalEntry {
    const getAccount = (codeOrId: string): Account | undefined => {
      if (accountsMap instanceof Map) {
        return (
          accountsMap.get(codeOrId) ||
          Array.from(accountsMap.values()).find(
            (a) => a.code === codeOrId || a.id === codeOrId
          )
        );
      }
      return (
        accountsMap[codeOrId] ||
        Object.values(accountsMap).find(
          (a) => a.code === codeOrId || a.id === codeOrId
        )
      );
    };

    if (!payload.lines || payload.lines.length === 0) {
      throw new Error('Posting Error: Journal entry must have at least one line.');
    }

    let debitTotal = 0;
    let creditTotal = 0;
    const validatedLines: JournalLine[] = [];

    for (const line of payload.lines) {
      const debit = Number(Number(line.debit || 0).toFixed(4));
      const credit = Number(Number(line.credit || 0).toFixed(4));

      if (debit < 0 || credit < 0) {
        throw new Error('Posting Error: Negative debit or credit amounts are forbidden.');
      }
      if (debit === 0 && credit === 0) {
        continue; // skip zero lines
      }
      if (debit > 0 && credit > 0) {
        throw new Error('Posting Error: A journal line cannot have both debit and credit.');
      }

      // Check account validity and leaf requirement
      const account = getAccount(line.accountCode || line.accountId);
      if (!account) {
        throw new Error(`Posting Error: Account '${line.accountCode || line.accountId}' not found.`);
      }
      if (!account.is_leaf) {
        throw new Error(
          `Posting Error: Account '${account.code} - ${account.name_ar}' is not a leaf account. Posting to summary/parent accounts is strictly prohibited.`
        );
      }

      debitTotal += debit;
      creditTotal += credit;

      validatedLines.push({
        accountId: account.id || account.code,
        accountCode: account.code,
        accountName: account.name_ar,
        debit,
        credit,
        description: line.description || payload.description,
      });
    }

    // Round totals to 4 decimal places to prevent floating-point epsilon differences
    debitTotal = Number(debitTotal.toFixed(4));
    creditTotal = Number(creditTotal.toFixed(4));

    if (Math.abs(debitTotal - creditTotal) > 0.0001) {
      throw new Error(
        `Posting Error: Entry is unbalanced! Total Debits (${debitTotal}) must equal Total Credits (${creditTotal}). Difference: ${Math.abs(
          debitTotal - creditTotal
        )}`
      );
    }

    const entryId = 'je_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const entryNumber = 'JE-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6);

    const entry: JournalEntry = {
      id: entryId,
      business_id: payload.business_id,
      shop_id: payload.shop_id,
      branch_id: payload.branch_id || payload.shop_id,
      entry_number: entryNumber,
      date: payload.date || new Date().toISOString(),
      description: payload.description,
      source_document_id: payload.source_document_id || '',
      shift_id: payload.shift_id || '',
      event_type: payload.event_type,
      debit_total: debitTotal,
      credit_total: creditTotal,
      lines: validatedLines,
      is_reversed: false,
      createdAt: new Date().toISOString(),
      createdBy: payload.createdBy || 'system',
    };

    return entry;
  }

  /**
   * Helper to build sale entry (cash, card, credit) + cost of goods sold.
   */
  public buildSaleEntry(
    invoice: Invoice,
    totalCost: number,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'cashier'
  ): JournalEntry {
    const lines: JournalLine[] = [];
    const grandTotal = Number(invoice.grandTotal.toFixed(4));
    const subtotal = Number(invoice.subtotal.toFixed(4));
    const taxTotal = Number(invoice.taxTotal.toFixed(4));

    // Determine payment lines
    if (invoice.payments && invoice.payments.length > 0) {
      for (const p of invoice.payments) {
        if (p.method === 'cash') {
          lines.push({ accountId: '', accountCode: '1111', accountName: '', debit: p.amount, credit: 0 });
        } else if (p.method === 'card') {
          lines.push({ accountId: '', accountCode: '1112', accountName: '', debit: p.amount, credit: 0 });
        } else if (p.method === 'bank_transfer') {
          lines.push({ accountId: '', accountCode: '1112', accountName: '', debit: p.amount, credit: 0 });
        } else if (p.method === 'credit') {
          lines.push({ accountId: '', accountCode: '1121', accountName: '', debit: p.amount, credit: 0 });
        }
      }
    } else {
      // Default to cash if not specified
      lines.push({ accountId: '', accountCode: '1111', accountName: '', debit: grandTotal, credit: 0 });
    }

    // Revenue Credit
    const revenueCredit = Number((subtotal - invoice.discountTotal).toFixed(4));
    lines.push({ accountId: '', accountCode: '4101', accountName: '', debit: 0, credit: revenueCredit });

    // VAT Payable Credit (if any)
    if (taxTotal > 0) {
      lines.push({ accountId: '', accountCode: '2131', accountName: '', debit: 0, credit: taxTotal });
    }

    // COGS Entry (if physical goods cost > 0)
    if (totalCost > 0) {
      const roundedCost = Number(totalCost.toFixed(4));
      lines.push({ accountId: '', accountCode: '5101', accountName: '', debit: roundedCost, credit: 0 });
      lines.push({ accountId: '', accountCode: '1131', accountName: '', debit: 0, credit: roundedCost });
    }

    return this.createJournalEntry(
      {
        business_id: invoice.businessId,
        shop_id: invoice.shopId,
        source_document_id: invoice.id,
        shift_id: invoice.shiftId,
        event_type: 'sale',
        description: `فاتورة مبيعات #${invoice.invoiceNumber} ${invoice.partyName ? '- ' + invoice.partyName : ''}`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build purchase entry.
   */
  public buildPurchaseEntry(
    invoice: Invoice,
    isPaidCash: boolean,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'manager'
  ): JournalEntry {
    const lines: JournalLine[] = [];
    const grandTotal = Number(invoice.grandTotal.toFixed(4));
    const subtotal = Number(invoice.subtotal.toFixed(4));
    const taxTotal = Number(invoice.taxTotal.toFixed(4));

    // Debit Inventory
    lines.push({ accountId: '', accountCode: '1131', accountName: '', debit: subtotal, credit: 0 });

    // Debit VAT if any
    if (taxTotal > 0) {
      lines.push({ accountId: '', accountCode: '2131', accountName: '', debit: taxTotal, credit: 0 });
    }

    // Credit Cash or Supplier Payable
    if (isPaidCash) {
      lines.push({ accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: grandTotal });
    } else {
      lines.push({ accountId: '', accountCode: '2111', accountName: '', debit: 0, credit: grandTotal });
    }

    return this.createJournalEntry(
      {
        business_id: invoice.businessId,
        shop_id: invoice.shopId,
        source_document_id: invoice.id,
        shift_id: invoice.shiftId,
        event_type: 'purchase',
        description: `فاتورة مشتريات #${invoice.invoiceNumber} ${invoice.partyName ? '- ' + invoice.partyName : ''}`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build customer payment (receipt) entry.
   */
  public buildCustomerPaymentEntry(
    voucher: Voucher,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'cashier'
  ): JournalEntry {
    const amount = Number(voucher.amount.toFixed(4));
    const lines: JournalLine[] = [
      { accountId: '', accountCode: '1111', accountName: '', debit: amount, credit: 0 },
      { accountId: '', accountCode: '1121', accountName: '', debit: 0, credit: amount },
    ];
    return this.createJournalEntry(
      {
        business_id: voucher.businessId,
        shop_id: voucher.shopId,
        source_document_id: voucher.id,
        shift_id: voucher.shiftId,
        event_type: 'customer_payment',
        description: `سند قبض من عميل #${voucher.voucherNumber} ${voucher.partyName ? '- ' + voucher.partyName : ''} (${voucher.reason})`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build supplier payment entry.
   */
  public buildSupplierPaymentEntry(
    voucher: Voucher,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'cashier'
  ): JournalEntry {
    const amount = Number(voucher.amount.toFixed(4));
    const lines: JournalLine[] = [
      { accountId: '', accountCode: '2111', accountName: '', debit: amount, credit: 0 },
      { accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: amount },
    ];
    return this.createJournalEntry(
      {
        business_id: voucher.businessId,
        shop_id: voucher.shopId,
        source_document_id: voucher.id,
        shift_id: voucher.shiftId,
        event_type: 'supplier_payment',
        description: `سند صرف لمورد #${voucher.voucherNumber} ${voucher.partyName ? '- ' + voucher.partyName : ''} (${voucher.reason})`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build expense entry.
   */
  public buildExpenseEntry(
    voucher: Voucher,
    expenseAccountCode: string,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'cashier'
  ): JournalEntry {
    const amount = Number(voucher.amount.toFixed(4));
    const lines: JournalLine[] = [
      { accountId: '', accountCode: expenseAccountCode || '5301', accountName: '', debit: amount, credit: 0 },
      { accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: amount },
    ];
    return this.createJournalEntry(
      {
        business_id: voucher.businessId,
        shop_id: voucher.shopId,
        source_document_id: voucher.id,
        shift_id: voucher.shiftId,
        event_type: 'expense',
        description: `سند مصروف #${voucher.voucherNumber} - ${voucher.reason}`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build stock waste entry.
   */
  public buildStockWasteEntry(
    businessId: string,
    shopId: string,
    shiftId: string,
    amount: number,
    reason: string,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'manager'
  ): JournalEntry {
    const rounded = Number(amount.toFixed(4));
    const lines: JournalLine[] = [
      { accountId: '', accountCode: '5102', accountName: '', debit: rounded, credit: 0 },
      { accountId: '', accountCode: '1131', accountName: '', debit: 0, credit: rounded },
    ];
    return this.createJournalEntry(
      {
        business_id: businessId,
        shop_id: shopId,
        shift_id: shiftId,
        event_type: 'stock_waste',
        description: `قيد هالك وتالف مخزون: ${reason}`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build owner drawing entry.
   */
  public buildOwnerDrawingEntry(
    businessId: string,
    shopId: string,
    shiftId: string,
    amount: number,
    reason: string,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'owner'
  ): JournalEntry {
    const rounded = Number(amount.toFixed(4));
    const lines: JournalLine[] = [
      { accountId: '', accountCode: '3201', accountName: '', debit: rounded, credit: 0 },
      { accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: rounded },
    ];
    return this.createJournalEntry(
      {
        business_id: businessId,
        shop_id: shopId,
        shift_id: shiftId,
        event_type: 'owner_drawing',
        description: `مسحوبات المالك: ${reason}`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build capital injection entry.
   */
  public buildCapitalInjectionEntry(
    businessId: string,
    shopId: string,
    shiftId: string,
    amount: number,
    reason: string,
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'owner'
  ): JournalEntry {
    const rounded = Number(amount.toFixed(4));
    const lines: JournalLine[] = [
      { accountId: '', accountCode: '1111', accountName: '', debit: rounded, credit: 0 },
      { accountId: '', accountCode: '3101', accountName: '', debit: 0, credit: rounded },
    ];
    return this.createJournalEntry(
      {
        business_id: businessId,
        shop_id: shopId,
        shift_id: shiftId,
        event_type: 'capital_injection',
        description: `إيداع زيادة رأس المال: ${reason}`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build cash difference entry upon shift closing.
   */
  public buildCashDifferenceEntry(
    businessId: string,
    shopId: string,
    shiftId: string,
    difference: number, // actual - expected
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'cashier'
  ): JournalEntry | null {
    if (Math.abs(difference) < 0.001) {
      return null; // perfectly balanced, no entry needed
    }

    const lines: JournalLine[] = [];
    if (difference < 0) {
      // Shortage (عجز)
      const absDiff = Number(Math.abs(difference).toFixed(4));
      lines.push({ accountId: '', accountCode: '5601', accountName: '', debit: absDiff, credit: 0 });
      lines.push({ accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: absDiff });
    } else {
      // Overage (فائض)
      const posDiff = Number(difference.toFixed(4));
      lines.push({ accountId: '', accountCode: '1111', accountName: '', debit: posDiff, credit: 0 });
      lines.push({ accountId: '', accountCode: '4401', accountName: '', debit: 0, credit: posDiff });
    }

    return this.createJournalEntry(
      {
        business_id: businessId,
        shop_id: shopId,
        shift_id: shiftId,
        event_type: 'cash_difference',
        description: `تسوية فروقات الصندوق لإغلاق الوردية (${difference < 0 ? 'عجز' : 'فائض'} بقيمة ${Math.abs(
          difference
        )})`,
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Helper to build opening balances entry for newly migrated business.
   * Debits: Cash + Inventory + Receivables
   * Credits: Payables + Equity
   */
  public buildOpeningBalancesEntry(
    businessId: string,
    shopId: string,
    balances: {
      cash: number;
      inventory: number;
      receivables: number;
      payables: number;
      equity: number;
    },
    accountsMap: Map<string, Account> | Record<string, Account>,
    createdBy = 'owner'
  ): JournalEntry {
    const lines: JournalLine[] = [];

    if (balances.cash > 0) {
      lines.push({ accountId: '', accountCode: '1111', accountName: '', debit: Number(balances.cash.toFixed(4)), credit: 0 });
    }
    if (balances.inventory > 0) {
      lines.push({ accountId: '', accountCode: '1131', accountName: '', debit: Number(balances.inventory.toFixed(4)), credit: 0 });
    }
    if (balances.receivables > 0) {
      lines.push({ accountId: '', accountCode: '1121', accountName: '', debit: Number(balances.receivables.toFixed(4)), credit: 0 });
    }
    if (balances.payables > 0) {
      lines.push({ accountId: '', accountCode: '2111', accountName: '', debit: 0, credit: Number(balances.payables.toFixed(4)) });
    }

    // Balancing figure to Equity / Capital
    const totalDebits = (balances.cash || 0) + (balances.inventory || 0) + (balances.receivables || 0);
    const equityBalance = Number((totalDebits - (balances.payables || 0)).toFixed(4));

    if (equityBalance > 0) {
      lines.push({ accountId: '', accountCode: '3101', accountName: '', debit: 0, credit: equityBalance });
    } else if (equityBalance < 0) {
      lines.push({ accountId: '', accountCode: '3301', accountName: '', debit: Math.abs(equityBalance), credit: 0 });
    }

    return this.createJournalEntry(
      {
        business_id: businessId,
        shop_id: shopId,
        event_type: 'opening_balances',
        description: 'قيد الأرصدة الافتتاحية للمشروع المهاجر',
        lines,
        createdBy,
      },
      accountsMap
    );
  }

  /**
   * Builds an immutable reversal entry for an existing journal entry.
   * Reverses debits and credits symmetrically.
   */
  public buildReversalEntry(
    originalEntry: JournalEntry,
    accountsMap: Map<string, Account> | Record<string, Account>,
    reason: string,
    createdBy = 'accountant'
  ): JournalEntry {
    const reversedLines: JournalLine[] = originalEntry.lines.map((l) => ({
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.credit,
      credit: l.debit,
      description: `قيد عكسي لـ ${originalEntry.entry_number}: ${reason}`,
    }));

    return this.createJournalEntry(
      {
        business_id: originalEntry.business_id,
        shop_id: originalEntry.shop_id,
        branch_id: originalEntry.branch_id,
        source_document_id: originalEntry.id,
        shift_id: originalEntry.shift_id,
        event_type: 'reversal',
        description: `قيد عكسي وتصحيحي لـ #${originalEntry.entry_number} (${reason})`,
        lines: reversedLines,
        createdBy,
      },
      accountsMap
    );
  }
}
