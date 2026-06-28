import type { CartItem, PublicMenuItem } from './types';

export function addItemToCart(cart: CartItem[], item: PublicMenuItem): CartItem[] {
  const existing = cart.find((cartItem) => cartItem.menuItemId === item.id);
  if (existing) {
    return updateCartQuantity(cart, item.id, existing.quantity + 1);
  }

  return [
    ...cart,
    {
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      allergenLabel: item.allergenLabel,
    },
  ];
}

export function updateCartQuantity(
  cart: CartItem[],
  menuItemId: string,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) return cart.filter((item) => item.menuItemId !== menuItemId);

  return cart.map((item) =>
    item.menuItemId === menuItemId
      ? { ...item, quantity: Math.min(quantity, 20) }
      : item,
  );
}

export function updateCartNote(
  cart: CartItem[],
  menuItemId: string,
  notes: string,
): CartItem[] {
  return cart.map((item) =>
    item.menuItemId === menuItemId ? { ...item, notes: notes.slice(0, 200) } : item,
  );
}

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function toOrderPayload(
  sessionId: string,
  cart: CartItem[],
  customerNotes?: string,
) {
  return {
    sessionId,
    customerNotes: customerNotes?.trim() || undefined,
    items: cart.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      notes: item.notes?.trim() || undefined,
    })),
  };
}
