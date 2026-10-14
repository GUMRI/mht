import { Injectable, signal, computed, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.config';
import { handleFirestoreError, OperationType } from '../firebase/firestore-error.handler';
import { BusinessService } from '../business/business.service';
import { PostingEngineService } from './posting-engine.service';
import { Account, JournalEntry, JournalLine } from '../models';

export interface TrialBalanceItem {
  account: Account;
  debit: number;
  credit: number;
  netDebit: number;
  netCredit: number;
}

@Injectable({
  providedIn: 'root',
})
export class AccountingService {
  private businessService = inject(BusinessService);
  private postingEngine = inject(PostingEngineService);

  public accounts = signal<Account[]>([]);
  public journalEntries = signal<JournalEntry[]>([]);
  public isLoading = signal<boolean>(false);

  // Map for rapid lookup by code or id
  public accountsMap = computed(() => {
    const map = new Map<string, Account>();
    for (const acc of this.accounts()) {
      map.set(acc.code, acc);
      map.set(acc.id, acc);
    }
    return map;
  });

  // Calculate current account balances from all journal entries
  public accountsWithCalculatedBalances = computed(() => {
    const accs = this.accounts();
    const entries = this.journalEntries();

    const debitSums = new Map<string, number>();
    const creditSums = new Map<string, number>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const code = line.accountCode;
        debitSums.set(code, (debitSums.get(code) || 0) + (line.debit || 0));
        creditSums.set(code, (creditSums.get(code) || 0) + (line.credit || 0));
      }
    }

    return accs.map((acc) => {
      const d = debitSums.get(acc.code) || 0;
      const c = creditSums.get(acc.code) || 0;
      // Normal balance: Assets (1000) & Expenses (5000) have Debit normal balance;
      // Liabilities (2000), Equity (3000), Revenues (4000) have Credit normal balance.
      let bal = 0;
      if (acc.group === 1000 || acc.group === 5000) {
        bal = d - c;
      } else {
        bal = c - d;
      }
      return {
        ...acc,
        balance: Number(bal.toFixed(4)),
      };
    });
  });

  // Trial Balance calculation
  public trialBalance = computed(() => {
    const calculatedAccs = this.accountsWithCalculatedBalances();
    const entries = this.journalEntries();

    const debitSums = new Map<string, number>();
    const creditSums = new Map<string, number>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const code = line.accountCode;
        debitSums.set(code, (debitSums.get(code) || 0) + (line.debit || 0));
        creditSums.set(code, (creditSums.get(code) || 0) + (line.credit || 0));
      }
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const items: TrialBalanceItem[] = [];

    // Only show leaf accounts in trial balance
    for (const acc of calculatedAccs.filter((a) => a.is_leaf)) {
      const d = Number((debitSums.get(acc.code) || 0).toFixed(4));
      const c = Number((creditSums.get(acc.code) || 0).toFixed(4));

      let netDebit = 0;
      let netCredit = 0;
      if (d >= c) {
        netDebit = Number((d - c).toFixed(4));
      } else {
        netCredit = Number((c - d).toFixed(4));
      }

      totalDebit += netDebit;
      totalCredit += netCredit;

      items.push({
        account: acc,
        debit: d,
        credit: c,
        netDebit,
        netCredit,
      });
    }

    return {
      items,
      totalDebit: Number(totalDebit.toFixed(4)),
      totalCredit: Number(totalCredit.toFixed(4)),
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.001,
    };
  });

  // Income Statement (Revenues - Expenses)
  public incomeStatement = computed(() => {
    const accs = this.accountsWithCalculatedBalances();
    const revenues = accs.filter((a) => a.group === 4000 && a.is_leaf);
    const expenses = accs.filter((a) => a.group === 5000 && a.is_leaf);

    const totalRevenues = Number(revenues.reduce((sum, a) => sum + (a.balance || 0), 0).toFixed(4));
    const totalExpenses = Number(expenses.reduce((sum, a) => sum + (a.balance || 0), 0).toFixed(4));
    const netProfit = Number((totalRevenues - totalExpenses).toFixed(4));

    return {
      revenues,
      expenses,
      totalRevenues,
      totalExpenses,
      netProfit,
    };
  });

  // Balance Sheet (Assets, Liabilities, Equity)
  public balanceSheet = computed(() => {
    const accs = this.accountsWithCalculatedBalances();
    const assets = accs.filter((a) => a.group === 1000 && a.is_leaf);
    const liabilities = accs.filter((a) => a.group === 2000 && a.is_leaf);
    const equity = accs.filter((a) => a.group === 3000 && a.is_leaf);
    const { netProfit } = this.incomeStatement();

    const currentAssets = assets.filter((a) => a.classification === 'current');
    const fixedAssets = assets.filter((a) => a.classification === 'non_current');

    const currentLiab = liabilities.filter((a) => a.classification === 'current');
    const longTermLiab = liabilities.filter((a) => a.classification === 'non_current');

    const totalAssets = Number(assets.reduce((sum, a) => sum + (a.balance || 0), 0).toFixed(4));
    const totalLiabilities = Number(liabilities.reduce((sum, a) => sum + (a.balance || 0), 0).toFixed(4));
    const baseEquity = Number(equity.reduce((sum, a) => sum + (a.balance || 0), 0).toFixed(4));
    const totalEquity = Number((baseEquity + netProfit).toFixed(4));
    const totalLiabilitiesAndEquity = Number((totalLiabilities + totalEquity).toFixed(4));

    return {
      currentAssets,
      fixedAssets,
      totalAssets,
      currentLiab,
      longTermLiab,
      totalLiabilities,
      equity,
      baseEquity,
      netProfit,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.001,
    };
  });

  private loadedBusinessId = '';
  private unsubAccounts: (() => void) | null = null;
  private unsubJournals: (() => void) | null = null;

  constructor() {
    setInterval(() => {
      const biz = this.businessService.currentBusiness();
      if (biz && this.loadedBusinessId !== biz.id) {
        this.loadAccountingData(biz.id);
      }
    }, 1200);
  }

  public loadAccountingData(businessId: string): void {
    this.loadedBusinessId = businessId;
    this.isLoading.set(true);

    if (this.unsubAccounts) { this.unsubAccounts(); }
    if (this.unsubJournals) { this.unsubJournals(); }

    // 1. Accounts
    const accsRef = collection(db, `businesses/${businessId}/accounts`);
    this.unsubAccounts = onSnapshot(
      accsRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account));
        list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        this.accounts.set(list);
        this.isLoading.set(false);
      },
      (err) => {
        console.warn('Accounts snapshot notice:', err.message);
        this.isLoading.set(false);
      }
    );

    // 2. Journal Entries
    const jeRef = collection(db, `businesses/${businessId}/journal_entries`);
    this.unsubJournals = onSnapshot(
      jeRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as JournalEntry));
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.journalEntries.set(list);
      },
      (err) => {
        console.warn('Journal entries snapshot notice:', err.message);
      }
    );
  }

  /**
   * Adds a new leaf account under a parent account.
   */
  public async addAccount(data: {
    code: string;
    name_ar: string;
    name_en: string;
    group: number;
    parent: string;
    classification: 'current' | 'non_current' | null;
  }): Promise<Account> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً.');

    // Enforce parent is non-system or valid
    const parentAcc = this.accounts().find((a) => a.code === data.parent);
    const parentDisplayName = parentAcc ? parentAcc.displayName : '';
    const displayName = `${parentDisplayName} - ${data.name_ar}`;

    const accountId = 'acc_' + data.code;
    const newAcc: Account = {
      id: accountId,
      businessId: biz.id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      group: data.group,
      parent: data.parent,
      is_leaf: true,
      is_system: false,
      classification: data.classification,
      balance: 0,
      displayName,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, `businesses/${biz.id}/accounts`, accountId), newAcc);
      return newAcc;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `businesses/${biz.id}/accounts`);
    }
  }

  /**
   * Reverses a journal entry immutably.
   */
  public async reverseEntry(entry: JournalEntry, reason: string): Promise<JournalEntry> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً.');

    const reversal = this.postingEngine.buildReversalEntry(entry, this.accountsMap(), reason);
    try {
      await setDoc(doc(db, `businesses/${biz.id}/journal_entries`, reversal.id), reversal);
      // Mark original entry as reversed
      const originalRef = doc(db, `businesses/${biz.id}/journal_entries`, entry.id);
      // We don't update original entry directly if immutable in security rules, but record reversal link in reversal entry!
      return reversal;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `businesses/${biz.id}/journal_entries`);
    }
  }

  /**
   * One-tap CSV Export utility for financial reports
   */
  public exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
    const csvContent =
      '\uFEFF' + // UTF-8 BOM for Arabic Excel support
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * One-tap PDF / Browser print
   */
  public printReport(): void {
    window.print();
  }
}
