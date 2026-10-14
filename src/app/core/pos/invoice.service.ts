import { Injectable, signal, inject } from '@angular/core';
import {
  collection,
  doc,
  writeBatch,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.config';
import { handleFirestoreError, OperationType } from '../firebase/firestore-error.handler';
import { BusinessService } from '../business/business.service';
import { AuthService } from '../auth/auth.service';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { AccountingService } from '../accounting/accounting.service';
import { ProductService } from './product.service';
import { PartyService } from './party.service';
import { Invoice, Voucher, InvoicePayment, InvoiceItem, Party } from '../models';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  private businessService = inject(BusinessService);
  private authService = inject(AuthService);
  private postingEngine = inject(PostingEngineService);
  private accountingService = inject(AccountingService);
  private productService = inject(ProductService);
  private partyService = inject(PartyService);

  public invoices = signal<Invoice[]>([]);
  public vouchers = signal<Voucher[]>([]);

  private loadedBusinessId = '';
  private unsubInvoices: (() => void) | null = null;
  private unsubVouchers: (() => void) | null = null;

  constructor() {
    setInterval(() => {
      const biz = this.businessService.currentBusiness();
      if (biz && this.loadedBusinessId !== biz.id) {
        this.loadInvoicesAndVouchers(biz.id);
      }
    }, 1500);
  }

  public loadInvoicesAndVouchers(businessId: string): void {
    this.loadedBusinessId = businessId;

    if (this.unsubInvoices) { this.unsubInvoices(); }
    if (this.unsubVouchers) { this.unsubVouchers(); }

    const invRef = collection(db, `businesses/${businessId}/invoices`);
    this.unsubInvoices = onSnapshot(
      invRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.invoices.set(list);
      },
      (err) => console.warn('Invoices snapshot notice:', err.message)
    );

    const vouchRef = collection(db, `businesses/${businessId}/vouchers`);
    this.unsubVouchers = onSnapshot(
      vouchRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Voucher));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.vouchers.set(list);
      },
      (err) => console.warn('Vouchers snapshot notice:', err.message)
    );
  }

  /**
   * Completes a POS Sale:
   * 1. Creates the Invoice document
   * 2. Creates the balanced Journal Entry via PostingEngine
   * 3. Deducts inventory stock for physical items
   * 4. Updates customer debt/balance if credit payment
   * 5. Commits ALL atomically in one Firestore writeBatch!
   */
  public async completeSale(params: {
    shopId: string;
    shiftId: string;
    items: InvoiceItem[];
    customer?: Party;
    discountTotal: number;
    payments: InvoicePayment[];
  }): Promise<{ invoice: Invoice; journalEntryId: string }> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً. يرجى إنشاء نشاط تجاري أولاً.');

    const subtotal = Number(
      params.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(4)
    );
    const taxTotal = 0; // standard tax or zero
    const grandTotal = Number((subtotal - params.discountTotal + taxTotal).toFixed(4));

    // Verify payments equal or exceed grandTotal
    const totalPaid = Number(params.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(4));
    if (totalPaid < grandTotal - 0.001) {
      throw new Error(`Payment mismatch: Total paid (${totalPaid}) is less than grand total (${grandTotal})`);
    }

    // Check credit payment if any
    const creditPayment = params.payments.find((p) => p.method === 'credit');
    if (creditPayment && creditPayment.amount > 0) {
      if (!params.customer) {
        throw new Error('Credit payment requires selecting a registered customer.');
      }
      const check = this.partyService.checkCreditLimit(params.customer, creditPayment.amount);
      if (!check.allowed) {
        throw new Error(check.reason);
      }
    }

    const invoiceId = 'inv_' + Date.now();
    const invoiceNumber = 'INV-' + Date.now().toString().slice(-6);

    // Calculate total cost of goods sold
    const totalCost = Number(
      params.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0).toFixed(4)
    );

    const invoice: Invoice = {
      id: invoiceId,
      businessId: biz.id,
      shopId: params.shopId,
      shiftId: params.shiftId,
      invoiceNumber,
      type: 'sale',
      partyId: params.customer?.id,
      partyName: params.customer?.name,
      items: params.items,
      subtotal,
      discountTotal: params.discountTotal,
      taxTotal,
      grandTotal,
      paymentStatus: 'paid',
      payments: params.payments,
      status: 'completed',
      preparationStatus: 'received',
      createdAt: new Date().toISOString(),
      createdBy: this.authService.effectiveUserId(),
    };

    // Build balanced journal entry
    const journalEntry = this.postingEngine.buildSaleEntry(
      invoice,
      totalCost,
      this.accountingService.accountsMap(),
      this.authService.effectiveUserId()
    );
    invoice.journalEntryId = journalEntry.id;

    // ATOMIC BATCH WRITE
    const batch = writeBatch(db);

    // 1. Invoice doc
    batch.set(doc(db, `businesses/${biz.id}/invoices`, invoiceId), invoice);

    // 2. Journal entry doc
    batch.set(doc(db, `businesses/${biz.id}/journal_entries`, journalEntry.id), journalEntry);

    // 3. Stock deduction
    for (const item of params.items) {
      const prod = this.productService.products().find((p) => p.id === item.productId);
      if (prod && prod.type === 'physical') {
        const newStock = Math.max(0, prod.stock - item.quantity);
        batch.update(doc(db, `businesses/${biz.id}/products`, item.productId), { stock: newStock });
      }
    }

    // 4. Update customer current debt if credit used
    if (creditPayment && params.customer) {
      const currentDebt = params.customer.customerProfile?.currentDebt || 0;
      const newDebt = currentDebt + creditPayment.amount;
      batch.update(doc(db, `businesses/${biz.id}/parties`, params.customer.id), {
        'customerProfile.currentDebt': newDebt,
        balance: (params.customer.balance || 0) - creditPayment.amount,
      });
    }

    try {
      await batch.commit();
      return { invoice, journalEntryId: journalEntry.id };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${biz.id}/invoices/${invoiceId}`);
    }
  }

  /**
   * Records a Purchase Invoice atomically with Journal Entry and Stock increment
   */
  public async completePurchase(params: {
    shopId: string;
    shiftId: string;
    items: InvoiceItem[];
    supplier: Party;
    isPaidCash: boolean;
  }): Promise<Invoice> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً. يرجى إنشاء نشاط تجاري أولاً.');

    const subtotal = Number(
      params.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(4)
    );
    const taxTotal = 0;
    const grandTotal = subtotal;

    const invoiceId = 'pur_' + Date.now();
    const invoiceNumber = 'PUR-' + Date.now().toString().slice(-6);

    const invoice: Invoice = {
      id: invoiceId,
      businessId: biz.id,
      shopId: params.shopId,
      shiftId: params.shiftId,
      invoiceNumber,
      type: 'purchase',
      partyId: params.supplier.id,
      partyName: params.supplier.name,
      items: params.items,
      subtotal,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal,
      paymentStatus: params.isPaidCash ? 'paid' : 'unpaid',
      payments: params.isPaidCash ? [{ method: 'cash', amount: grandTotal }] : [],
      status: 'completed',
      preparationStatus: 'delivered',
      createdAt: new Date().toISOString(),
      createdBy: this.authService.effectiveUserId(),
    };

    const journalEntry = this.postingEngine.buildPurchaseEntry(
      invoice,
      params.isPaidCash,
      this.accountingService.accountsMap(),
      this.authService.effectiveUserId()
    );
    invoice.journalEntryId = journalEntry.id;

    const batch = writeBatch(db);
    batch.set(doc(db, `businesses/${biz.id}/invoices`, invoiceId), invoice);
    batch.set(doc(db, `businesses/${biz.id}/journal_entries`, journalEntry.id), journalEntry);

    // Increase stock
    for (const item of params.items) {
      const prod = this.productService.products().find((p) => p.id === item.productId);
      if (prod && prod.type === 'physical') {
        const newStock = prod.stock + item.quantity;
        batch.update(doc(db, `businesses/${biz.id}/products`, item.productId), {
          stock: newStock,
          costPrice: item.unitPrice,
        });
      }
    }

    // Update supplier balance if on credit
    if (!params.isPaidCash) {
      const currentBalance = params.supplier.balance || 0;
      batch.update(doc(db, `businesses/${biz.id}/parties`, params.supplier.id), {
        balance: currentBalance + grandTotal,
      });
    }

    try {
      await batch.commit();
      return invoice;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${biz.id}/invoices/${invoiceId}`);
    }
  }

  /**
   * Creates a Treasury Voucher (Customer receipt or Supplier payment)
   */
  public async createTreasuryVoucher(params: {
    shopId: string;
    shiftId: string;
    type: 'customer_receipt' | 'supplier_payment';
    party: Party;
    amount: number;
    reason: string;
  }): Promise<Voucher> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً. يرجى إنشاء نشاط تجاري أولاً.');

    const voucherId = 'vch_' + Date.now();
    const voucherNumber = (params.type === 'customer_receipt' ? 'RCT-' : 'PMT-') + Date.now().toString().slice(-6);

    const voucher: Voucher = {
      id: voucherId,
      businessId: biz.id,
      shopId: params.shopId,
      shiftId: params.shiftId,
      voucherNumber,
      type: params.type,
      partyId: params.party.id,
      partyName: params.party.name,
      amount: Number(params.amount.toFixed(4)),
      reason: params.reason,
      createdAt: new Date().toISOString(),
      createdBy: this.authService.effectiveUserId(),
    };

    let journalEntry;
    if (params.type === 'customer_receipt') {
      journalEntry = this.postingEngine.buildCustomerPaymentEntry(
        voucher,
        this.accountingService.accountsMap(),
        this.authService.effectiveUserId()
      );
    } else {
      journalEntry = this.postingEngine.buildSupplierPaymentEntry(
        voucher,
        this.accountingService.accountsMap(),
        this.authService.effectiveUserId()
      );
    }
    voucher.journalEntryId = journalEntry.id;

    const batch = writeBatch(db);
    batch.set(doc(db, `businesses/${biz.id}/vouchers`, voucherId), voucher);
    batch.set(doc(db, `businesses/${biz.id}/journal_entries`, journalEntry.id), journalEntry);

    // Update party balance
    if (params.type === 'customer_receipt') {
      const currentDebt = params.party.customerProfile?.currentDebt || 0;
      const newDebt = Math.max(0, currentDebt - params.amount);
      batch.update(doc(db, `businesses/${biz.id}/parties`, params.party.id), {
        'customerProfile.currentDebt': newDebt,
        balance: (params.party.balance || 0) + params.amount,
      });
    } else {
      batch.update(doc(db, `businesses/${biz.id}/parties`, params.party.id), {
        balance: (params.party.balance || 0) - params.amount,
      });
    }

    try {
      await batch.commit();
      return voucher;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${biz.id}/vouchers/${voucherId}`);
    }
  }

  /**
   * Creates an Adjustment Voucher (Expense, Waste, Cash Difference, Drawings, Capital)
   */
  public async createAdjustmentVoucher(params: {
    shopId: string;
    shiftId: string;
    type: 'expense' | 'stock_waste' | 'owner_drawing' | 'capital_injection';
    amount: number;
    reason: string;
    expenseAccountCode?: string;
  }): Promise<Voucher> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً. يرجى إنشاء نشاط تجاري أولاً.');

    const voucherId = 'adj_' + Date.now();
    const voucherNumber = 'ADJ-' + Date.now().toString().slice(-6);

    const voucher: Voucher = {
      id: voucherId,
      businessId: biz.id,
      shopId: params.shopId,
      shiftId: params.shiftId,
      voucherNumber,
      type: params.type,
      amount: Number(params.amount.toFixed(4)),
      reason: params.reason,
      expenseCategory: params.expenseAccountCode,
      createdAt: new Date().toISOString(),
      createdBy: this.authService.effectiveUserId(),
    };

    let journalEntry;
    if (params.type === 'expense') {
      journalEntry = this.postingEngine.buildExpenseEntry(
        voucher,
        params.expenseAccountCode || '5301',
        this.accountingService.accountsMap(),
        this.authService.effectiveUserId()
      );
    } else if (params.type === 'stock_waste') {
      journalEntry = this.postingEngine.buildStockWasteEntry(
        biz.id,
        params.shopId,
        params.shiftId,
        params.amount,
        params.reason,
        this.accountingService.accountsMap(),
        this.authService.effectiveUserId()
      );
    } else if (params.type === 'owner_drawing') {
      journalEntry = this.postingEngine.buildOwnerDrawingEntry(
        biz.id,
        params.shopId,
        params.shiftId,
        params.amount,
        params.reason,
        this.accountingService.accountsMap(),
        this.authService.effectiveUserId()
      );
    } else {
      journalEntry = this.postingEngine.buildCapitalInjectionEntry(
        biz.id,
        params.shopId,
        params.shiftId,
        params.amount,
        params.reason,
        this.accountingService.accountsMap(),
        this.authService.effectiveUserId()
      );
    }

    voucher.journalEntryId = journalEntry.id;

    const batch = writeBatch(db);
    batch.set(doc(db, `businesses/${biz.id}/vouchers`, voucherId), voucher);
    batch.set(doc(db, `businesses/${biz.id}/journal_entries`, journalEntry.id), journalEntry);

    try {
      await batch.commit();
      return voucher;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${biz.id}/vouchers/${voucherId}`);
    }
  }
}
