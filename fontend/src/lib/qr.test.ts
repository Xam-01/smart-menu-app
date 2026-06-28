import { describe, expect, it } from 'vitest';
import { parseQrPayload } from './qr';

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
    expect(() => parseQrPayload('/scan?data=bad-data')).toThrow('QR không hợp lệ');
  });
});
