import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './api';

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
});
