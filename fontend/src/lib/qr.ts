import type { SessionInput } from './types';

export function parseQrPayload(input: string): SessionInput {
  const data = extractDataParam(input);
  if (!data) throw new Error('QR không hợp lệ');

  try {
    const decoded = JSON.parse(atob(data)) as Partial<SessionInput>;
    if (
      typeof decoded.restaurantId !== 'string' ||
      typeof decoded.qrSecret !== 'string' ||
      typeof decoded.tableNumber !== 'number' ||
      decoded.tableNumber < 1
    ) {
      throw new Error('bad shape');
    }

    return {
      restaurantId: decoded.restaurantId,
      tableNumber: decoded.tableNumber,
      qrSecret: decoded.qrSecret,
    };
  } catch {
    throw new Error('QR không hợp lệ');
  }
}

export function getTabletScanUrl(qrCode: string): string {
  const data = extractDataParam(qrCode);
  const origin = import.meta.env.VITE_TABLET_ORIGIN ?? 'http://localhost:5174';
  return data ? `${origin}/scan?data=${encodeURIComponent(data)}` : qrCode;
}

function extractDataParam(input: string): string | null {
  try {
    const url = new URL(input, window.location.origin);
    return url.searchParams.get('data');
  } catch {
    return null;
  }
}
