import { describe, expect, it } from 'vitest';
import { getTabletTableUrl, parseQrPayload } from './qr';

describe('parseQrPayload', () => {
  it('decodes a backend QR URL into session input', () => {
    const raw = {
      restaurantId: 'restaurant-1',
      tableNumber: 7,
      qrSecret: 'secret-token',
    };
    const encoded = btoa(JSON.stringify(raw));

    expect(parseQrPayload(`http://localhost:5174/scan?data=${encoded}`)).toEqual(raw);
  });

  it('rejects malformed payloads', () => {
    expect(() => parseQrPayload('/scan?data=bad-data')).toThrow(/QR/);
  });

  it('builds a tablet URL with restaurantId when legacy table QR is missing it', () => {
    const encoded = btoa(JSON.stringify({
      tableNumber: 3,
      qrSecret: 'legacy-secret',
    }));

    const url = getTabletTableUrl({
      qrCode: `http://localhost:3000/api/v1/sessions/scan?data=${encoded}`,
      restaurantId: 'restaurant-1',
      tabletOrigin: 'http://localhost:5174',
    });

    expect(parseQrPayload(url)).toEqual({
      restaurantId: 'restaurant-1',
      tableNumber: 3,
      qrSecret: 'legacy-secret',
    });
  });
});
