import { describe, it, expect, beforeEach } from 'vitest';
import { PosOrdersService } from './pos-orders.service';

describe('PosOrdersService', () => {
  let service: PosOrdersService;

  beforeEach(() => {
    service = new PosOrdersService();
  });

  it('automatically opens an empty order on creation', () => {
    expect(service.orders().length).toBeGreaterThanOrEqual(1);
    expect(service.activeOrder()).toBeDefined();
    expect(service.activeOrder()?.title).toContain('طلب جديد');
  });

  it('updates tab title when items are added (#number • product keywords)', () => {
    const order = service.activeOrder()!;
    service.addItemToActiveOrder({
      id: 'p1',
      name: 'Croissant Butter Fresh',
      sellingPrice: 3.5,
      costPrice: 1.5,
    });

    const updated = service.activeOrder()!;
    expect(updated.title).toBe(`#${order.orderNumber} • Croissant Butter`);
  });

  it('updates tab title when customer is assigned (#number • customer name)', () => {
    const order = service.activeOrder()!;
    service.setCustomer({
      id: 'c1',
      businessId: 'biz_1',
      name: 'فاطمة بن علي',
      roles: ['CUSTOMER'],
      balance: 0,
      createdAt: new Date().toISOString(),
    });

    const updated = service.activeOrder()!;
    expect(updated.title).toBe(`#${order.orderNumber} • فاطمة بن علي`);
  });

  it('creates new parallel orders as separate tabs', () => {
    const initialCount = service.orders().length;
    const secondOrder = service.createNewOrder();
    expect(service.orders().length).toBe(initialCount + 1);
    expect(service.activeOrderId()).toBe(secondOrder.id);
  });

  it('moves completed order to archive and opens a fresh empty order immediately', () => {
    const active = service.activeOrder()!;
    service.addItemToActiveOrder({
      id: 'p1',
      name: 'Espresso',
      sellingPrice: 2,
      costPrice: 0.5,
    });

    service.completeOrder(active.id);

    expect(service.completedShiftOrders().length).toBe(1);
    expect(service.completedShiftOrders()[0].id).toBe(active.id);

    // Cashier immediately has a new empty order ready to scan
    expect(service.orders().length).toBeGreaterThanOrEqual(1);
    expect(service.activeOrder()?.id).not.toBe(active.id);
    expect(service.activeOrder()?.items.length).toBe(0);
  });
});
