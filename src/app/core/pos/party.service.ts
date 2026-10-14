import { Injectable, signal, computed, inject } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.config';
import { handleFirestoreError, OperationType } from '../firebase/firestore-error.handler';
import { BusinessService } from '../business/business.service';
import { Party, PartyRole } from '../models';

@Injectable({
  providedIn: 'root',
})
export class PartyService {
  private businessService = inject(BusinessService);

  public parties = signal<Party[]>([]);
  public isLoading = signal<boolean>(false);

  public customers = computed(() => {
    return this.parties().filter((p) => p.roles.includes('CUSTOMER'));
  });

  public suppliers = computed(() => {
    return this.parties().filter((p) => p.roles.includes('SUPPLIER'));
  });

  public dualParties = computed(() => {
    return this.parties().filter(
      (p) => p.roles.includes('CUSTOMER') && p.roles.includes('SUPPLIER')
    );
  });

  private loadedBusinessId = '';
  private unsubParties: (() => void) | null = null;

  constructor() {
    setInterval(() => {
      const biz = this.businessService.currentBusiness();
      if (biz && this.loadedBusinessId !== biz.id) {
        this.loadParties(biz.id);
      }
    }, 1500);
  }

  public loadParties(businessId: string): void {
    this.loadedBusinessId = businessId;
    this.isLoading.set(true);

    if (this.unsubParties) { this.unsubParties(); }

    const partiesRef = collection(db, `businesses/${businessId}/parties`);
    this.unsubParties = onSnapshot(
      partiesRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Party));
        list.sort((a, b) => a.name.localeCompare(b.name));
        this.parties.set(list);
        this.isLoading.set(false);
      },
      (err) => {
        console.warn('Parties snapshot notice:', err.message);
        this.isLoading.set(false);
      }
    );
  }

  public async saveParty(partyData: Partial<Party>): Promise<Party> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً. يرجى إنشاء نشاط تجاري أولاً.');

    const partyId = partyData.id || 'party_' + Date.now();
    const isNew = !partyData.id;

    const party: Party = {
      id: partyId,
      businessId: biz.id,
      name: partyData.name || '',
      phone: partyData.phone || '',
      email: partyData.email || '',
      roles: partyData.roles && partyData.roles.length > 0 ? partyData.roles : ['CUSTOMER'],
      balance: Number(partyData.balance || 0),
      customerProfile: partyData.customerProfile || {
        creditLimit: 500,
        currentDebt: 0,
      },
      supplierProfile: partyData.supplierProfile || {
        taxId: '',
        companyName: '',
      },
      createdAt: partyData.createdAt || new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, `businesses/${biz.id}/parties`, partyId), party);
      return party;
    } catch (err) {
      handleFirestoreError(
        err,
        isNew ? OperationType.CREATE : OperationType.UPDATE,
        `businesses/${biz.id}/parties/${partyId}`
      );
    }
  }

  /**
   * Netting function for dual customer + supplier parties:
   * Returns net position: if positive, we owe supplier; if negative, customer owes us.
   */
  public calculateNetting(party: Party): { netBalance: number; description: string } {
    const balance = party.balance || 0;
    if (balance > 0) {
      return {
        netBalance: balance,
        description: `رصيد صافٍ لصالح المورد (مطلوب منا سداد: ${balance})`,
      };
    } else if (balance < 0) {
      const debt = Math.abs(balance);
      return {
        netBalance: balance,
        description: `رصيد صافٍ على العميل (مطلوب تحصيل: ${debt})`,
      };
    }
    return { netBalance: 0, description: 'الرصيد مصَفَّر (متعادل)' };
  }

  public checkCreditLimit(party: Party, requestedCreditAmount: number): { allowed: boolean; reason?: string } {
    if (!party.roles.includes('CUSTOMER')) {
      return { allowed: false, reason: 'الطرف المحدد ليس مسجلاً كعميل.' };
    }
    const limit = party.customerProfile?.creditLimit ?? 0;
    const currentDebt = party.customerProfile?.currentDebt ?? 0;
    const newDebt = currentDebt + requestedCreditAmount;

    if (limit > 0 && newDebt > limit) {
      return {
        allowed: false,
        reason: `تجاوز الحد الائتماني! الحد المسموح: ${limit}، المديونية الحالية: ${currentDebt}، الطلب الجديد: ${requestedCreditAmount}.`,
      };
    }
    return { allowed: true };
  }
}
