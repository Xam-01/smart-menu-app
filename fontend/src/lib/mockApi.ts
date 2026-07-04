import type {
  AllergenType,
  ApiResponse,
  LoginResult,
  Menu,
  MenuItemCategory,
  Order,
  OrderStatus,
  Owner,
  OwnerMenuItem,
  PublicMenu,
  PublicMenuItem,
  Restaurant,
  Session,
} from './types';

type MockTranslation = {
  language: string;
  translatedName: string;
  translatedDesc?: string;
};

type MockMenuItem = OwnerMenuItem & {
  translations: MockTranslation[];
};

type MockSession = Session & {
  allergens: AllergenType[];
  preferences: string[];
};

const now = new Date('2026-07-02T10:00:00.000Z').toISOString();
const owner: Owner = { id: 'owner-1', email: 'owner@smartmenu.local', role: 'owner' };
const restaurant: Restaurant = {
  id: 'restaurant-1',
  name: 'Haidilao Smart Hotpot',
  address: '88 Nguyen Hue, District 1',
  phone: '0900000000',
  description: 'Tablet ordering demo backed by frontend mock data.',
  tableCount: 8,
  status: 'active',
  tables: Array.from({ length: 8 }, (_, index) => {
    const tableNumber = index + 1;
    return {
      tableNumber,
      qrCode: btoa(JSON.stringify({ restaurantId: 'restaurant-1', tableNumber, qrSecret: `mock-secret-${tableNumber}` })),
      isActive: true,
    };
  }),
  createdAt: now,
  updatedAt: now,
};

let menus: Menu[] = [
  {
    id: 'menu-1',
    version: 1,
    status: 'published',
    ocrStatus: 'completed',
    publishedAt: now,
    createdAt: now,
  },
  {
    id: 'menu-2',
    version: 2,
    status: 'draft',
    ocrStatus: 'pending',
    createdAt: now,
  },
];

