import { Injectable, signal, computed } from '@angular/core';
import { PosOrderTab, InvoiceItem, Party } from '../models';

const IDB_NAME = 'mahalat_pos_db';
const IDB_STORE = 'open_orders';
const IDB_VERSION = 1;

@Injectable({
  providedIn: 'root',
})
export class PosOrdersService {
  // Array of open / held parallel orders
  public orders = signal<PosOrderTab[]>([]);

  // Currently active tab ID
  public activeOrderId = signal<string>('');

  // Counter for auto-incrementing order numbers: #101, #102, ...
  public nextOrderNumber = signal<number>(101);

  // Completed orders for the current shift (for the 📁 modal)
  public completedShiftOrders = signal<PosOrderTab[]>([]);

  // Active order computed
  public activeOrder = computed(() => {
    return this.orders().find((o) => o.id === this.activeOrderId()) || this.orders()[0] || null;
  });

  // Count of unfinished items on active order
  public activeUnfinishedCount = computed(() => {
    const order = this.activeOrder();
    if (!order) return 0;
    return order.items.filter((i) => !i.preparationDone).length;
  });

  constructor() {
    this.initFromStorage();
  }

  private async initFromStorage(): Promise<void> {
    try {
      const savedOrders = await this.loadFromIndexedDB();
      if (savedOrders && savedOrders.length > 0) {
        this.orders.set(savedOrders);
        this.activeOrderId.set(savedOrders[0].id);
        const maxNum = Math.max(...savedOrders.map((o) => o.orderNumber || 100));
        this.nextOrderNumber.set(maxNum + 1);
      } else {
        // Automatically create initial fresh order
        this.createNewOrder();
      }
    } catch {
      this.createNewOrder();
    }
  }

  /**
   * Generates a new parallel order tab and immediately selects it.
   */
  public createNewOrder(): PosOrderTab {
    const num = this.nextOrderNumber();
    this.nextOrderNumber.update((n) => n + 1);

    const newTab: PosOrderTab = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      orderNumber: num,
      title: `#${num} • طلب جديد`,
      items: [],
      discountPercent: 0,
      activeSubView: 'pos',
      createdAt: new Date().toISOString(),
      isHeld: false,
    };

