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

export function getTabletTableUrl({
  qrCode,
  restaurantId,
  tabletOrigin = import.meta.env.VITE_TABLET_ORIGIN ?? 'http://localhost:5174',
}: {
  qrCode: string;
  restaurantId: string;
  tabletOrigin?: string;
}): string {
  const data = extractDataParam(qrCode);
  if (!data) return qrCode;

  try {
    const decoded = JSON.parse(atob(data)) as {
      restaurantId?: string;
      tableNumber?: number;
      qrSecret?: string;
    };
    const normalized = {
      ...decoded,
      restaurantId: decoded.restaurantId || restaurantId,
    };
    return `${tabletOrigin}/scan?data=${encodeURIComponent(btoa(JSON.stringify(normalized)))}`;
  } catch {
    return `${tabletOrigin}/scan?data=${encodeURIComponent(data)}`;
  }
}

function extractDataParam(input: string): string | null {
  try {
    const url = new URL(input, window.location.origin);
    return url.searchParams.get('data');
  } catch {
    return null;
  }
}