let items: MockMenuItem[] = [
  {
    id: 'item-1',
    nameVi: 'Lẩu nấm thảo mộc',
    descVi: 'Nước dùng thanh, nấm tươi và rau theo mùa.',
    price: 189000,
    category: 'Món chính' as MenuItemCategory,
    status: 'available',
    imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=80',
    allergenTags: [],
    allergenVerified: true,
    translations: [
      { language: 'en', translatedName: 'Herbal mushroom hotpot', translatedDesc: 'Light broth with fresh mushrooms and seasonal vegetables.' },
      { language: 'ko', translatedName: '허브 버섯 훠궈', translatedDesc: '신선한 버섯과 제철 채소가 들어간 맑은 육수.' },
      { language: 'ja', translatedName: '薬膳きのこ火鍋', translatedDesc: '新鮮なきのこと季節野菜のあっさりスープ。' },
      { language: 'zh', translatedName: '草本菌菇火锅', translatedDesc: '清爽汤底，搭配鲜菇和时令蔬菜。' },
    ],
  },
  {
    id: 'item-2',
    nameVi: 'Bò Mỹ cuộn',
    descVi: 'Ba chỉ bò thái mỏng dùng nhúng lẩu.',
    price: 149000,
    category: 'Món chính' as MenuItemCategory,
    status: 'available',
    imageUrl: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=900&q=80',
    allergenTags: [],
    allergenVerified: true,
    translations: [
      { language: 'en', translatedName: 'US beef rolls', translatedDesc: 'Thin-sliced beef for hotpot.' },
      { language: 'ko', translatedName: '미국산 소고기 롤', translatedDesc: '훠궈용 얇게 썬 소고기.' },
      { language: 'ja', translatedName: 'USビーフロール', translatedDesc: '火鍋用の薄切り牛肉。' },
      { language: 'zh', translatedName: '美国肥牛卷', translatedDesc: '适合涮火锅的薄切牛肉。' },
    ],
  },
  {
    id: 'item-3',
    nameVi: 'Tôm sú tươi',
    descVi: 'Tôm tươi nguyên con, cần lưu ý dị ứng giáp xác.',
    price: 168000,
    category: 'Món chính' as MenuItemCategory,
    status: 'available',
    imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80',
    allergenTags: [{ allergen: 'crustacean', confidence: 'contains', source: 'owner_verified' }],
    allergenVerified: true,
    translations: [
      { language: 'en', translatedName: 'Fresh tiger prawns', translatedDesc: 'Whole fresh prawns. Contains crustacean shellfish.' },
      { language: 'ko', translatedName: '신선한 타이거 새우', translatedDesc: '갑각류 알레르기 주의.' },
      { language: 'ja', translatedName: '新鮮なブラックタイガー', translatedDesc: '甲殻類アレルギーにご注意ください。' },
      { language: 'zh', translatedName: '鲜活虎虾', translatedDesc: '整只鲜虾，含甲壳类过敏原。' },
    ],
  },
  {
    id: 'item-4',
    nameVi: 'Đậu hũ mè rang',
    descVi: 'Đậu hũ non phủ mè rang.',
    price: 69000,
    category: 'Khai vị' as MenuItemCategory,
    status: 'available',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
    allergenTags: [
      { allergen: 'soy', confidence: 'contains', source: 'owner_verified' },
      { allergen: 'sesame', confidence: 'contains', source: 'owner_verified' },
    ],
    allergenVerified: true,
    translations: [
      { language: 'en', translatedName: 'Roasted sesame tofu', translatedDesc: 'Silken tofu with roasted sesame.' },
      { language: 'ko', translatedName: '참깨 두부', translatedDesc: '볶은 참깨를 올린 연두부.' },
      { language: 'ja', translatedName: 'ごま豆腐', translatedDesc: '絹ごし豆腐に煎りごまを添えました。' },
      { language: 'zh', translatedName: '芝麻豆腐', translatedDesc: '嫩豆腐配烤芝麻。' },
    ],
  },
  {
    id: 'item-5',
    nameVi: 'Trà hoa cúc lạnh',
    descVi: 'Trà hoa cúc ít đường.',
    price: 39000,
    category: 'Đồ uống' as MenuItemCategory,
    status: 'available',
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80',
    allergenTags: [],
    allergenVerified: true,
    translations: [
      { language: 'en', translatedName: 'Iced chrysanthemum tea', translatedDesc: 'Lightly sweetened chrysanthemum tea.' },
      { language: 'ko', translatedName: '아이스 국화차', translatedDesc: '덜 달게 만든 국화차.' },
      { language: 'ja', translatedName: 'アイス菊花茶', translatedDesc: '甘さ控えめの菊花茶。' },
      { language: 'zh', translatedName: '冰菊花茶', translatedDesc: '少糖菊花茶。' },
    ],
  },
];

let sessions: MockSession[] = [];
let orders: Order[] = [
  {
    id: 'order-1',
    tableNumber: 3,
    items: [{ menuItemId: 'item-2', nameVi: 'Bò Mỹ cuộn', price: 149000, quantity: 2 }],
    status: 'preparing',
    totalPrice: 298000,
    createdAt: now,
  },
];

