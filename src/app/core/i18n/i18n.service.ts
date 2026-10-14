import { Injectable, signal, computed } from '@angular/core';

export type SupportedLanguage = 'ar' | 'en';
export type SupportedLocale = 'TN' | 'SA' | 'EG' | 'AE' | 'QA' | 'KW' | 'OM' | 'MA' | 'DZ' | 'US' | 'FR';

export interface LocaleConfig {
  code: SupportedLocale;
  name: string;
  currencyCode: string;
  currencySymbolAr: string;
  currencySymbolEn: string;
  decimals: number;
}

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleConfig> = {
  TN: { code: 'TN', name: 'تونس (TN)', currencyCode: 'TND', currencySymbolAr: 'د.ت', currencySymbolEn: 'TND', decimals: 3 },
  SA: { code: 'SA', name: 'السعودية (SA)', currencyCode: 'SAR', currencySymbolAr: 'ر.س', currencySymbolEn: 'SAR', decimals: 2 },
  EG: { code: 'EG', name: 'مصر (EG)', currencyCode: 'EGP', currencySymbolAr: 'ج.م', currencySymbolEn: 'EGP', decimals: 2 },
  AE: { code: 'AE', name: 'الإمارات (AE)', currencyCode: 'AED', currencySymbolAr: 'د.إ', currencySymbolEn: 'AED', decimals: 2 },
  QA: { code: 'QA', name: 'قطر (QA)', currencyCode: 'QAR', currencySymbolAr: 'ر.ق', currencySymbolEn: 'QAR', decimals: 2 },
  KW: { code: 'KW', name: 'الكويت (KW)', currencyCode: 'KWD', currencySymbolAr: 'د.ك', currencySymbolEn: 'KWD', decimals: 3 },
  OM: { code: 'OM', name: 'عُمان (OM)', currencyCode: 'OMR', currencySymbolAr: 'ر.ع', currencySymbolEn: 'OMR', decimals: 3 },
  MA: { code: 'MA', name: 'المغرب (MA)', currencyCode: 'MAD', currencySymbolAr: 'د.م', currencySymbolEn: 'MAD', decimals: 2 },
  DZ: { code: 'DZ', name: 'الجزائر (DZ)', currencyCode: 'DZD', currencySymbolAr: 'د.ج', currencySymbolEn: 'DZD', decimals: 2 },
  US: { code: 'US', name: 'الولايات المتحدة (US)', currencyCode: 'USD', currencySymbolAr: '$', currencySymbolEn: '$', decimals: 2 },
  FR: { code: 'FR', name: 'فرنسا (FR)', currencyCode: 'EUR', currencySymbolAr: '€', currencySymbolEn: '€', decimals: 2 },
};

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  ar: {
    'app.name': 'محلات',
    'app.tagline': 'نظام إدارة الأعمال ونقاط البيع والمحاسبة',
    'nav.home': 'الرئيسية',
    'nav.pos': 'نقطة البيع',
    'nav.accounting': 'المحاسبة',
    'nav.settings': 'الإعدادات',
    'nav.business': 'إدارة النشاط',
    'nav.profile': 'الملف الشخصي',
    'nav.switch_user': 'تبديل المستخدم',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.search': 'بحث...',
    'common.add': 'إضافة',
    'common.confirm': 'تأكيد',
    'common.export_csv': 'تصدير CSV',
    'common.export_pdf': 'تصدير PDF',
    'common.total': 'المجموع',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.actions': 'الإجراءات',
    'common.filter': 'تصفية',
    'common.all': 'الكل',
    'common.currency': 'العملة',
    'common.language': 'اللغة',
    'common.locale': 'المنطقة والأرقام',
    'auth.sign_in': 'تسجيل الدخول',
    'auth.sign_in_google': 'الدخول عبر Google',
    'auth.sign_in_email': 'الدخول بالبريد الإلكتروني',
    'auth.sign_out': 'تسجيل الخروج',
    'auth.create_account': 'إنشاء حساب جديد',
    'auth.or': 'أو',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.name': 'الاسم الكامل',
    'auth.welcome': 'مرحباً بك في محلات',
    'auth.onboarding_choice': 'اختر طريقة البدء',
    'auth.create_business': 'إنشاء نشاط تجاري جديد',
    'auth.join_business': 'الانضمام عبر دعوة أو رمز QR',
    'biz.title': 'إدارة النشاط',
    'biz.overview': 'نظرة عامة',
    'biz.shops': 'المحلات والفروع',
    'biz.users': 'المستخدمون والصلاحيات',
    'biz.roles': 'الأدوار',
    'biz.devices': 'الأجهزة',
    'biz.settings': 'إعدادات النشاط',
    'biz.select_shop': 'المحل النشط',
    'biz.shop_type': 'نوع المحل',
    'biz.invite_user': 'دعوة مستخدم',
    'biz.transfer_ownership': 'نقل ملكية النشاط',
    'biz.my_devices': 'أجهزتي الشخصية',
    'biz.business_devices': 'أجهزة نقاط البيع بالمحل',
    'pos.new_order': 'طلب جديد',
    'pos.scan_barcode': 'امسح الباركود أو ابحث عن منتج...',
    'pos.cart_empty': 'السلة فارغة. ابدأ بإضافة المنتجات.',
    'pos.subtotal': 'المجموع الفرعي',
    'pos.discount': 'الخصم',
    'pos.grand_total': 'المبلغ الإجمالي',
    'pos.pay': 'الدفع',
    'pos.tab_pos': 'الطلب والمسح',
    'pos.tab_status': 'حالة التجهيز',
    'pos.hold_order': 'تعليق الطلب',
    'pos.completed_orders': 'الطلبات المكتملة بالوردية',
    'pos.shift_open': 'فتح وردية جديدة',
    'pos.shift_close': 'إغلاق الوردية والعد النقدي',
    'pos.no_open_shift': 'لا توجد وردية مفتوحة حالياً. يرجى فتح الوردية للبدء في البيع.',
    'accounting.title': 'وحدة المحاسبة العامة',
    'accounting.overview': 'الرئيسية المالية',
    'accounting.chart': 'شجرة الحسابات',
    'accounting.journals': 'قيود اليومية',
    'accounting.ledger': 'دفتر الأستاذ العام',
    'accounting.trial_balance': 'ميزان المراجعة',
    'accounting.income_statement': 'قائمة الدخل والأرباح',
    'accounting.balance_sheet': 'الميزانية العمومية',
  },
  en: {
    'app.name': 'Mahalat',
    'app.tagline': 'All-in-One POS, Business Management & Accounting',
    'nav.home': 'Home',
    'nav.pos': 'POS',
    'nav.accounting': 'Accounting',
    'nav.settings': 'Settings',
    'nav.business': 'Business Mgmt',
    'nav.profile': 'User Profile',
    'nav.switch_user': 'Switch User',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search...',
    'common.add': 'Add',
    'common.confirm': 'Confirm',
    'common.export_csv': 'Export CSV',
    'common.export_pdf': 'Export PDF',
    'common.total': 'Total',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.actions': 'Actions',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.currency': 'Currency',
    'common.language': 'Language',
    'common.locale': 'Locale & Numbers',
    'auth.sign_in': 'Sign In',
    'auth.sign_in_google': 'Sign in with Google',
    'auth.sign_in_email': 'Sign in with Email',
    'auth.sign_out': 'Sign Out',
    'auth.create_account': 'Create Account',
    'auth.or': 'Or',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Full Name',
    'auth.welcome': 'Welcome to Mahalat',
    'auth.onboarding_choice': 'Choose how to start',
    'auth.create_business': 'Create a new business',
    'auth.join_business': 'Join via invitation or QR',
    'biz.title': 'Business Management',
    'biz.overview': 'Overview',
    'biz.shops': 'Shops & Branches',
    'biz.users': 'Users & Permissions',
    'biz.roles': 'Roles',
    'biz.devices': 'Devices',
    'biz.settings': 'Business Settings',
    'biz.select_shop': 'Active Shop',
    'biz.shop_type': 'Shop Type',
    'biz.invite_user': 'Invite User',
    'biz.transfer_ownership': 'Transfer Ownership',
    'biz.my_devices': 'My Devices',
    'biz.business_devices': 'Business POS Terminals',
    'pos.new_order': 'New Order',
    'pos.scan_barcode': 'Scan barcode or search products...',
    'pos.cart_empty': 'Cart is empty. Scan or select products.',
    'pos.subtotal': 'Subtotal',
    'pos.discount': 'Discount',
    'pos.grand_total': 'Grand Total',
    'pos.pay': 'Pay',
    'pos.tab_pos': 'Order & Scan',
    'pos.tab_status': 'Preparation Status',
    'pos.hold_order': 'Hold Order',
    'pos.completed_orders': 'Completed Shift Orders',
    'pos.shift_open': 'Open Cashier Shift',
    'pos.shift_close': 'Close Shift & Count Cash',
    'pos.no_open_shift': 'No shift is currently open. Please open a shift to begin selling.',
    'accounting.title': 'Accounting Console',
    'accounting.overview': 'Financial Overview',
    'accounting.chart': 'Chart of Accounts',
    'accounting.journals': 'Journal Entries',
    'accounting.ledger': 'General Ledger',
    'accounting.trial_balance': 'Trial Balance',
    'accounting.income_statement': 'Income Statement',
    'accounting.balance_sheet': 'Balance Sheet',
  },
};

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  // Default language is 'ar', default locale is 'TN'
  public currentLang = signal<SupportedLanguage>('ar');
  public currentLocale = signal<SupportedLocale>('TN');

  public localeInfo = computed(() => {
    return SUPPORTED_LOCALES[this.currentLocale()] || SUPPORTED_LOCALES.TN;
  });

  public isRtl = computed(() => this.currentLang() === 'ar');

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const savedLang = localStorage.getItem('mahalat_lang') as SupportedLanguage;
      if (savedLang && (savedLang === 'ar' || savedLang === 'en')) {
        this.currentLang.set(savedLang);
      }
      const savedLocale = localStorage.getItem('mahalat_locale') as SupportedLocale;
      if (savedLocale && SUPPORTED_LOCALES[savedLocale]) {
        this.currentLocale.set(savedLocale);
      }
    }
  }

  public setLanguage(lang: SupportedLanguage): void {
    this.currentLang.set(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mahalat_lang', lang);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }

  public setLocale(locale: SupportedLocale): void {
    this.currentLocale.set(locale);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mahalat_locale', locale);
    }
  }

  public t(key: string): string {
    const lang = this.currentLang();
    const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.ar;
    return dictionary[key] || TRANSLATIONS.ar[key] || key;
  }

  public formatCurrency(amount: number): string {
    const loc = this.localeInfo();
    const formattedNum = new Intl.NumberFormat(
      this.currentLang() === 'ar' ? 'ar-TN' : 'en-US',
      {
        minimumFractionDigits: loc.decimals,
        maximumFractionDigits: loc.decimals,
      }
    ).format(amount || 0);

    const symbol = this.currentLang() === 'ar' ? loc.currencySymbolAr : loc.currencySymbolEn;
    return `${formattedNum} ${symbol}`;
  }

  public formatDate(dateStr: string | Date | undefined): string {
    if (!dateStr) return '';
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return new Intl.DateTimeFormat(this.currentLang() === 'ar' ? 'ar-TN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  public formatNumber(num: number, decimals = 2): string {
    return new Intl.NumberFormat(this.currentLang() === 'ar' ? 'ar-TN' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num || 0);
  }
}
