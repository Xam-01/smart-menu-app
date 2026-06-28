import { describe, expect, it } from 'vitest';
import { addItemToCart, getCartTotal, toOrderPayload, updateCartQuantity } from './cart';
import type { PublicMenuItem } from './types';

const item: PublicMenuItem = {
  id: 'item-1',
  nameVi: 'Phở bò',
  name: 'Phở bò',
  price: 65000,
  category: 'Món chính',
  allergenTags: [],
  allergenVerified: true,
  allergenLabel: 'none',
};

describe('cart helpers', () => {
  it('adds an item and increases quantity when repeated', () => {
    const first = addItemToCart([], item);
    const second = addItemToCart(first, item);

    expect(second).toEqual([
      expect.objectContaining({ menuItemId: 'item-1', quantity: 2, price: 65000 }),
    ]);
  });

  it('removes an item when quantity is set to zero', () => {
    const cart = addItemToCart([], item);

    expect(updateCartQuantity(cart, 'item-1', 0)).toEqual([]);
  });

  it('builds the backend order payload', () => {
    const cart = updateCartQuantity(addItemToCart([], item), 'item-1', 3);

    expect(getCartTotal(cart)).toBe(195000);
    expect(toOrderPayload('session-1', cart, 'Ít hành')).toEqual({
      sessionId: 'session-1',
      customerNotes: 'Ít hành',
      items: [{ menuItemId: 'item-1', quantity: 3 }],
    });
  });
});
