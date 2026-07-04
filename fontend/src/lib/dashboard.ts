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
