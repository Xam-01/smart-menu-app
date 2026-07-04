import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ACCESS_TOKEN_KEY, ownerApi, tabletApi } from './lib/api';
import type { OwnerMenuItem, PublicMenu, Restaurant } from './lib/types';

vi.mock('./lib/api', () => {
  class ApiError extends Error {}

  return {
    ACCESS_TOKEN_KEY: 'smart-menu-access-token',
    ApiError,
    authApi: {
      login: vi.fn(),
      register: vi.fn(),
    },
    ownerApi: {
      getRestaurant: vi.fn(),
      getMenus: vi.fn(),
      getOrders: vi.fn(),
      getItems: vi.fn(),
      uploadMenu: vi.fn(),
      publishMenu: vi.fn(),
      deleteMenu: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      updateAllergens: vi.fn(),
      updateRestaurant: vi.fn(),
      createRestaurant: vi.fn(),
      revokeTableQr: vi.fn(),
      updateOrderStatus: vi.fn(),
    },
    tabletApi: {
      createSession: vi.fn(),
      updateAllergens: vi.fn(),
      getPublicMenu: vi.fn(),
      getSessionOrders: vi.fn(),
      createOrder: vi.fn(),
      cashPayment: vi.fn(),
    },
  };
});

const publicMenu: PublicMenu = {
  restaurant: {
    id: 'restaurant-1',
    name: 'Test Hotpot',
    address: '1 Tablet Street',
  },
  menu: {
    id: 'menu-1',
    version: 1,
    publishedAt: '2026-07-02T00:00:00.000Z',
  },
  categories: {
    Main: [
      {
        id: 'item-1',
        nameVi: 'Lau',
        name: 'Lau',
        price: 120000,
        category: 'MÃ³n chÃ­nh' as PublicMenu['categories'][string][number]['category'],
        allergenTags: [],
        allergenVerified: true,
        allergenLabel: 'none',
      },
    ],
  },
  guestAllergens: [],
  language: 'vi',
  disclaimer: 'Check allergens with staff.',
};

const restaurant: Restaurant = {
  id: 'restaurant-1',
  name: 'Test Hotpot',
  address: '1 Owner Street',
  phone: '0900000000',
  tableCount: 2,
  status: 'active',
  tables: [
    { tableNumber: 1, qrCode: 'qr-1', isActive: true },
    { tableNumber: 2, qrCode: 'qr-2', isActive: true },
  ],
};