    this.orders.update((list) => [...list, newTab]);
    this.activeOrderId.set(newTab.id);
    this.persistToIndexedDB();
    return newTab;
  }

  public selectOrder(orderId: string): void {
    this.activeOrderId.set(orderId);
  }

  public closeOrderTab(orderId: string): void {
    const remaining = this.orders().filter((o) => o.id !== orderId);
    if (remaining.length === 0) {
      this.orders.set([]);
      this.createNewOrder();
    } else {
      this.orders.set(remaining);
      if (this.activeOrderId() === orderId) {
        this.activeOrderId.set(remaining[0].id);
      }
    }
    this.persistToIndexedDB();
  }

  public addItemToActiveOrder(product: {
    id: string;
    name: string;
    barcode?: string;
    sellingPrice: number;
    costPrice: number;
  }): void {
    const current = this.activeOrder();
    if (!current) return;

    const existingIndex = current.items.findIndex((i) => i.productId === product.id);
    let updatedItems: InvoiceItem[];

    if (existingIndex > -1) {
      updatedItems = current.items.map((item, idx) => {
        if (idx === existingIndex) {
          const qty = item.quantity + 1;
          const subtotal = Number((qty * item.unitPrice).toFixed(4));
          const total = Number((subtotal - item.discount).toFixed(4));
          return { ...item, quantity: qty, subtotal, total };
        }
        return item;
      });
    } else {
      const newItem: InvoiceItem = {
        productId: product.id,
        name: product.name,
        barcode: product.barcode || '',
        quantity: 1,
        unitPrice: Number(product.sellingPrice || 0),
        costPrice: Number(product.costPrice || 0),
        subtotal: Number(product.sellingPrice || 0),
        discount: 0,
        total: Number(product.sellingPrice || 0),
        preparationDone: false,
      };
      updatedItems = [...current.items, newItem];
    }

    this.updateOrder(current.id, {
      items: updatedItems,
      title: this.computeOrderTitle(current.orderNumber, current.customer, updatedItems),
    });
  }

  public updateItemQuantity(productId: string, delta: number): void {
    const current = this.activeOrder();
    if (!current) return;

    const updatedItems = current.items
      .map((item) => {
        if (item.productId === productId) {
          const qty = Math.max(0, item.quantity + delta);
          const subtotal = Number((qty * item.unitPrice).toFixed(4));
          const total = Number((subtotal - item.discount).toFixed(4));
          return { ...item, quantity: qty, subtotal, total };
        }
        return item;
      })
      .filter((i) => i.quantity > 0);

    this.updateOrder(current.id, {
      items: updatedItems,
      title: this.computeOrderTitle(current.orderNumber, current.customer, updatedItems),
    });
  }

  public removeItem(productId: string): void {
    const current = this.activeOrder();
    if (!current) return;
    const updated = current.items.filter((i) => i.productId !== productId);
    this.updateOrder(current.id, {
      items: updated,
      title: this.computeOrderTitle(current.orderNumber, current.customer, updated),
    });
  }

  public setCustomer(customer: Party | undefined): void {
    const current = this.activeOrder();
    if (!current) return;
    this.updateOrder(current.id, {
      customer,
      title: this.computeOrderTitle(current.orderNumber, customer, current.items),
    });
  }

  public setDiscount(discountPercent: number): void {
    const current = this.activeOrder();
    if (!current) return;
    this.updateOrder(current.id, { discountPercent });
  }

  public toggleItemPreparation(productId: string): void {
    const current = this.activeOrder();
    if (!current) return;
    const updatedItems = current.items.map((i) =>
      i.productId === productId ? { ...i, preparationDone: !i.preparationDone } : i
    );
    this.updateOrder(current.id, { items: updatedItems });
  }

  public setSubView(subView: 'pos' | 'status'): void {
    const current = this.activeOrder();
    if (!current) return;
    this.updateOrder(current.id, { activeSubView: subView });
  }

  /**
   * Called right after order is completed:
   * Moves it to completed shift orders and opens a new empty order tab automatically.
   */
  public completeOrder(orderId: string): void {
    const completed = this.orders().find((o) => o.id === orderId);
    if (completed) {
      this.completedShiftOrders.update((list) => [completed, ...list]);
    }
    this.closeOrderTab(orderId);
  }

  private updateOrder(orderId: string, partial: Partial<PosOrderTab>): void {
    this.orders.update((list) =>
      list.map((o) => (o.id === orderId ? { ...o, ...partial } : o))
    );
    this.persistToIndexedDB();
  }

  /**
   * Tab title logic:
   * `#number • customer name`; else `#number • first product keywords`; default `#101 • طلب جديد`
   */
  private computeOrderTitle(num: number, customer?: Party, items: InvoiceItem[] = []): string {
    if (customer && customer.name) {
      return `#${num} • ${customer.name}`;
    }
    if (items.length > 0 && items[0].name) {
      const words = items[0].name.split(' ').slice(0, 2).join(' ');
      return `#${num} • ${words}`;
    }
    return `#${num} • طلب جديد`;
  }

  // Local-first IndexedDB persistence
  private async persistToIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
      const db = await this.openIDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      await store.clear();
      for (const order of this.orders()) {
        store.put(order);
      }
    } catch {
      // Fallback
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mahalat_open_orders', JSON.stringify(this.orders()));
      }
    }
  }

  private async loadFromIndexedDB(): Promise<PosOrderTab[]> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('mahalat_open_orders');
        return raw ? JSON.parse(raw) : [];
      }
      return [];
    }

    try {
      const db = await this.openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  private openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