export function createMockApiFetch(): typeof fetch {
  return async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : undefined;

    try {
      if (path === '/' && method === 'GET') {
        return json(
          {
            message: 'API is live',
            status: 'ok',
            version: '1.0.0',
            environment: 'mock',
            uptime: 0,
            server: 'Frontend mock API',
            docs: 'https://docs.smartmenu-api.mk-ts-04.com',
            timestamp: new Date().toISOString(),
          },
          'Mock API root',
        );
      }

      if (path === '/health' && method === 'GET') {
        return json(
          {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'smart-menu-mock-api',
            uptime: 0,
          },
          'Mock API health',
        );
      }

      if (path === '/auth/login' || path === '/auth/register') {
        return json<LoginResult>({ accessToken: 'mock-access-token', owner }, 'Mock auth');
      }
      if (path === '/auth/refresh-token' && method === 'POST') {
        return json({ accessToken: 'mock-access-token', refreshToken: body?.refreshToken ?? 'mock-refresh-token' }, 'Mock token refreshed');
      }
      if (path === '/auth/logout' && method === 'POST') {
        return json({ loggedOut: true }, 'Mock logout');
      }

      if (path === '/restaurants/me' && method === 'GET') return json(restaurant, 'Mock restaurant');
      if (path === '/restaurants' && method === 'POST') {
        Object.assign(restaurant, body, { updatedAt: new Date().toISOString() });
        return json(restaurant, 'Mock restaurant created', 201);
      }
      if (path === `/restaurants/${restaurant.id}` && method === 'PATCH') {
        Object.assign(restaurant, body, { updatedAt: new Date().toISOString() });
        return json(restaurant, 'Mock restaurant updated');
      }
      const tableQrMatch = path.match(/^\/restaurants\/([^/]+)\/tables\/(\d+)\/qr$/);
      if (tableQrMatch && method === 'GET') {
        const tableNumber = Number(tableQrMatch[2]);
        const table = restaurant.tables.find((item) => item.tableNumber === tableNumber);
        if (!table) return fail('TABLE_NOT_FOUND', 'Table not found', 404);
        return json({ tableNumber, qrCode: table.qrCode }, 'Mock table QR');
      }
      const revokeMatch = path.match(/^\/restaurants\/([^/]+)\/tables\/(\d+)\/qr\/revoke$/);
      if (revokeMatch && method === 'POST') {
        const tableNumber = Number(revokeMatch[2]);
        const table = restaurant.tables.find((item) => item.tableNumber === tableNumber);
        if (!table) return fail('TABLE_NOT_FOUND', 'Table not found', 404);
        table.qrCode = btoa(JSON.stringify({ restaurantId: restaurant.id, tableNumber, qrSecret: `mock-secret-${tableNumber}-${Date.now()}` }));
        return json({ tableNumber, qrCode: table.qrCode }, 'Mock table QR refreshed');
      }

      if (path === '/menus' && method === 'GET') return json(menus, 'Mock menus', 200, { total: menus.length });
      if (path === '/menus/upload' && method === 'POST') {
        const nextMenu: Menu = {
          id: `menu-${menus.length + 1}`,
          version: Math.max(...menus.map((menu) => menu.version)) + 1,
          status: 'draft',
          ocrStatus: 'pending',
          createdAt: new Date().toISOString(),
        };
        menus = [nextMenu, ...menus];
        return json(nextMenu, 'Mock menu uploaded', 201);
      }

      const menuPublishMatch = path.match(/^\/menus\/([^/]+)\/publish$/);
      if (menuPublishMatch && method === 'POST') {
        menus = menus.map((menu) =>
          menu.id === menuPublishMatch[1]
            ? { ...menu, status: 'published', publishedAt: new Date().toISOString() }
            : menu.status === 'published'
              ? { ...menu, status: 'archived', archivedAt: new Date().toISOString() }
              : menu,
        );
        return json(menus.find((menu) => menu.id === menuPublishMatch[1])!, 'Mock menu published');
      }

      const menuDeleteMatch = path.match(/^\/menus\/([^/]+)$/);
      if (menuDeleteMatch && method === 'DELETE') {
        const menu = menus.find((item) => item.id === menuDeleteMatch[1]);
        if (!menu) return fail('MENU_NOT_FOUND', 'Menu not found', 404);
        if (menu.status === 'published') {
          menu.status = 'archived';
          menu.archivedAt = new Date().toISOString();
        } else {
          menus = menus.filter((item) => item.id !== menu.id);
        }
        return json(menu, 'Mock menu deleted');
      }

      const menuItemsMatch = path.match(/^\/menus\/([^/]+)\/items$/);
      if (menuItemsMatch && method === 'GET') {
        const category = url.searchParams.get('category');
        const status = url.searchParams.get('status');
        return json(
          items
            .filter((item) => !category || item.category === category)
            .filter((item) => !status || item.status === status)
            .map(toOwnerItem),
          'Mock menu items',
        );
      }
      if (menuItemsMatch && method === 'POST') {
        const nextItem: MockMenuItem = {
          id: `item-${Date.now()}`,
          nameVi: body.nameVi,
          descVi: body.descVi,
          price: body.price,
          category: body.category,
          status: body.status ?? 'available',
          imageUrl: body.imageUrl,
          allergenTags: body.allergenTags ?? [],
          allergenVerified: false,
          translations: [],
          createdAt: new Date().toISOString(),
        };
        items = [nextItem, ...items];
        return json(toOwnerItem(nextItem), 'Mock menu item created', 201);
      }

      const itemMatch = path.match(/^\/menus\/([^/]+)\/items\/([^/]+)$/);
      if (itemMatch && method === 'PATCH') {
        const item = findItem(itemMatch[2]);
        if (!item) return fail('ITEM_NOT_FOUND', 'Menu item not found', 404);
        Object.assign(item, body, { updatedAt: new Date().toISOString() });
        if (body.nameVi || body.descVi !== undefined) item.translations = [];
        return json(toOwnerItem(item), 'Mock menu item updated');
      }
      if (itemMatch && method === 'DELETE') {
        items = items.filter((item) => item.id !== itemMatch[2]);
        return json({ id: itemMatch[2] }, 'Mock menu item deleted');
      }

      const allergenMatch = path.match(/^\/menus\/([^/]+)\/items\/([^/]+)\/allergens$/);
      if (allergenMatch && method === 'PATCH') {
        const item = findItem(allergenMatch[2]);
        if (!item) return fail('ITEM_NOT_FOUND', 'Menu item not found', 404);
        item.allergenTags = body.allergenTags ?? [];
        if (body.verified === true) item.allergenVerified = true;
        return json(toOwnerItem(item), 'Mock allergens updated');
      }

      if (path === '/sessions' && method === 'POST') {
        const session: MockSession = {
          sessionId: `mock-session-${Date.now()}`,
          restaurantId: body.restaurantId,
          tableNumber: body.tableNumber,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          allergens: [],
          preferences: [],
        };
        sessions = [session, ...sessions];
        return json<Session>(session, 'Mock session created', 201);
      }

      const sessionAllergenMatch = path.match(/^\/sessions\/([^/]+)\/allergens$/);
      if (sessionAllergenMatch && method === 'PATCH') {
        const session = findSession(sessionAllergenMatch[1]);
        if (!session) return fail('SESSION_NOT_FOUND', 'Session not found', 404);
        session.allergens = body.allergens ?? [];
        session.preferences = body.preferences ?? [];
        return json({ sessionId: session.sessionId, allergens: session.allergens, preferences: session.preferences }, 'Mock allergens updated');
      }

      const publicMenuMatch = path.match(/^\/public\/restaurants\/([^/]+)\/menu$/);
      if (publicMenuMatch && method === 'GET') {
        return json(buildPublicMenu(url.searchParams.get('sessionId') || undefined, url.searchParams.get('lang') || 'vi'), 'Mock public menu');
      }

      if (path === '/orders' && method === 'GET') {
        const status = url.searchParams.get('status');
        const tableNumber = url.searchParams.get('tableNumber');
        return json(
          orders
            .filter((order) => !status || order.status === status)
            .filter((order) => !tableNumber || order.tableNumber === Number(tableNumber)),
          'Mock orders',
          200,
          { total: orders.length },
        );
      }
      if (path === '/orders' && method === 'POST') {
        const session = findSession(body.sessionId);
        if (!session) return fail('SESSION_INVALID', 'Session invalid', 401);
        const orderItems = body.items.map((orderItem: { menuItemId: string; quantity: number; notes?: string }) => {
          const item = findItem(orderItem.menuItemId);
          if (!item || item.status !== 'available') throw new Error('ITEMS_UNAVAILABLE');
          return {
            menuItemId: item.id,
            nameVi: item.nameVi,
            name: item.nameVi,
            price: item.price,
            quantity: orderItem.quantity,
            notes: orderItem.notes,
          };
        });
        const nextOrder: Order = {
          id: `order-${Date.now()}`,
          tableNumber: session.tableNumber,
          items: orderItems,
          status: 'pending',
          allergyNotes: session.allergens.length ? `Khách dị ứng: ${session.allergens.join(', ')}` : undefined,
          customerNotes: body.customerNotes?.slice(0, 200),
          totalPrice: orderItems.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0),
          createdAt: new Date().toISOString(),
        };
        orders = [nextOrder, ...orders];
        return json(nextOrder, 'Mock order created', 201);
      }

      const orderStatusMatch = path.match(/^\/orders\/([^/]+)\/status$/);
      if (orderStatusMatch && method === 'PATCH') {
        const order = orders.find((item) => item.id === orderStatusMatch[1]);
        if (!order) return fail('ORDER_NOT_FOUND', 'Order not found', 404);
        order.status = body.status as OrderStatus;
        order.updatedAt = new Date().toISOString();
        return json(order, 'Mock order status updated');
      }

      const sessionOrdersMatch = path.match(/^\/orders\/session\/([^/]+)$/);
      if (sessionOrdersMatch && method === 'GET') {
        const session = findSession(sessionOrdersMatch[1]);
        return json(session ? orders.filter((order) => order.tableNumber === session.tableNumber) : [], 'Mock session orders');
      }

      const cashPaymentMatch = path.match(/^\/orders\/session\/([^/]+)\/cash-payment$/);
      if (cashPaymentMatch && method === 'POST') {
        const session = findSession(cashPaymentMatch[1]);
        if (!session) return fail('SESSION_NOT_FOUND', 'Session not found', 404);
        orders = orders.map((order) =>
          order.tableNumber === session.tableNumber && !['completed', 'cancelled'].includes(order.status)
            ? { ...order, status: 'completed', updatedAt: new Date().toISOString() }
            : order,
        );
        return json(orders.filter((order) => order.tableNumber === session.tableNumber), 'Mock cash payment completed');
      }

      return fail('MOCK_ROUTE_NOT_FOUND', `No mock route for ${method} ${path}`, 404);
    } catch (error) {
      if (error instanceof Error && error.message === 'ITEMS_UNAVAILABLE') {
        return fail('ITEMS_UNAVAILABLE', 'Some dishes are unavailable', 422);
      }
      return fail('MOCK_ERROR', error instanceof Error ? error.message : 'Mock API error', 500);
    }
  };
}

