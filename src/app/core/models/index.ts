export type Role = 'owner' | 'general_manager' | 'shop_manager' | 'cashier' | 'accountant' | 'customer';

export type AccountClassification = 'current' | 'non_current' | null;

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  defaultBusinessId?: string;
  pinHash?: string;
  pinSalt?: string;
  passkeyRegistered?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'invitation' | 'system' | 'device_login_request';
  title: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'read';
  businessId?: string;
  businessName?: string;
  inviterName?: string;
  inviterEmail?: string;
  role?: Role;
  shopIds?: string[];
  createdAt: string;
  expiresAt?: string;
}

export interface BusinessDevice {
  id: string;
  businessId: string;
  shopId: string;
  deviceName: string;
  isAuthorized: boolean;
  deviceToken: string;
  lastLoginAt?: string;
  registeredBy: string;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  legalName?: string;
  businessType: string;
  logo?: string;
  ownerId: string;
  currency: string;
  locale: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Shop {
  id: string;
  businessId: string;
  name: string;
  type: 'retail' | 'restaurant' | 'services' | 'wholesale' | 'other';
  address?: string;
  phone?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Membership {
  id: string;
  businessId: string;
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  shopIds: string[]; // empty means all shops
  permissions?: string[];
  pinHash?: string;
  pinSalt?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Account {
  id: string;
  businessId: string;
  code: string;
  name_ar: string;
  name_en: string;
  group: number; // 1000, 2000, 3000, 4000, 5000
  parent: string;
  is_leaf: boolean;
  is_system: boolean;
  classification: AccountClassification;
  branch_id?: string;
  balance: number;
  displayName?: string; // Group - Subgroup - Detail
  createdAt: string;
}

export interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

export type AccountingEventType =
  | 'sale'
  | 'purchase'
  | 'sale_return'
  | 'purchase_return'
  | 'customer_payment'
  | 'supplier_payment'
  | 'expense'
  | 'stock_waste'
  | 'owner_drawing'
  | 'capital_injection'
  | 'cash_difference'
  | 'opening_balances'
  | 'reversal';

export interface JournalEntry {
  id: string;
  business_id: string;
  shop_id: string;
  branch_id?: string;
  entry_number: string;
  date: string;
  description: string;
  source_document_id?: string;
  shift_id?: string;
  event_type: AccountingEventType;
  debit_total: number;
  credit_total: number;
  lines: JournalLine[];
  is_reversed: boolean;
  reversal_entry_id?: string;
  createdAt: string;
  createdBy: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  barcode: string;
  type: 'physical' | 'service' | 'addon';
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  shopIds: string[];
  isActive: boolean;
  createdAt: string;
}

export type PartyRole = 'USER' | 'CUSTOMER' | 'SUPPLIER';

export interface CustomerProfile {
  creditLimit: number;
  currentDebt: number;
  taxId?: string;
}

export interface SupplierProfile {
  taxId?: string;
  companyName?: string;
  paymentTerms?: string;
}

export interface Party {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  roles: PartyRole[];
  balance: number; // positive = we owe them (payable), negative = they owe us (receivable)
  userProfile?: { userId: string };
  customerProfile?: CustomerProfile;
  supplierProfile?: SupplierProfile;
  createdAt: string;
}

export interface Shift {
  id: string;
  businessId: string;
  shopId: string;
  userId: string;
  userName: string;
  deviceId: string;
  status: 'open' | 'closed';
  openingCash: number;
  closingCashExpected?: number;
  closingCashActual?: number;
  difference?: number;
  openedAt: string;
  closedAt?: string;
  notes?: string;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  subtotal: number;
  discount: number;
  total: number;
  preparationDone?: boolean;
}

export interface InvoicePayment {
  method: 'cash' | 'card' | 'bank_transfer' | 'credit';
  amount: number;
  reference?: string;
}

export interface Invoice {
  id: string;
  businessId: string;
  shopId: string;
  shiftId: string;
  invoiceNumber: string;
  type: 'sale' | 'purchase' | 'sale_return' | 'purchase_return';
  partyId?: string;
  partyName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  payments: InvoicePayment[];
  status: 'draft' | 'completed' | 'cancelled';
  preparationStatus: 'received' | 'preparing' | 'ready' | 'delivered';
  journalEntryId?: string;
  createdAt: string;
  createdBy: string;
}

export interface Voucher {
  id: string;
  businessId: string;
  shopId: string;
  shiftId: string;
  voucherNumber: string;
  type: 'customer_receipt' | 'supplier_payment' | 'expense' | 'stock_waste' | 'cash_difference' | 'owner_drawing' | 'capital_injection';
  partyId?: string;
  partyName?: string;
  amount: number;
  reason: string;
  expenseCategory?: string;
  expenseAccountId?: string;
  journalEntryId?: string;
  createdAt: string;
  createdBy: string;
}

export interface PosOrderTab {
  id: string;
  orderNumber: number;
  title: string;
  items: InvoiceItem[];
  customer?: Party;
  discountPercent: number;
  notes?: string;
  activeSubView: 'pos' | 'status';
  createdAt: string;
  isHeld: boolean;
}
