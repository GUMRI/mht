import { Injectable, signal, computed, inject } from '@angular/core';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.config';
import { handleFirestoreError, OperationType } from '../firebase/firestore-error.handler';
import { AuthService } from '../auth/auth.service';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { UNIVERSAL_CHART_TEMPLATE } from '../accounting/chart-universal.data';
import {
  Business,
  Shop,
  Membership,
  BusinessDevice,
  UserNotification,
  Role,
  Account,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class BusinessService {
  private authService = inject(AuthService);
  private postingEngine = inject(PostingEngineService);

  private getCachedBusiness(): Business | null {
    try {
      const stored = localStorage.getItem('mh_current_business');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private getCachedShop(): Shop | null {
    try {
      const stored = localStorage.getItem('mh_active_shop');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  public currentBusiness = signal<Business | null>(this.getCachedBusiness());
  public shops = signal<Shop[]>([]);
  public activeShop = signal<Shop | null>(this.getCachedShop());
  public memberships = signal<Membership[]>([]);
  public businessDevices = signal<BusinessDevice[]>([]);
  public notifications = signal<UserNotification[]>([]);

  private listeningUserId = '';
  private isLoadingBiz = false;
  private lastLoadAttemptTime = 0;
  private activeLoadPromise: Promise<void> | null = null;
  private unsubNotifs: (() => void) | null = null;
  private unsubShops: (() => void) | null = null;
  private unsubMembers: (() => void) | null = null;
  private unsubDevices: (() => void) | null = null;

  public isOwner = computed(() => {
    const biz = this.currentBusiness();
    const uid = this.authService.firebaseUser()?.uid;
    return !!biz && biz.ownerId === uid;
  });

  public isManagerOrOwner = computed(() => {
    if (this.isOwner()) return true;
    const role = this.authService.effectiveRole();
    return role === 'owner' || role === 'general_manager';
  });

  public canAccessAccounting = computed(() => {
    if (this.isManagerOrOwner()) return true;
    const role = this.authService.effectiveRole();
    return role === 'accountant';
  });

  constructor() {
    setInterval(() => {
      const user = this.authService.firebaseUser();
      if (user && this.authService.isAuthReady()) {
        if (this.listeningUserId !== user.uid) {
          this.listenToNotifications(user.uid);
        }
        const now = Date.now();
        if (!this.currentBusiness() && !this.isLoadingBiz && now - this.lastLoadAttemptTime > 2500) {
          this.loadUserBusiness(user.uid);
        }
      }
    }, 1000);
  }

  public async ensureBusiness(): Promise<Business | null> {
    const current = this.currentBusiness();
    if (current) return current;
    const user = this.authService.firebaseUser();
    if (!user) return null;

    await this.loadUserBusiness(user.uid);
    if (this.currentBusiness()) return this.currentBusiness();

    // Auto-provision a starter business for the user so they are never blocked
    try {
      const displayName = user.displayName || user.email?.split('@')[0] || 'متجري';
      const newBiz = await this.createBusiness({
        name: `متجر ${displayName}`,
        businessType: 'retail',
        currency: 'TND',
        locale: 'ar-TN',
      });
      return newBiz;
    } catch (e) {
      console.warn('Auto-create default business fallback notice:', e);
      return this.currentBusiness();
    }
  }

  public async loadUserBusiness(uid: string): Promise<void> {
    if (this.activeLoadPromise) {
      return this.activeLoadPromise;
    }
    this.activeLoadPromise = this.internalLoadUserBusiness(uid);
    try {
      await this.activeLoadPromise;
    } finally {
      this.activeLoadPromise = null;
    }
  }

  private async internalLoadUserBusiness(uid: string): Promise<void> {
    this.isLoadingBiz = true;
    this.lastLoadAttemptTime = Date.now();
    try {
      // 1. Check if user owns a business
      const bizQuery = query(collection(db, 'businesses'), where('ownerId', '==', uid));
      const bizSnap = await getDocs(bizQuery);

      if (!bizSnap.empty) {
        const biz = { id: bizSnap.docs[0].id, ...bizSnap.docs[0].data() } as Business;
        this.setBusinessAndCache(biz);

        // Self-healing: ensure owner membership exists
        try {
          const memRef = doc(db, `businesses/${biz.id}/memberships`, uid);
          const memSnap = await getDoc(memRef);
          if (!memSnap.exists()) {
            const user = this.authService.firebaseUser();
            const ownerMember: Membership = {
              id: uid,
              businessId: biz.id,
              userId: uid,
              email: user?.email || '',
              displayName: user?.displayName || user?.email?.split('@')[0] || 'المالك',
              role: 'owner',
              shopIds: ['shop_main'],
              isActive: true,
              createdAt: new Date().toISOString(),
            };
            await setDoc(memRef, ownerMember);
            this.authService.setActiveMember(ownerMember);
          }
        } catch (e) {
          console.warn('Membership healing notice:', e);
        }

        // Self-healing: ensure default shop exists
        try {
          const shopsSnap = await getDocs(collection(db, `businesses/${biz.id}/shops`));
          if (shopsSnap.empty) {
            const mainShop: Shop = {
              id: 'shop_main',
              businessId: biz.id,
              name: 'المحل الرئيسي',
              type: (biz.businessType as any) || 'retail',
              address: 'المقر الرئيسي',
              isDefault: true,
              isActive: true,
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, `businesses/${biz.id}/shops`, 'shop_main'), mainShop);
            this.setShopAndCache(mainShop);
          }
        } catch (e) {
          console.warn('Shop healing notice:', e);
        }

        await this.loadBusinessSubcollections(biz.id);
        return;
      }

      // 2. Check if user is a member of any business via profile
      const profile = this.authService.currentUserProfile();
      if (profile?.defaultBusinessId) {
        const docRef = doc(db, 'businesses', profile.defaultBusinessId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const biz = { id: docSnap.id, ...docSnap.data() } as Business;
          this.setBusinessAndCache(biz);
          await this.loadBusinessSubcollections(biz.id);
          return;
        }
      }

      // 3. Fallback: Search collectionGroup('memberships') for businesses this user belongs to
      try {
        const memQuery = query(collectionGroup(db, 'memberships'), where('userId', '==', uid));
        const memSnap = await getDocs(memQuery);
        if (!memSnap.empty) {
          const firstMem = memSnap.docs[0].data() as Membership;
          if (firstMem.businessId) {
            const docRef = doc(db, 'businesses', firstMem.businessId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const biz = { id: docSnap.id, ...docSnap.data() } as Business;
              this.setBusinessAndCache(biz);
              await this.loadBusinessSubcollections(biz.id);
              return;
            }
          }
        }
      } catch (cgErr) {
        console.warn('CollectionGroup search notice:', cgErr);
      }

      // 4. Verify cached business still exists in Firestore if any
      const cached = this.currentBusiness();
      if (cached) {
        try {
          const checkDoc = await getDoc(doc(db, 'businesses', cached.id));
          if (!checkDoc.exists()) {
            this.setBusinessAndCache(null);
            this.setShopAndCache(null);
          }
        } catch {
          // keep cached if offline
        }
      }
    } catch (err) {
      console.warn('Could not load user business yet:', err);
    } finally {
      this.isLoadingBiz = false;
    }
  }

  public setBusinessAndCache(biz: Business | null): void {
    this.currentBusiness.set(biz);
    try {
      if (biz) {
        localStorage.setItem('mh_current_business', JSON.stringify(biz));
      } else {
        localStorage.removeItem('mh_current_business');
      }
    } catch {
      // ignore storage error
    }
  }

  public setShopAndCache(shop: Shop | null): void {
    this.activeShop.set(shop);
    try {
      if (shop) {
        localStorage.setItem('mh_active_shop', JSON.stringify(shop));
      } else {
        localStorage.removeItem('mh_active_shop');
      }
    } catch {
      // ignore storage error
    }
  }

  public async loadBusinessSubcollections(businessId: string): Promise<void> {
    if (this.unsubShops) { this.unsubShops(); }
    if (this.unsubMembers) { this.unsubMembers(); }
    if (this.unsubDevices) { this.unsubDevices(); }

    try {
      const shopsRef = collection(db, `businesses/${businessId}/shops`);
      this.unsubShops = onSnapshot(
        shopsRef,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shop));
          this.shops.set(list);
          if (list.length > 0 && !this.activeShop()) {
            const defaultShop = list.find((s) => s.isDefault) || list[0];
            this.activeShop.set(defaultShop);
          }
        },
        (err) => console.warn('Shops listener notice:', err.message)
      );

      const membersRef = collection(db, `businesses/${businessId}/memberships`);
      this.unsubMembers = onSnapshot(
        membersRef,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership));
          this.memberships.set(list);

          const uid = this.authService.firebaseUser()?.uid;
          if (uid && !this.authService.activeBusinessMember()) {
            const currentMember = list.find((m) => m.userId === uid);
            if (currentMember) {
              this.authService.setActiveMember(currentMember);
            }
          }
        },
        (err) => console.warn('Members listener notice:', err.message)
      );

      const devicesRef = collection(db, `businesses/${businessId}/devices`);
      this.unsubDevices = onSnapshot(
        devicesRef,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BusinessDevice));
          this.businessDevices.set(list);
        },
        (err) => console.warn('Devices listener notice:', err.message)
      );
    } catch (err) {
      console.error('Error setting subcollection listeners:', err);
    }
  }

  public listenToNotifications(userId: string): void {
    if (this.unsubNotifs) {
      this.unsubNotifs();
      this.unsubNotifs = null;
    }
    this.listeningUserId = userId;
    const notifsRef = collection(db, `users/${userId}/notifications`);
    this.unsubNotifs = onSnapshot(
      notifsRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserNotification));
        this.notifications.set(list);
      },
      (error) => {
        console.warn('Notifications snapshot notice:', error.message);
      }
    );
  }

  /**
   * Creates a business entity with its default shop and seeds the Universal Chart of Accounts.
   * If migrating, posts the opening balance journal entry atomically.
   */
  public async createBusiness(
    data: {
      name: string;
      legalName?: string;
      businessType: string;
      logo?: string;
      currency: string;
      locale: string;
    },
    openingBalances?: {
      cash: number;
      inventory: number;
      receivables: number;
      payables: number;
      equity: number;
    }
  ): Promise<Business> {
    const user = this.authService.firebaseUser();
    if (!user) throw new Error('Must be signed in to create business.');

    const businessId = 'biz_' + Date.now();
    const shopId = 'shop_main';

    const newBusiness: Business = {
      id: businessId,
      name: data.name,
      legalName: data.legalName || data.name,
      businessType: data.businessType,
      logo: data.logo || '',
      ownerId: user.uid,
      currency: data.currency || 'TND',
      locale: data.locale || 'TN',
      createdAt: new Date().toISOString(),
    };

    const bizDocRef = doc(db, 'businesses', businessId);

    // STEP 1: Create the parent Business document
    try {
      await setDoc(bizDocRef, newBusiness);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `businesses/${businessId}`);
    }

    // STEP 2: Create primary shop, owner membership, and update user doc in an initial batch
    const mainShop: Shop = {
      id: shopId,
      businessId,
      name: 'المحل الرئيسي',
      type: (data.businessType as any) || 'retail',
      address: 'المقر الرئيسي',
      isDefault: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const ownerMember: Membership = {
      id: user.uid,
      businessId,
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'المالك',
      role: 'owner',
      shopIds: [shopId],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const coreBatch = writeBatch(db);
    coreBatch.set(doc(db, `businesses/${businessId}/shops`, shopId), mainShop);
    coreBatch.set(doc(db, `businesses/${businessId}/memberships`, user.uid), ownerMember);
    coreBatch.set(
      doc(db, 'users', user.uid),
      {
        defaultBusinessId: businessId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    try {
      await coreBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businesses/${businessId}`);
    }

    // STEP 3: Seed Universal Chart of Accounts in chunks of 20 to comfortably stay within Firestore limits
    const accountsMap = new Map<string, Account>();
    const chunkSize = 20;

    for (let i = 0; i < UNIVERSAL_CHART_TEMPLATE.length; i += chunkSize) {
      const chunk = UNIVERSAL_CHART_TEMPLATE.slice(i, i + chunkSize);
      const accBatch = writeBatch(db);
      for (const seed of chunk) {
        const accountId = 'acc_' + seed.code;
        const account: Account = {
          id: accountId,
          businessId,
          code: seed.code,
          name_ar: seed.name_ar,
          name_en: seed.name_en,
          group: seed.group,
          parent: seed.parent,
          is_leaf: seed.is_leaf,
          is_system: seed.is_system,
          classification: seed.classification,
          balance: 0,
          displayName: seed.displayName,
          createdAt: new Date().toISOString(),
        };
        accountsMap.set(seed.code, account);
        accBatch.set(doc(db, `businesses/${businessId}/accounts`, accountId), account);
      }
      try {
        await accBatch.commit();
      } catch (err) {
        console.warn('Accounts chunk write notice:', err);
      }
    }

    // STEP 4: If migrating existing business with opening balances:
    if (
      openingBalances &&
      (openingBalances.cash > 0 ||
        openingBalances.inventory > 0 ||
        openingBalances.receivables > 0 ||
        openingBalances.payables > 0)
    ) {
      try {
        const openingEntry = this.postingEngine.buildOpeningBalancesEntry(
          businessId,
          shopId,
          openingBalances,
          accountsMap,
          user.uid
        );
        await setDoc(doc(db, `businesses/${businessId}/journal_entries`, openingEntry.id), openingEntry);
      } catch (err) {
        console.warn('Opening balance entry notice:', err);
      }
    }

    this.setBusinessAndCache(newBusiness);
    this.shops.set([mainShop]);
    this.setShopAndCache(mainShop);
    this.authService.setActiveMember(ownerMember);
    await this.loadBusinessSubcollections(businessId);
    return newBusiness;
  }

  public async addShop(shopData: { name: string; type: any; address?: string; phone?: string }): Promise<Shop> {
    let biz = this.currentBusiness();
    if (!biz) {
      biz = await this.ensureBusiness();
    }
    if (!biz) throw new Error('لا يوجد نشاط تجاري نشط حالياً.');

    const shopId = 'shop_' + Date.now();
    const newShop: Shop = {
      id: shopId,
      businessId: biz.id,
      name: shopData.name,
      type: shopData.type,
      address: shopData.address || '',
      phone: shopData.phone || '',
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, `businesses/${biz.id}/shops`, shopId), newShop);
      return newShop;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `businesses/${biz.id}/shops`);
    }
  }

  public async sendInvitation(
    targetEmail: string,
    targetUserId: string,
    role: Role,
    shopIds: string[] = []
  ): Promise<void> {
    const biz = this.currentBusiness();
    const user = this.authService.firebaseUser();
    if (!biz || !user) return;

    const notifId = 'inv_' + Date.now();
    const notification: UserNotification = {
      id: notifId,
      userId: targetUserId,
      type: 'invitation',
      title: `دعوة للانضمام إلى نشاط "${biz.name}"`,
      message: `قام ${user.displayName || user.email} بدعوتك للانضمام إلى ${biz.name} بدور (${role}).`,
      status: 'pending',
      businessId: biz.id,
      businessName: biz.name,
      inviterName: user.displayName || user.email || '',
      inviterEmail: user.email || '',
      role,
      shopIds,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      await setDoc(doc(db, `users/${targetUserId}/notifications`, notifId), notification);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${targetUserId}/notifications`);
    }
  }

  public async respondToInvitation(notif: UserNotification, accept: boolean): Promise<void> {
    const user = this.authService.firebaseUser();
    if (!user || notif.userId !== user.uid || !notif.businessId) return;

    try {
      if (accept) {
        const member: Membership = {
          id: user.uid,
          businessId: notif.businessId,
          userId: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'عضو جديد',
          role: notif.role || 'cashier',
          shopIds: notif.shopIds || [],
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, `businesses/${notif.businessId}/memberships`, user.uid), member);
        await setDoc(
          doc(db, 'users', user.uid),
          {
            defaultBusinessId: notif.businessId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        await this.loadUserBusiness(user.uid);
      }

      await updateDoc(doc(db, `users/${user.uid}/notifications`, notif.id), {
        status: accept ? 'accepted' : 'declined',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/notifications/${notif.id}`);
    }
  }

  public async updateMemberRole(memberId: string, newRole: Role, shopIds: string[]): Promise<void> {
    const biz = this.currentBusiness();
    if (!biz) return;
    try {
      await updateDoc(doc(db, `businesses/${biz.id}/memberships`, memberId), {
        role: newRole,
        shopIds,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${biz.id}/memberships/${memberId}`);
    }
  }

  public async transferOwnership(newOwnerUserId: string): Promise<void> {
    const biz = this.currentBusiness();
    const user = this.authService.firebaseUser();
    if (!biz || !user || biz.ownerId !== user.uid) return;

    const batch = writeBatch(db);
    batch.update(doc(db, 'businesses', biz.id), {
      ownerId: newOwnerUserId,
      updatedAt: new Date().toISOString(),
    });
    batch.update(doc(db, `businesses/${biz.id}/memberships`, user.uid), {
      role: 'general_manager',
    });
    batch.update(doc(db, `businesses/${biz.id}/memberships`, newOwnerUserId), {
      role: 'owner',
    });

    try {
      await batch.commit();
      this.currentBusiness.update((b) => (b ? { ...b, ownerId: newOwnerUserId } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${biz.id}`);
    }
  }

  public async registerBusinessDevice(shopId: string, deviceName: string): Promise<BusinessDevice> {
    const biz = this.currentBusiness();
    const user = this.authService.firebaseUser();
    if (!biz || !user) throw new Error('Must be signed in.');

    const deviceId = 'dev_' + Date.now();
    const device: BusinessDevice = {
      id: deviceId,
      businessId: biz.id,
      shopId,
      deviceName,
      isAuthorized: true,
      deviceToken: 'token_' + Math.random().toString(36).substring(2, 10),
      registeredBy: user.uid,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, `businesses/${biz.id}/devices`, deviceId), device);
      return device;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `businesses/${biz.id}/devices`);
    }
  }
}