function buildPublicMenu(sessionId: string | undefined, language: string): PublicMenu {
  const session = sessionId ? findSession(sessionId) : undefined;
  const guestAllergens = session?.allergens ?? [];
  const grouped: Record<string, PublicMenuItem[]> = {};
  for (const item of items.filter((item) => item.status === 'available')) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(toPublicItem(item, language, guestAllergens));
  }

  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      description: restaurant.description,
    },
    menu: {
      id: 'menu-1',
      version: 1,
      publishedAt: now,
    },
    categories: grouped,
    guestAllergens,
    language,
    disclaimer:
      'Thông tin dị ứng mang tính tham khảo. Vui lòng xác nhận lại với nhân viên nếu bạn dị ứng nặng.',
  };
}

function toPublicItem(item: MockMenuItem, language: string, guestAllergens: AllergenType[]): PublicMenuItem {
  const translation = language !== 'vi' ? item.translations.find((entry) => entry.language === language) : undefined;
  return {
    id: item.id,
    nameVi: item.nameVi,
    name: translation?.translatedName ?? item.nameVi,
    description: translation?.translatedDesc ?? item.descVi,
    price: item.price,
    category: item.category,
    imageUrl: item.imageUrl,
    allergenTags: item.allergenTags,
    allergenVerified: item.allergenVerified,
    allergenLabel: getAllergenLabel(item, guestAllergens),
  };
}

function getAllergenLabel(item: MockMenuItem, guestAllergens: AllergenType[]): PublicMenuItem['allergenLabel'] {
  if (guestAllergens.length === 0) return 'none';
  const selected = new Set(guestAllergens);
  if (item.allergenTags.some((tag) => selected.has(tag.allergen) && tag.confidence === 'contains')) return 'red';
  if (!item.allergenVerified || item.allergenTags.some((tag) => selected.has(tag.allergen) && tag.confidence === 'may_contain')) return 'yellow';
  return 'green';
}

function toOwnerItem(item: MockMenuItem): OwnerMenuItem {
  return {
    id: item.id,
    nameVi: item.nameVi,
    descVi: item.descVi,
    price: item.price,
    category: item.category,
    status: item.status,
    imageUrl: item.imageUrl,
    allergenTags: item.allergenTags,
    allergenVerified: item.allergenVerified,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function findItem(itemId: string) {
  return items.find((item) => item.id === itemId);
}

function findSession(sessionId: string) {
  return sessions.find((session) => session.sessionId === sessionId);
}

function json<T>(data: T, message: string, status = 200, meta?: Record<string, unknown>) {
  const payload: ApiResponse<T> = { success: true, message, data, meta };
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ success: false, code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
