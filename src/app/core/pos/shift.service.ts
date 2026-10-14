import { Injectable, signal, computed, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.config';
import { handleFirestoreError, OperationType } from '../firebase/firestore-error.handler';
import { BusinessService } from '../business/business.service';
import { AuthService } from '../auth/auth.service';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { AccountingService } from '../accounting/accounting.service';
import { Shift } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ShiftService {
  private businessService = inject(BusinessService);
  private authService = inject(AuthService);
  private postingEngine = inject(PostingEngineService);
  private accountingService = inject(AccountingService);

  public activeShift = signal<Shift | null>(null);
  public shiftHistory = signal<Shift[]>([]);
  public isShiftOpen = computed(() => !!this.activeShift());

  private loadedShopId = '';
  private unsubActiveShift: (() => void) | null = null;
  private unsubShiftHistory: (() => void) | null = null;

  constructor() {
    setInterval(() => {
      const biz = this.businessService.currentBusiness();
      const shop = this.businessService.activeShop();
      if (biz && shop && this.loadedShopId !== shop.id) {
        this.loadCurrentShopShift(biz.id, shop.id);
      }
    }, 1500);
  }

  public loadCurrentShopShift(businessId: string, shopId: string): void {
    this.loadedShopId = shopId;

    if (this.unsubActiveShift) { this.unsubActiveShift(); }
    if (this.unsubShiftHistory) { this.unsubShiftHistory(); }

    const shiftsRef = collection(db, `businesses/${businessId}/shifts`);
    const q = query(shiftsRef, where('shopId', '==', shopId), where('status', '==', 'open'));

    this.unsubActiveShift = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const current = { id: snap.docs[0].id, ...snap.docs[0].data() } as Shift;
          this.activeShift.set(current);
        } else {
          this.activeShift.set(null);
        }
      },
      (err) => console.warn('Active shift snapshot notice:', err.message)
    );

    // History
    const historyQ = query(shiftsRef, where('shopId', '==', shopId));
    this.unsubShiftHistory = onSnapshot(
      historyQ,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift));
        list.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
        this.shiftHistory.set(list);
      },
      (err) => console.warn('Shift history snapshot notice:', err.message)
    );
  }

  public async openShift(openingCash: number, notes = ''): Promise<Shift> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    const shop = this.businessService.activeShop();
    const user = this.authService.firebaseUser();
    if (!biz || !shop || !user) {
      throw new Error('يرجى التأكد من تسجيل الدخول واختيار المحل التجاري لفتح الوردية.');
    }

    const shiftId = 'shift_' + Date.now();
    const newShift: Shift = {
      id: shiftId,
      businessId: biz.id,
      shopId: shop.id,
      userId: this.authService.effectiveUserId(),
      userName: this.authService.effectiveUserName(),
      deviceId: 'dev_browser',
      status: 'open',
      openingCash: Number(openingCash || 0),
      openedAt: new Date().toISOString(),
      notes,
    };

    try {
      await setDoc(doc(db, `businesses/${biz.id}/shifts`, shiftId), newShift);
      this.activeShift.set(newShift);
      return newShift;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `businesses/${biz.id}/shifts`);
    }
  }

  public async closeShift(
    closingCashActual: number,
    closingCashExpected: number,
    notes = ''
  ): Promise<void> {
    const shift = this.activeShift();
    const biz = this.businessService.currentBusiness();
    if (!shift || !biz) throw new Error('No active shift to close.');

    const difference = Number((closingCashActual - closingCashExpected).toFixed(4));
    const batch = writeBatch(db);

    // Update shift doc
    const shiftRef = doc(db, `businesses/${biz.id}/shifts`, shift.id);
    batch.update(shiftRef, {
      status: 'closed',
      closingCashActual: Number(closingCashActual.toFixed(4)),
      closingCashExpected: Number(closingCashExpected.toFixed(4)),
      difference,
      closedAt: new Date().toISOString(),
      notes,
    });

    // If there is cash shortage or overage, generate auto journal entry
    if (Math.abs(difference) >= 0.001) {
      const diffEntry = this.postingEngine.buildCashDifferenceEntry(
        biz.id,
        shift.shopId,
        shift.id,
        difference,
        this.accountingService.accountsMap(),
        this.authService.effectiveUserId()
      );
      if (diffEntry) {
        batch.set(doc(db, `businesses/${biz.id}/journal_entries`, diffEntry.id), diffEntry);
      }
    }

    try {
      await batch.commit();
      this.activeShift.set(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${biz.id}/shifts/${shift.id}`);
    }
  }
}
