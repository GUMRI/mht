import { describe, it, expect, beforeEach } from 'vitest';
import { PostingEngineService } from './posting-engine.service';
import { UNIVERSAL_CHART_TEMPLATE } from './chart-universal.data';
import { Account, Invoice, Voucher } from '../models';

describe('PostingEngineService', () => {
  let service: PostingEngineService;
  let accountsMap: Map<string, Account>;

  beforeEach(() => {
    service = new PostingEngineService();
    accountsMap = new Map<string, Account>();
    for (const seed of UNIVERSAL_CHART_TEMPLATE) {
      accountsMap.set(seed.code, {
        id: 'acc_' + seed.code,
        businessId: 'biz_test',
        code: seed.code,
        name_ar: seed.name_ar,
        name_en: seed.name_en,
        group: seed.group,
        parent: seed.parent,
        is_leaf: seed.is_leaf,
        is_system: seed.is_system,
        classification: seed.classification,
        balance: 0,
        createdAt: new Date().toISOString(),
      });
    }
  });

  it('strictly rejects posting to a non-leaf summary account', () => {
    expect(() => {
      service.createJournalEntry(
        {
          business_id: 'biz_test',
          shop_id: 'shop_1',
          event_type: 'expense',
          description: 'Invalid non-leaf test',
          lines: [
            { accountId: '', accountCode: '1000', accountName: '', debit: 100, credit: 0 },
            { accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: 100 },
          ],
        },
        accountsMap
      );
    }).toThrow(/is not a leaf account/);
  });

  it('strictly rejects unbalanced entries where debits != credits', () => {
    expect(() => {
      service.createJournalEntry(
        {
          business_id: 'biz_test',
          shop_id: 'shop_1',
          event_type: 'expense',
          description: 'Unbalanced test',
          lines: [
            { accountId: '', accountCode: '5301', accountName: '', debit: 100, credit: 0 },
            { accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: 80 },
          ],
        },
        accountsMap
      );
    }).toThrow(/Entry is unbalanced/);
  });

  it('balances Sale event (Cash)', () => {
    const invoice: Invoice = {
      id: 'inv_1',
      businessId: 'biz_test',
      shopId: 'shop_1',
      shiftId: 'shift_1',
      invoiceNumber: 'INV-101',
      type: 'sale',
      items: [
        {
          productId: 'p1',
          name: 'Coffee',
          quantity: 2,
          unitPrice: 5,
          costPrice: 2,
          subtotal: 10,
          discount: 0,
          total: 10,
        },
      ],
      subtotal: 10,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 10,
      paymentStatus: 'paid',
      payments: [{ method: 'cash', amount: 10 }],
      status: 'completed',
      preparationStatus: 'delivered',
      createdAt: new Date().toISOString(),
      createdBy: 'cashier1',
    };

    const entry = service.buildSaleEntry(invoice, 4, accountsMap);
    expect(entry.debit_total).toBe(entry.credit_total);
    expect(entry.debit_total).toBe(14); // 10 cash + 4 cogs
  });

  it('balances Sale event (Credit on Account)', () => {
    const invoice: Invoice = {
      id: 'inv_2',
      businessId: 'biz_test',
      shopId: 'shop_1',
      shiftId: 'shift_1',
      invoiceNumber: 'INV-102',
      type: 'sale',
      partyId: 'cust_1',
      partyName: 'Company A',
      items: [
        {
          productId: 'p1',
          name: 'Service',
          quantity: 1,
          unitPrice: 100,
          costPrice: 0,
          subtotal: 100,
          discount: 0,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 100,
      paymentStatus: 'unpaid',
      payments: [{ method: 'credit', amount: 100 }],
      status: 'completed',
      preparationStatus: 'delivered',
      createdAt: new Date().toISOString(),
      createdBy: 'cashier1',
    };

    const entry = service.buildSaleEntry(invoice, 0, accountsMap);
    expect(entry.debit_total).toBe(100);
    expect(entry.credit_total).toBe(100);
    const recLine = entry.lines.find((l) => l.accountCode === '1121');
    expect(recLine?.debit).toBe(100);
  });

  it('balances Purchase event', () => {
    const invoice: Invoice = {
      id: 'pur_1',
      businessId: 'biz_test',
      shopId: 'shop_1',
      shiftId: 'shift_1',
      invoiceNumber: 'PUR-101',
      type: 'purchase',
      partyId: 'supp_1',
      items: [
        {
          productId: 'p1',
          name: 'Raw Milk',
          quantity: 50,
          unitPrice: 2,
          costPrice: 2,
          subtotal: 100,
          discount: 0,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 100,
      paymentStatus: 'paid',
      payments: [{ method: 'cash', amount: 100 }],
      status: 'completed',
      preparationStatus: 'delivered',
      createdAt: new Date().toISOString(),
      createdBy: 'manager1',
    };

    const entry = service.buildPurchaseEntry(invoice, true, accountsMap);
    expect(entry.debit_total).toBe(100);
    expect(entry.credit_total).toBe(100);
  });

  it('balances Customer Receipt and Supplier Payment events', () => {
    const receipt: Voucher = {
      id: 'v_1',
      businessId: 'biz_test',
      shopId: 'shop_1',
      shiftId: 'shift_1',
      voucherNumber: 'RCT-001',
      type: 'customer_receipt',
      amount: 75,
      reason: 'Debt collection',
      createdAt: new Date().toISOString(),
      createdBy: 'cashier1',
    };
    const rctEntry = service.buildCustomerPaymentEntry(receipt, accountsMap);
    expect(rctEntry.debit_total).toBe(75);
    expect(rctEntry.credit_total).toBe(75);

    const payment: Voucher = {
      id: 'v_2',
      businessId: 'biz_test',
      shopId: 'shop_1',
      shiftId: 'shift_1',
      voucherNumber: 'PMT-001',
      type: 'supplier_payment',
      amount: 120,
      reason: 'Supplier installment',
      createdAt: new Date().toISOString(),
      createdBy: 'cashier1',
    };
    const pmtEntry = service.buildSupplierPaymentEntry(payment, accountsMap);
    expect(pmtEntry.debit_total).toBe(120);
    expect(pmtEntry.credit_total).toBe(120);
  });

  it('balances Opening Balances for migrating businesses', () => {
    const entry = service.buildOpeningBalancesEntry(
      'biz_test',
      'shop_1',
      {
        cash: 1000,
        inventory: 5000,
        receivables: 2000,
        payables: 1500,
        equity: 0,
      },
      accountsMap
    );
    expect(entry.debit_total).toBe(8000); // 1000 + 5000 + 2000
    expect(entry.credit_total).toBe(8000); // 1500 payables + 6500 equity balancing figure
  });

  it('balances Reversal Entries symmetrically', () => {
    const original = service.createJournalEntry(
      {
        business_id: 'biz_test',
        shop_id: 'shop_1',
        event_type: 'expense',
        description: 'Rent expense',
        lines: [
          { accountId: '', accountCode: '5301', accountName: '', debit: 500, credit: 0 },
          { accountId: '', accountCode: '1111', accountName: '', debit: 0, credit: 500 },
        ],
      },
      accountsMap
    );

    const reversal = service.buildReversalEntry(original, accountsMap, 'Mistake in rent amount');
    expect(reversal.debit_total).toBe(500);
    expect(reversal.credit_total).toBe(500);
    expect(reversal.lines[0].credit).toBe(500);
    expect(reversal.lines[1].debit).toBe(500);
  });
});
