import type { Order, OrderStatus, OwnerMenuItem, Restaurant } from './types';

const CLOSED_ORDER_STATUSES = new Set(['completed', 'cancelled']);
const CHECKOUT_STATUS_PATH: OrderStatus[] = [
  'confirmed',
  'preparing',
  'ready',
  'served',
  'completed',
];

export type OwnerSummary = {
  activeTables: number;
  openOrders: number;
  pendingOrders: number;
  allergyOrders: number;
  unavailableItems: number;
  menuItems: number;
  openRevenue: number;
};

export type TableOrderGroup = {
  tableNumber: number;
  orders: Order[];
  openTotal: number;
};

export type TableHistoryEntry = {
  tableNumber: number;
  orderCount: number;
  revenue: number;
  latestClosedAt: string;
};

export type DishRevenueEntry = {
  name: string;
  quantity: number;
  revenue: number;
};

export type MonthlyRevenueEntry = {
  month: string;
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
};

export type RevenueDateRange = 'today' | '7d' | '30d' | 'month';

export type RevenueChartDataPoint = {
  label: string;
  value: number;
  detail: string;
};

export type RevenueTableRow = {
  billId: string;
  paymentToken: string;
  tableName: string;
  paidAt: string;
  totalAmount: number;
  paymentMethod: string;
  statusLabel: string;
  order: Order;
};

export function getOwnerSummary({
  restaurant,
  items,
  orders,
}: {
  restaurant: Restaurant | null;
  items: OwnerMenuItem[];
  orders: Order[];
}): OwnerSummary {
  const openOrders = orders.filter((order) => !CLOSED_ORDER_STATUSES.has(order.status));

  return {
    activeTables: restaurant?.tables.filter((table) => table.isActive).length ?? 0,
    openOrders: openOrders.length,
    pendingOrders: orders.filter((order) => order.status === 'pending').length,
    allergyOrders: orders.filter((order) => Boolean(order.allergyNotes)).length,
    unavailableItems: items.filter((item) => item.status !== 'available').length,
    menuItems: items.length,
    openRevenue: openOrders.reduce((sum, order) => sum + order.totalPrice, 0),
  };
}

export function groupOrdersByTable(orders: Order[]): TableOrderGroup[] {
  const groups = new Map<number, Order[]>();

  for (const order of orders) {
    const current = groups.get(order.tableNumber) ?? [];
    current.push(order);
    groups.set(order.tableNumber, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([tableNumber, tableOrders]) => ({
      tableNumber,
      orders: tableOrders,
      openTotal: tableOrders
        .filter((order) => !CLOSED_ORDER_STATUSES.has(order.status))
        .reduce((sum, order) => sum + order.totalPrice, 0),
    }));
}

export function isClosedOrderStatus(status: OrderStatus): boolean {
  return CLOSED_ORDER_STATUSES.has(status);
}

export function getCheckoutTransitionPath(status: OrderStatus): OrderStatus[] {
  if (status === 'cancelled' || status === 'completed') return [];
  const startIndex = CHECKOUT_STATUS_PATH.indexOf(status);
  return startIndex === -1 ? CHECKOUT_STATUS_PATH : CHECKOUT_STATUS_PATH.slice(startIndex + 1);
}

export function getTableHistory(orders: Order[]): TableHistoryEntry[] {
  const groups = new Map<number, TableHistoryEntry>();

  for (const order of orders) {
    if (order.status !== 'completed') continue;
    const closedAt = order.updatedAt ?? order.createdAt;
    const current = groups.get(order.tableNumber);
    groups.set(order.tableNumber, {
      tableNumber: order.tableNumber,
      orderCount: (current?.orderCount ?? 0) + 1,
      revenue: (current?.revenue ?? 0) + order.totalPrice,
      latestClosedAt:
        !current || closedAt > current.latestClosedAt ? closedAt : current.latestClosedAt,
    });
  }

  return Array.from(groups.values()).sort((left, right) =>
    right.latestClosedAt.localeCompare(left.latestClosedAt),
  );
}

export function getDishRevenueBreakdown(orders: Order[]): DishRevenueEntry[] {
  const revenueByDish = new Map<string, DishRevenueEntry>();

  for (const order of orders) {
    if (order.status !== 'completed') continue;
    for (const item of order.items) {
      const name = item.nameVi || item.name || 'Món chưa đặt tên';
      const current = revenueByDish.get(name) ?? { name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.price * item.quantity;
      revenueByDish.set(name, current);
    }
  }

  return Array.from(revenueByDish.values()).sort((left, right) => right.revenue - left.revenue);
}

export function getMonthlyRevenueReport(orders: Order[]): MonthlyRevenueEntry[] {
  const monthly = new Map<string, { orderCount: number; revenue: number }>();

  for (const order of orders) {
    if (order.status !== 'completed') continue;
    const month = order.createdAt.slice(0, 7);
    const current = monthly.get(month) ?? { orderCount: 0, revenue: 0 };
    current.orderCount += 1;
    current.revenue += order.totalPrice;
    monthly.set(month, current);
  }

  return Array.from(monthly.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, value]) => ({
      month,
      orderCount: value.orderCount,
      revenue: value.revenue,
      averageOrderValue: value.orderCount === 0 ? 0 : Math.round(value.revenue / value.orderCount),
    }));
}