const ownerItems: OwnerMenuItem[] = [
  {
    id: 'owner-item-1',
    nameVi: 'Lau nam',
    descVi: 'Nam tuoi',
    price: 99000,
    category: 'MÃ³n chÃ­nh' as OwnerMenuItem['category'],
    status: 'available',
    allergenTags: [],
    allergenVerified: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('tablet controls', () => {
  it('does not expose technical session, token, or host details on the tablet welcome screen', () => {
    vi.stubEnv('MODE', 'tablet');

    render(<App />);

    expect(screen.queryByText(/localhost|session|token|phiên/i)).not.toBeInTheDocument();
  });

  it('starts a table without showing session wording to diners', async () => {
    vi.stubEnv('MODE', 'tablet');
    const payload = btoa(JSON.stringify({
      restaurantId: 'restaurant-1',
      tableNumber: 8,
      qrSecret: 'secret-token',
    }));
    vi.mocked(tabletApi.createSession).mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        sessionId: 'session-1',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      },
    });
    vi.mocked(tabletApi.getPublicMenu).mockResolvedValue({ success: true, message: 'ok', data: publicMenu });
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    await userEvent.type(screen.getByLabelText('Liên kết bàn'), `http://localhost:5174/scan?data=${payload}`);
    await userEvent.click(screen.getByRole('button', { name: /Mở menu bàn này/i }));

    await waitFor(() => {
      expect(tabletApi.getPublicMenu).toHaveBeenCalledWith('restaurant-1', 'session-1', 'vi');
    });
    expect(screen.queryByText(/Đã mở bàn/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/phiên|session|token/i)).not.toBeInTheDocument();
  });

  it('does not show token or session expiry errors on the tablet menu', async () => {
    vi.stubEnv('MODE', 'tablet');
    localStorage.setItem(
      'smart-menu-tablet-session',
      JSON.stringify({
        sessionId: 'session-1',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      }),
    );
    vi.mocked(tabletApi.getPublicMenu).mockRejectedValue(new Error('Token expired for session'));
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    await waitFor(() => {
      expect(tabletApi.getPublicMenu).toHaveBeenCalled();
    });

    expect(screen.queryByText(/token|session|phiên|hết token|expired/i)).not.toBeInTheDocument();
  });

  it('uses the unified professional design shell on tablet', async () => {
    vi.stubEnv('MODE', 'tablet');
    localStorage.setItem(
      'smart-menu-tablet-session',
      JSON.stringify({
        sessionId: 'session-1',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      }),
    );
    vi.mocked(tabletApi.getPublicMenu).mockResolvedValue({ success: true, message: 'ok', data: publicMenu });
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });

    const { container } = render(<App />);

    expect(await screen.findByText('Test Hotpot')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('design-shell');
  });

  it('renders a dish image even when a menu item has no backend image', async () => {
    vi.stubEnv('MODE', 'tablet');
    localStorage.setItem(
      'smart-menu-tablet-session',
      JSON.stringify({
        sessionId: 'session-1',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      }),
    );
    vi.mocked(tabletApi.getPublicMenu).mockResolvedValue({ success: true, message: 'ok', data: publicMenu });
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    const dishImage = await screen.findByRole('img', { name: 'Lau' });
    expect(dishImage).toHaveAttribute('src', expect.stringContaining('images.unsplash.com'));
  });

  it('orders tablet categories by dining flow and removes the compact total pill', async () => {
    vi.stubEnv('MODE', 'tablet');
    localStorage.setItem(
      'smart-menu-tablet-session',
      JSON.stringify({
        sessionId: 'session-1',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      }),
    );
    const baseItem = publicMenu.categories.Main[0];
    vi.mocked(tabletApi.getPublicMenu).mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        ...publicMenu,
        categories: {
          'Khác': [{ ...baseItem, id: 'other-1', name: 'Other', category: 'Khác' }],
          'Đồ uống': [{ ...baseItem, id: 'drink-1', name: 'Drink', category: 'Đồ uống' }],
          'Món chính': [{ ...baseItem, id: 'main-1', name: 'Main', category: 'Món chính' }],
          'Tráng miệng': [{ ...baseItem, id: 'dessert-1', name: 'Dessert', category: 'Tráng miệng' }],
          'Khai vị': [{ ...baseItem, id: 'starter-1', name: 'Starter', category: 'Khai vị' }],
        },
      },
    });
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });

    const { container } = render(<App />);

    await screen.findByText('Test Hotpot');
    const sidebar = container.querySelector('.tablet-category-sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(within(sidebar as HTMLElement).getAllByRole('button').map((button) => (
      button.querySelector('span')?.textContent
    ))).toEqual(['Khai vị', 'Món chính', 'Tráng miệng', 'Đồ uống', 'Khác']);
    expect(container.querySelector('.tablet-total-pill')).not.toBeInTheDocument();
  });

  it('opens allergens as a dropdown list and keeps multiple selections', async () => {
    vi.stubEnv('MODE', 'tablet');
    localStorage.setItem(
      'smart-menu-tablet-session',
      JSON.stringify({
        sessionId: 'session-1',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      }),
    );
    vi.mocked(tabletApi.getPublicMenu).mockResolvedValue({ success: true, message: 'ok', data: publicMenu });
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(tabletApi.updateAllergens).mockResolvedValue({
      success: true,
      message: 'ok',
      data: { sessionId: 'session-1', allergens: [], preferences: [] },
    });

    render(<App />);

    const trigger = await screen.findByTestId('tablet-allergen-trigger');
    expect(screen.queryByTestId('tablet-allergen-menu')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    const menu = screen.getByTestId('tablet-allergen-menu');

    await userEvent.click(within(menu).getByTestId('allergen-option-crustacean'));
    await waitFor(() => {
      expect(tabletApi.updateAllergens).toHaveBeenLastCalledWith('session-1', ['crustacean'], []);
    });

    await userEvent.click(within(menu).getByTestId('allergen-option-fish'));
    await waitFor(() => {
      expect(tabletApi.updateAllergens).toHaveBeenLastCalledWith(
        'session-1',
        ['crustacean', 'fish'],
        [],
      );
    });
  });

  it('changes tablet labels, filters, cart copy, and menu request language together', async () => {
    vi.stubEnv('MODE', 'tablet');
    localStorage.setItem(
      'smart-menu-tablet-session',
      JSON.stringify({
        sessionId: 'session-1',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      }),
    );
    vi.mocked(tabletApi.getPublicMenu).mockImplementation(async (_restaurantId, _sessionId, lang = 'vi') => ({
      success: true,
      message: 'ok',
      data: {
        ...publicMenu,
        language: lang,
        categories: {
          Main: [
            {
              ...publicMenu.categories.Main[0],
              name: lang === 'en' ? 'Mushroom hotpot' : 'Lau nam',
              description: lang === 'en' ? 'Fresh mushrooms' : 'Nam tuoi',
            },
          ],
        },
      },
    }));
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    await screen.findByText('Test Hotpot');
    await userEvent.selectOptions(screen.getByLabelText(/Ngôn ngữ|Language/), 'en');

    await waitFor(() => {
      expect(tabletApi.getPublicMenu).toHaveBeenLastCalledWith('restaurant-1', 'session-1', 'en');
    });
    expect(await screen.findByText('Mushroom hotpot')).toBeInTheDocument();
    expect(screen.getByText('Allergy filter')).toBeInTheDocument();
    expect(screen.getByTestId('tablet-allergen-trigger')).toHaveTextContent('None selected');
    expect(screen.getByPlaceholderText('Search dishes...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send order/i })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('tablet-allergen-trigger'));
    expect(screen.getByTestId('allergen-option-crustacean')).toHaveTextContent('Crustacean shellfish');
  });
});

describe('owner tablet layout', () => {
  it('does not expose technical session, token, or localhost details to the owner', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    const workspace = await screen.findByTestId('owner-tablet-workspace');
    expect(workspace).toBeInTheDocument();
    expect(screen.queryByText(/localhost|session|token/i)).not.toBeInTheDocument();
  });

  it('uses the unified professional design shell on owner', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: [] });

    const { container } = render(<App />);

    expect(await screen.findByTestId('owner-tablet-workspace')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('design-shell');
  });

  it('uses a left category rail and keeps menu management in the remaining workspace', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [{ id: 'menu-1', version: 1, status: 'draft' }],
    });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: ownerItems });

    render(<App />);

    const workspace = await screen.findByTestId('owner-tablet-workspace');
    const rail = within(workspace).getByTestId('owner-left-category-rail');
    expect(rail).toHaveClass('owner-left-category-rail');

    await userEvent.click(within(rail).getByRole('button', { name: /menu/i }));

    const content = within(workspace).getByTestId('owner-content-workspace');
    expect(within(content).getByTestId('owner-menu-panel')).toBeVisible();
  });
});
