import type {
  ApiResponse,
  AllergenTag,
  AllergenType,
  LoginResult,
  Menu,
  MenuItemCategory,
  MenuItemStatus,
  Order,
  OwnerMenuItem,
  PublicMenu,
  Restaurant,
  Session,
  SessionInput,
} from './types';

export const ACCESS_TOKEN_KEY = 'smart-menu-access-token';

type QueryValue = string | number | boolean | undefined | null;
type Fetcher = typeof fetch;

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

type RequestOptions = {
  body?: unknown;
  query?: Record<string, QueryValue>;
  auth?: boolean;
  headers?: Record<string, string>;
};

export function createApiClient({
  baseUrl,
  fetcher = fetch,
}: {
  baseUrl: string;
  fetcher?: Fetcher;
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  async function request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${normalizedBaseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    if (options.auth !== false) {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetcher(url.toString(), {
      method,
      credentials: 'omit',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = await readJson(response);
    if (!response.ok || payload?.success === false) {
      throw new ApiError(
        payload?.message || 'Không thể kết nối backend',
        response.status,
        payload?.code,
        payload?.data,
      );
    }

    return payload as ApiResponse<T>;
  }

  return {
    get: <T>(path: string, query?: Record<string, QueryValue>, auth = true) =>
      request<T>('GET', path, { query, auth }),
    post: <T>(path: string, body?: unknown, auth = true) =>
      request<T>('POST', path, { body, auth }),
    patch: <T>(path: string, body?: unknown, auth = true) =>
      request<T>('PATCH', path, { body, auth }),
    delete: <T>(path: string, auth = true) => request<T>('DELETE', path, { auth }),
  };
}

async function readJson(response: Response) {
  if (typeof response.text !== 'function' && typeof response.json === 'function') {
    return response.json();
  }

  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text };
  }
}

const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
});

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResult>('/auth/login', { email, password }, false),
  register: (email: string, password: string) =>
    api.post<LoginResult>('/auth/register', { email, password }, false),
};

export const ownerApi = {
  getRestaurant: () => api.get<Restaurant>('/restaurants/me'),
  createRestaurant: (input: {
    name: string;
    address: string;
    phone?: string;
    description?: string;
    tableCount: number;
  }) => api.post<Restaurant>('/restaurants', input),
  updateRestaurant: (id: string, input: Partial<Restaurant>) =>
    api.patch<Restaurant>(`/restaurants/${id}`, input),
  getMenus: () => api.get<Menu[]>('/menus'),
  uploadMenu: (imagePath?: string) => api.post<Menu>('/menus/upload', { imagePath }),
  publishMenu: (menuId: string) => api.post<Menu>(`/menus/${menuId}/publish`),
  getItems: (menuId: string, query?: { category?: string; status?: string }) =>
    api.get<OwnerMenuItem[]>(`/menus/${menuId}/items`, query),
  createItem: (
    menuId: string,
    input: {
      nameVi: string;
      descVi?: string;
      price: number;
      category: MenuItemCategory;
      status?: MenuItemStatus;
      imageUrl?: string;
      allergenTags?: AllergenTag[];
    },
  ) => api.post<OwnerMenuItem>(`/menus/${menuId}/items`, input),
  updateItem: (menuId: string, itemId: string, input: Partial<OwnerMenuItem>) =>
    api.patch<OwnerMenuItem>(`/menus/${menuId}/items/${itemId}`, input),
  updateAllergens: (
    menuId: string,
    itemId: string,
    allergenTags: AllergenTag[],
    verified: boolean,
  ) => api.patch(`/menus/${menuId}/items/${itemId}/allergens`, { allergenTags, verified }),
  getOrders: (query?: { status?: string; tableNumber?: string; page?: number; limit?: number }) =>
    api.get<Order[]>('/orders', query),
  updateOrderStatus: (orderId: string, status: string) =>
    api.patch<Order>(`/orders/${orderId}/status`, { status }),
  revokeTableQr: (restaurantId: string, tableNumber: number) =>
    api.post<{ tableNumber: number; qrCode: string }>(
      `/restaurants/${restaurantId}/tables/${tableNumber}/qr/revoke`,
    ),
};

export const tabletApi = {
  createSession: (input: SessionInput) => api.post<Session>('/sessions', input, false),
  updateAllergens: (sessionId: string, allergens: AllergenType[], preferences: string[]) =>
    api.patch<{ sessionId: string; allergens: AllergenType[]; preferences: string[] }>(
      `/sessions/${sessionId}/allergens`,
      { allergens, preferences },
      false,
    ),
  getPublicMenu: (restaurantId: string, sessionId?: string, lang = 'vi') =>
    api.get<PublicMenu>(
      `/public/restaurants/${restaurantId}/menu`,
      { sessionId, lang },
      false,
    ),
  createOrder: (body: {
    sessionId: string;
    items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
    customerNotes?: string;
  }) => api.post<Order>('/orders', body, false),
  getSessionOrders: (sessionId: string) =>
    api.get<Order[]>(`/orders/session/${sessionId}`, undefined, false),
};
