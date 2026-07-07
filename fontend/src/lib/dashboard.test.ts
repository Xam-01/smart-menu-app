import { describe, expect, it } from 'vitest';
import {
  buildCategoryRevenueChartData,
  buildOrderCountChartData,
  buildPaymentMethodChartData,
  buildPeakHourChartData,
  buildRevenueChartData,
  buildRevenueExportCsv,
  buildRevenueTableRows,
  enrichOrdersWithMenuCatalog,
  buildTablePerformanceChartData,
  buildTopDishesChartData,
  filterPaidOrdersByDateRange,
  getCheckoutTransitionPath,
  getDishRevenueBreakdown,
  getOwnerSummary,
  getStablePaymentToken,
  getTableHistory,
  groupOrdersByTable,
} from './dashboard';
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

  it('builds a completed table history from paid orders', () => {
    expect(getTableHistory(orders)).toEqual([
      {
        tableNumber: 1,
        orderCount: 1,
        revenue: 45000,
        latestClosedAt: '2026-06-28T08:05:00.000Z',
      },
    ]);
  });

  it('aggregates completed dish revenue for charts', () => {
    expect(getDishRevenueBreakdown(orders)).toEqual([
      {
        name: 'Nem',
        quantity: 1,
        revenue: 45000,
      },
    ]);
  });

  it('returns the backend-safe transition path when checking out a table', () => {
    expect(getCheckoutTransitionPath('pending')).toEqual([
      'confirmed',
      'preparing',
      'ready',
      'served',
      'completed',
    ]);
    expect(getCheckoutTransitionPath('served')).toEqual(['completed']);
    expect(getCheckoutTransitionPath('completed')).toEqual([]);
  });

  it('filters paid revenue orders by selected date range and ignores unpaid statuses', () => {
    const revenueOrders = [
      {
        id: 'paid-1',
        tableNumber: 1,
        items: [{ nameVi: 'Lau thai', category: 'Lau', price: 189000, quantity: 1 }],
        status: 'completed',
        totalPrice: 189000,
        createdAt: '2026-07-06T12:30:00.000Z',
        updatedAt: '2026-07-06T13:00:00.000Z',
      },
      {
        id: 'paid-2',
        tableNumber: 2,
        items: [{ nameVi: 'Bo My', category: 'Mon nhung', price: 89000, quantity: 2 }],
        status: 'paid',
        totalPrice: 178000,
        createdAt: '2026-07-01T11:00:00.000Z',
      },
      {
        id: 'pending-1',
        tableNumber: 3,
        items: [{ nameVi: 'Tra da', category: 'Do uong', price: 10000, quantity: 1 }],
        status: 'pending',
        totalPrice: 10000,
        createdAt: '2026-07-06T10:00:00.000Z',
      },
      {
        id: 'old-paid',
        tableNumber: 4,
        items: [{ nameVi: 'Kem', category: 'Trang mieng', price: 30000, quantity: 1 }],
        status: 'completed',
        totalPrice: 30000,
        createdAt: '2026-06-01T10:00:00.000Z',
      },
    ] as Order[];

    expect(
      filterPaidOrdersByDateRange(revenueOrders, '7d', new Date('2026-07-07T00:00:00.000Z')).map(
        (order) => order.id,
      ),
    ).toEqual(['paid-1', 'paid-2']);
  });

  it('builds revenue analytics datasets from paid orders only', () => {
    const revenueOrders = [
      {
        id: 'bill-1',
        tableNumber: 5,
        items: [
          { nameVi: 'Lau thai hai san', category: 'Lau', price: 189000, quantity: 1 },
          { nameVi: 'Bo My', category: 'Mon nhung', price: 89000, quantity: 2 },
        ],
        status: 'completed',
        totalPrice: 367000,
        paymentMethod: 'MoMo',
        paymentToken: 'PAY-202607-AB12',
        paidAt: '2026-07-06T12:30:00.000Z',
        createdAt: '2026-07-06T12:30:00.000Z',
        updatedAt: '2026-07-06T13:00:00.000Z',
      },
      {
        id: 'bill-2',
        tableNumber: 5,
        items: [{ nameVi: 'Nuoc suoi', category: 'Do uong', price: 10000, quantity: 2 }],
        status: 'completed',
        totalPrice: 20000,
        paymentMethod: 'Tien mat',
        createdAt: '2026-07-06T11:15:00.000Z',
      },
    ] as Order[];

    expect(buildRevenueChartData(revenueOrders, '7d')).toEqual([
      { label: '2026-07-06', value: 387000, detail: '2 đơn · TB 193.500 ₫' },
    ]);
    expect(buildOrderCountChartData(revenueOrders)).toEqual([
      { label: '2026-07-06', value: 2, detail: '2 đơn đã thanh toán' },
    ]);
    expect(buildTopDishesChartData(revenueOrders)[0]).toMatchObject({
      label: 'Bo My',
      value: 2,
      detail: '2 phần · 178.000 ₫',
    });
    expect(buildCategoryRevenueChartData(revenueOrders)).toEqual([
      { label: 'Lau', value: 189000, detail: '189.000 ₫ · 49%' },
      { label: 'Mon nhung', value: 178000, detail: '178.000 ₫ · 46%' },
      { label: 'Do uong', value: 20000, detail: '20.000 ₫ · 5%' },
    ]);
    expect(buildPaymentMethodChartData(revenueOrders)).toEqual([
      { label: 'MoMo', value: 367000, detail: '1 bill · 367.000 ₫ · 95%' },
      { label: 'Tien mat', value: 20000, detail: '1 bill · 20.000 ₫ · 5%' },
    ]);
    expect(buildTablePerformanceChartData(revenueOrders)).toEqual([
      { label: 'Bàn 5', value: 387000, detail: '2 bill · TB 193.500 ₫' },
    ]);
    expect(buildPeakHourChartData(revenueOrders)).toEqual([
      { label: '11:00 - 12:00', value: 20000, detail: '1 đơn · 20.000 ₫' },
      { label: '12:00 - 13:00', value: 367000, detail: '1 đơn · 367.000 ₫' },
    ]);
  });

  it('builds revenue table rows with stable payment tokens and exportable current rows', () => {
    const revenueOrders = [
      {
        id: 'bill-1',
        tableNumber: 5,
        items: [{ nameVi: 'Lau thai hai san', category: 'Lau', price: 189000, quantity: 1 }],
        status: 'completed',
        totalPrice: 189000,
        paymentMethod: 'MoMo',
        createdAt: '2026-07-06T12:30:00.000Z',
      },
    ] as Order[];
    const rows = buildRevenueTableRows(revenueOrders);

    expect(rows[0]).toMatchObject({
      billId: 'bill-1',
      paymentToken: getStablePaymentToken(revenueOrders[0]),
      tableName: 'Bàn 5',
      totalAmount: 189000,
      paymentMethod: 'MoMo',
      statusLabel: 'Đã thanh toán',
    });
    expect(buildRevenueExportCsv(rows)).toContain('Mã bill,Mã thanh toán,Bàn,Thời gian,Tổng tiền,Phương thức,Trạng thái');
    expect(buildRevenueExportCsv(rows)).toContain('bill-1');
  });

  it('fills bill item names and categories from the menu catalog when order snapshots are incomplete', () => {
    const revenueOrders = [
      {
        id: 'bill-1',
        tableNumber: 5,
        items: [{ menuItemId: 'item-1', nameVi: '1', price: 50000, quantity: 2 }],
        status: 'completed',
        totalPrice: 100000,
        createdAt: '2026-07-06T12:30:00.000Z',
      },
    ] as Order[];

    expect(enrichOrdersWithMenuCatalog(revenueOrders, items)[0].items[0]).toMatchObject({
      menuItemId: 'item-1',
      nameVi: 'Pho bo',
      category: items[0].category,
      price: 50000,
      quantity: 2,
    });
  });
});
