import type { Order, OwnerMenuItem, Restaurant } from './types';

const CLOSED_ORDER_STATUSES = new Set(['completed', 'cancelled']);

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