export function filterPaidOrdersByDateRange(
  orders: Order[],
  range: RevenueDateRange,
  now = resolveRevenueNow(orders),
): Order[] {
  const paidOrders = orders.filter(isPaidRevenueOrder);
  const { start, end } = getDateRangeWindow(range, now);

  return paidOrders
    .filter((order) => {
      const paidAt = new Date(getOrderPaidAt(order));
      return paidAt >= start && paidAt <= end;
    })
    .sort((left, right) => getOrderPaidAt(right).localeCompare(getOrderPaidAt(left)));
}

export function buildRevenueChartData(orders: Order[], range: RevenueDateRange): RevenueChartDataPoint[] {
  const groups = new Map<string, { revenue: number; orderCount: number }>();

  for (const order of orders.filter(isPaidRevenueOrder)) {
    const key = range === 'month' ? getOrderPaidAt(order).slice(0, 7) : getOrderPaidAt(order).slice(0, 10);
    const current = groups.get(key) ?? { revenue: 0, orderCount: 0 };
    current.revenue += order.totalPrice;
    current.orderCount += 1;
    groups.set(key, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({
      label,
      value: value.revenue,
      detail: `${value.orderCount} đơn · TB ${formatCurrencyVND(Math.round(value.revenue / value.orderCount))}`,
    }));
}

export function buildOrderCountChartData(orders: Order[]): RevenueChartDataPoint[] {
  const groups = groupRevenueOrders(orders, (order) => getOrderPaidAt(order).slice(0, 10));

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, dateOrders]) => ({
      label,
      value: dateOrders.length,
      detail: `${dateOrders.length} đơn đã thanh toán`,
    }));
}

export function buildTopDishesChartData(orders: Order[]): RevenueChartDataPoint[] {
  const groups = new Map<string, { quantity: number; revenue: number }>();

  for (const order of orders.filter(isPaidRevenueOrder)) {
    for (const item of order.items) {
      const name = item.nameVi || item.name || 'Món chưa đặt tên';
      const current = groups.get(name) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.price * item.quantity;
      groups.set(name, current);
    }
  }

  return Array.from(groups.entries())
    .sort(([, left], [, right]) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value: value.quantity,
      detail: `${value.quantity} phần · ${formatCurrencyVND(value.revenue)}`,
    }));
}

export function buildCategoryRevenueChartData(orders: Order[]): RevenueChartDataPoint[] {
  const groups = new Map<string, number>();
  let total = 0;

  for (const order of orders.filter(isPaidRevenueOrder)) {
    for (const item of order.items) {
      const revenue = item.price * item.quantity;
      const category = item.category || 'Khác';
      groups.set(category, (groups.get(category) ?? 0) + revenue);
      total += revenue;
    }
  }

  return Array.from(groups.entries())
    .sort(([, left], [, right]) => right - left)
    .map(([label, value]) => ({
      label,
      value,
      detail: `${formatCurrencyVND(value)} · ${formatPercent(value, total)}`,
    }));
}

export function buildPaymentMethodChartData(orders: Order[]): RevenueChartDataPoint[] {
  const groups = new Map<string, { billCount: number; revenue: number }>();
  const total = orders.filter(isPaidRevenueOrder).reduce((sum, order) => sum + order.totalPrice, 0);

  for (const order of orders.filter(isPaidRevenueOrder)) {
    const method = order.paymentMethod || 'Tiền mặt';
    const current = groups.get(method) ?? { billCount: 0, revenue: 0 };
    current.billCount += 1;
    current.revenue += order.totalPrice;
    groups.set(method, current);
  }

  return Array.from(groups.entries())
    .sort(([, left], [, right]) => right.revenue - left.revenue)
    .map(([label, value]) => ({
      label,
      value: value.revenue,
      detail: `${value.billCount} bill · ${formatCurrencyVND(value.revenue)} · ${formatPercent(value.revenue, total)}`,
    }));
}

export function buildTablePerformanceChartData(orders: Order[]): RevenueChartDataPoint[] {
  const groups = new Map<number, { billCount: number; revenue: number }>();

  for (const order of orders.filter(isPaidRevenueOrder)) {
    const current = groups.get(order.tableNumber) ?? { billCount: 0, revenue: 0 };
    current.billCount += 1;
    current.revenue += order.totalPrice;
    groups.set(order.tableNumber, current);
  }

  return Array.from(groups.entries())
    .sort(([, left], [, right]) => right.revenue - left.revenue)
    .map(([tableNumber, value]) => ({
      label: `Bàn ${tableNumber}`,
      value: value.revenue,
      detail: `${value.billCount} bill · TB ${formatCurrencyVND(Math.round(value.revenue / value.billCount))}`,
    }));
}

