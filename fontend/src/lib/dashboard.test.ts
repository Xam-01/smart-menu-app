import { describe, expect, it } from 'vitest';
import { getOwnerSummary, groupOrdersByTable } from './dashboard';
import type { Order, OwnerMenuItem, Restaurant } from './types';

const restaurant: Restaurant = {
  id: 'restaurant-1',
  name: 'Pho House',
  address: '1 Nguyen Trai',
  tableCount: 4,
  status: 'active',
  tables: [
    { tableNumber: 1, qrCode: 'one', isActive: true },
    { tableNumber: 2, qrCode: 'two', isActive: false },
    { tableNumber: 3, qrCode: 'three', isActive: true },
    { tableNumber: 4, qrCode: 'four', isActive: true },
  ],
};

const items: OwnerMenuItem[] = [
  {
    id: 'item-1',
    nameVi: 'Pho bo',
    price: 65000,
    category: 'Món chính',
    status: 'available',
    allergenTags: [],
    allergenVerified: true,
  },
  {
    id: 'item-2',
    nameVi: 'Nem',
    price: 45000,
    category: 'Khai vị',
    status: 'sold_out',
    allergenTags: [],
    allergenVerified: false,
  },
];

const orders: Order[] = [
  {
    id: 'order-1',
    tableNumber: 1,
    items: [{ nameVi: 'Pho bo', price: 65000, quantity: 2 }],
    status: 'pending',
    totalPrice: 130000,
    allergyNotes: 'Khach di ung: milk',
    createdAt: '2026-06-28T08:00:00.000Z',
  },
  {
    id: 'order-2',
    tableNumber: 1,
    items: [{ nameVi: 'Nem', price: 45000, quantity: 1 }],
    status: 'completed',
    totalPrice: 45000,
    createdAt: '2026-06-28T08:05:00.000Z',
  },
  {
    id: 'order-3',
    tableNumber: 3,
    items: [{ nameVi: 'Tra da', price: 10000, quantity: 3 }],
    status: 'ready',
    totalPrice: 30000,
    createdAt: '2026-06-28T08:10:00.000Z',
  },
];

describe('dashboard helpers', () => {
  it('summarizes owner operations from restaurant, menu items, and orders', () => {
    expect(getOwnerSummary({ restaurant, items, orders })).toEqual({
      activeTables: 3,
      openOrders: 2,
      pendingOrders: 1,
      allergyOrders: 1,
      unavailableItems: 1,
      menuItems: 2,
      openRevenue: 160000,
    });
  });

  it('groups orders by table without including completed orders first', () => {
    expect(groupOrdersByTable(orders).map((group) => ({
      tableNumber: group.tableNumber,
      orderIds: group.orders.map((order) => order.id),
      openTotal: group.openTotal,
    }))).toEqual([
      { tableNumber: 1, orderIds: ['order-1', 'order-2'], openTotal: 130000 },
      { tableNumber: 3, orderIds: ['order-3'], openTotal: 30000 },
    ]);
  });
});
