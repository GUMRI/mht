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
import { Product } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private businessService = inject(BusinessService);

  public products = signal<Product[]>([]);
  public isLoading = signal<boolean>(false);

  public lowStockProducts = computed(() => {
    return this.products().filter(
      (p) => p.type === 'physical' && p.stock <= (p.minStock || 5) && p.isActive
    );
  });

  private loadedBusinessId = '';
  private unsubProducts: (() => void) | null = null;

  constructor() {
    setInterval(() => {
      const biz = this.businessService.currentBusiness();
      if (biz && this.loadedBusinessId !== biz.id) {
        this.loadProducts(biz.id);
      }
    }, 1500);
  }

  public loadProducts(businessId: string): void {
    this.loadedBusinessId = businessId;
    this.isLoading.set(true);

    if (this.unsubProducts) {
      this.unsubProducts();
    }

    const prodRef = collection(db, `businesses/${businessId}/products`);
    this.unsubProducts = onSnapshot(
      prodRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        list.sort((a, b) => a.name.localeCompare(b.name));
        this.products.set(list);
        this.isLoading.set(false);
      },
      (err) => {
        console.warn('Products snapshot notice:', err.message);
        this.isLoading.set(false);
      }
    );
  }

  public async saveProduct(productData: Partial<Product>): Promise<Product> {
    let biz = this.businessService.currentBusiness();
    if (!biz) {
      biz = await this.businessService.ensureBusiness();
    }
    if (!biz) {
      throw new Error('لا يوجد نشاط تجاري نشط حالياً. يرجى إنشاء نشاط تجاري أو الانضمام لنشاط أولاً.');
    }

    const productId = productData.id || 'prod_' + Date.now();
    const isNew = !productData.id;

    const product: Product = {
      id: productId,
      businessId: biz.id,
      name: productData.name || '',
      barcode: productData.barcode || '',
      type: productData.type || 'physical',
      category: productData.category || 'عام',
      unit: productData.unit || 'قطعة',
      costPrice: Number(productData.costPrice || 0),
      sellingPrice: Number(productData.sellingPrice || 0),
      stock: Number(productData.stock || 0),
      minStock: Number(productData.minStock || 5),
      shopIds: productData.shopIds || [],
      isActive: productData.isActive !== false,
      createdAt: productData.createdAt || new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, `businesses/${biz.id}/products`, productId), product);
      return product;
    } catch (err) {
      handleFirestoreError(
        err,
        isNew ? OperationType.CREATE : OperationType.UPDATE,
        `businesses/${biz.id}/products/${productId}`
      );
    }
  }

  public async updateStock(productId: string, quantityDelta: number): Promise<void> {
    const biz = this.businessService.currentBusiness();
    if (!biz) return;
    const current = this.products().find((p) => p.id === productId);
    if (!current || current.type !== 'physical') return;

    const newStock = Math.max(0, current.stock + quantityDelta);
    try {
      await updateDoc(doc(db, `businesses/${biz.id}/products`, productId), {
        stock: newStock,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${biz.id}/products/${productId}`);
    }
  }

  public findByBarcode(barcode: string): Product | undefined {
    const trimmed = barcode.trim();
    if (!trimmed) return undefined;
    return this.products().find((p) => p.barcode === trimmed && p.isActive);
  }
}