export function buildPeakHourChartData(orders: Order[]): RevenueChartDataPoint[] {
  const groups = new Map<number, { orderCount: number; revenue: number }>();

  for (const order of orders.filter(isPaidRevenueOrder)) {
    const hour = getHourFromTimestamp(getOrderPaidAt(order));
    const current = groups.get(hour) ?? { orderCount: 0, revenue: 0 };
    current.orderCount += 1;
    current.revenue += order.totalPrice;
    groups.set(hour, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([hour, value]) => ({
      label: `${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`,
      value: value.revenue,
      detail: `${value.orderCount} đơn · ${formatCurrencyVND(value.revenue)}`,
    }));
}

export function buildRevenueTableRows(orders: Order[]): RevenueTableRow[] {
  return orders
    .filter(isPaidRevenueOrder)
    .sort((left, right) => getOrderPaidAt(right).localeCompare(getOrderPaidAt(left)))
    .map((order) => ({
      billId: order.billId || order.id,
      paymentToken: getStablePaymentToken(order),
      tableName: `Bàn ${order.tableNumber}`,
      paidAt: getOrderPaidAt(order),
      totalAmount: order.totalPrice,
      paymentMethod: order.paymentMethod || 'Tiền mặt',
      statusLabel: 'Đã thanh toán',
      order,
    }));
}

export function enrichOrdersWithMenuCatalog(orders: Order[], items: OwnerMenuItem[]): Order[] {
  if (items.length === 0) return orders;

  const itemsById = new Map(items.map((item) => [item.id, item]));

  return orders.map((order) => ({
    ...order,
    items: order.items.map((orderItem) => {
      const catalogItem = orderItem.menuItemId ? itemsById.get(String(orderItem.menuItemId)) : undefined;
      if (!catalogItem) return orderItem;

      const snapshotName = orderItem.nameVi || orderItem.name || '';
      const shouldUseCatalogName =
        snapshotName.trim().length === 0 ||
        snapshotName === orderItem.menuItemId ||
        /^\d+$/.test(snapshotName.trim());

      return {
        ...orderItem,
        nameVi: shouldUseCatalogName ? catalogItem.nameVi : orderItem.nameVi,
        name: shouldUseCatalogName ? catalogItem.nameVi : orderItem.name,
        category: orderItem.category || catalogItem.category,
      };
    }),
  }));
}

export function buildRevenueExportCsv(rows: RevenueTableRow[]): string {
  const csvRows = [
    ['Mã bill', 'Mã thanh toán', 'Bàn', 'Thời gian', 'Tổng tiền', 'Phương thức', 'Trạng thái'],
    ...rows.map((row) => [
      row.billId,
      row.paymentToken,
      row.tableName,
      row.paidAt,
      String(row.totalAmount),
      row.paymentMethod,
      row.statusLabel,
    ]),
  ];

  return csvRows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function getStablePaymentToken(order: Order): string {
  if (order.paymentToken) return order.paymentToken;
  const billId = order.billId || order.id;
  const datePart = getOrderPaidAt(order).slice(0, 7).replace('-', '');
  const suffix = Array.from(billId)
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
    .toString(36)
    .toUpperCase()
    .slice(-4)
    .padStart(4, '0');

  return `PAY-${datePart}-${suffix}`;
}

export function formatCurrencyVND(value: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)} ₫`;
}

export function buildMonthlyRevenueCsv(report: MonthlyRevenueEntry[]): string {
  const rows = [
    ['Tháng', 'Số đơn', 'Doanh thu', 'Giá trị TB/đơn'],
    ...report.map((entry) => [
      entry.month,
      String(entry.orderCount),
      String(entry.revenue),
      String(entry.averageOrderValue),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

function isPaidRevenueOrder(order: Order): boolean {
  const normalizedStatus = String(order.status).trim().toLowerCase();
  return ['paid', 'completed', 'đã thanh toán', 'da thanh toan', 'hoàn tất', 'hoan tat'].includes(normalizedStatus);
}

function getOrderPaidAt(order: Order): string {
  return order.paidAt || order.updatedAt || order.createdAt;
}

function getHourFromTimestamp(value: string): number {
  const match = value.match(/T(\d{2}):/);
  return match ? Number(match[1]) : new Date(value).getHours();
}

function resolveRevenueNow(orders: Order[]): Date {
  const latestPaidAt = orders
    .filter(isPaidRevenueOrder)
    .map(getOrderPaidAt)
    .sort((left, right) => right.localeCompare(left))[0];

  return latestPaidAt ? new Date(latestPaidAt) : new Date();
}

function getDateRangeWindow(range: RevenueDateRange, now: Date) {
  const end = endOfDay(now);
  const start = startOfDay(now);

  if (range === 'today') {
    return { start, end };
  }

  if (range === '7d') {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  if (range === '30d') {
    start.setDate(start.getDate() - 29);
    return { start, end };
  }

  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end,
  };
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function groupRevenueOrders(orders: Order[], getKey: (order: Order) => string) {
  const groups = new Map<string, Order[]>();

  for (const order of orders.filter(isPaidRevenueOrder)) {
    const key = getKey(order);
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  return groups;
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
