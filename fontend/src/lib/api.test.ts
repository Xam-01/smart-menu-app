import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, createApiClient, ownerApi, systemApi } from './api';
import type { Order, Session } from './types';

describe('createApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sends bearer token and query params, then unwraps API data', async () => {
    localStorage.setItem('smart-menu-access-token', 'token-123');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [{ id: 'order-1' }], meta: { total: 1 } }),
    });

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetcher: fetchMock,
    });

    const response = await client.get('/orders', { status: 'pending', page: 1 });

    expect(response.data).toEqual([{ id: 'order-1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/orders?status=pending&page=1',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    );
  });

  it('throws a typed API error with backend message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, code: 'SESSION_INVALID', message: 'Session hết hạn' }),
    });
    const client = createApiClient({ baseUrl: 'http://localhost:3000/api/v1', fetcher: fetchMock });

    await expect(client.post('/orders', {})).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_INVALID',
      message: 'Session hết hạn',
    });
  });

  it('can fall back to a mock backend when the real backend is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const fallbackMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true, message: 'mock', data: { id: 'restaurant-1' } }),
    });
    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetcher: fetchMock,
      fallbackFetcher: fallbackMock,
    });

    const response = await client.get('/restaurants/me');

    expect(response.data).toEqual({ id: 'restaurant-1' });
    expect(fallbackMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/restaurants/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('ownerApi menu deletion surface', () => {
  it('exposes delete methods for menus and menu items', () => {
    expect(typeof ownerApi.deleteMenu).toBe('function');
    expect(typeof ownerApi.deleteItem).toBe('function');
  });
});

describe('frontend API coverage for backend routes', () => {
  it('exposes wrappers for every backend route that was not previously covered', () => {
    expect(typeof systemApi.getRoot).toBe('function');
    expect(typeof systemApi.getHealth).toBe('function');
    expect(typeof authApi.refreshToken).toBe('function');
    expect(typeof authApi.logout).toBe('function');
    expect(typeof ownerApi.getTableQr).toBe('function');
  });

  it('mock backend implements root, health, auth session, and table QR routes', async () => {
    const { createMockApiFetch } = await import('./mockApi');
    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetcher: createMockApiFetch(),
    });

    await expect(client.get('/')).resolves.toMatchObject({ data: { status: 'ok' } });
    await expect(client.get('/health')).resolves.toMatchObject({ data: { status: 'ok' } });
    await expect(client.post('/auth/refresh-token', { refreshToken: 'refresh-token' }, false)).resolves.toMatchObject({
      data: expect.objectContaining({ accessToken: expect.any(String) }),
    });
    await expect(client.post('/auth/logout')).resolves.toMatchObject({ data: { loggedOut: true } });
    await expect(client.get('/restaurants/restaurant-1/tables/1/qr')).resolves.toMatchObject({
      data: expect.objectContaining({ tableNumber: 1, qrCode: expect.any(String) }),
    });
  });
});

describe('tablet payment surface', () => {
  it('exposes cash payment for a table session', async () => {
    expect(typeof (await import('./api')).tabletApi.cashPayment).toBe('function');
  });

  it('mock orders keep menu item names and categories for bill details', async () => {
    const { createMockApiFetch } = await import('./mockApi');
    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetcher: createMockApiFetch(),
    });

    const session = await client.post<Session>('/sessions', {
      restaurantId: 'restaurant-1',
      tableNumber: 4,
      qrSecret: 'mock-secret-4',
    }, false);
    const order = await client.post<Order>('/orders', {
      sessionId: session.data.sessionId,
      items: [{ menuItemId: 'item-1', quantity: 1 }],
    }, false);

    expect(order.data.items[0]).toMatchObject({
      menuItemId: 'item-1',
      category: expect.any(String),
    });
    expect(order.data.items[0].category).not.toBe('KhÃ¡c');
    expect(order.data.items[0].nameVi).not.toMatch(/^\d+$/);
  });
});
