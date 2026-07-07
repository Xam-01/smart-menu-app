import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ACCESS_TOKEN_KEY, ownerApi, tabletApi } from './lib/api';
import type { Order, OwnerMenuItem, PublicMenu, Restaurant } from './lib/types';

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

  it('renders the tablet experience without SVG icon elements', async () => {
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
    expect(container.querySelector('svg')).not.toBeInTheDocument();
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
    expect(Array.from((sidebar as HTMLElement).querySelectorAll(':scope > button')).map((button) => (
      button.querySelector('span')?.textContent
    ))).toEqual(['Khai vị', 'Món chính', 'Tráng miệng', 'Đồ uống', 'Khác', 'Phục vụ']);
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
    expect(screen.getByRole('heading', { name: /Cart|bàn 8/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send order/i })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('tablet-allergen-trigger'));
    expect(screen.getByTestId('allergen-option-crustacean')).toHaveTextContent('Crustacean shellfish');
  });

  it('adds tablet assistant, service requests, capped dish steppers, and unlocked payment only after staff action', async () => {
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
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [{
        id: 'order-history-1',
        tableNumber: 8,
        items: [{ nameVi: 'Lau', price: 120000, quantity: 1 }],
        status: 'ready',
        totalPrice: 120000,
        createdAt: '2026-07-02T11:00:00.000Z',
      }],
    });

    render(<App />);

    await screen.findByText('Test Hotpot');
    const dishCard = screen.getAllByText('Lau')[0].closest('.tablet-square-dish-card') as HTMLElement;
    expect(within(dishCard).getByText('0')).toBeInTheDocument();
    await userEvent.click(within(dishCard).getByRole('button', { name: '+' }));
    expect(within(dishCard).getByText('1')).toBeInTheDocument();

    const assistant = screen.getByTestId('tablet-ai-assistant-card');
    await userEvent.click(within(assistant).getByRole('button', { name: /AI|Chat/i }));
    expect(screen.getByText('Trợ lý gọi món')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Món ít cay/i }));
    expect(screen.getByText(/Bạn muốn tìm món ít cay/i)).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Lịch sử bàn/i })).not.toBeInTheDocument();
    const tableCart = screen.getByTestId('tablet-table-cart');
    expect(tableCart.querySelector('.session-orders')).not.toBeInTheDocument();
    expect(screen.queryByText(/Thanh toán đang chờ nhân viên/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Phục vụ/i }));
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu hóa đơn/i }));
    expect(screen.getByText(/Đã gửi: Yêu cầu hóa đơn/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mở thanh toán/i }));
    expect(screen.getByText(/Mã thanh toán/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('smart-menu-service-requests') ?? '[]')[0]).toMatchObject({
      tableNumber: 8,
    });
    expect(screen.getByText(/BILL-T08-/i)).toBeInTheDocument();
    expect(screen.getByText('MoMo')).toBeInTheDocument();
    expect(screen.getByText('Ngân hàng')).toBeInTheDocument();
  });
  it('keeps the AI assistant and chat inside the table cart card while reading current order state', async () => {
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
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [{
        id: 'order-history-1',
        tableNumber: 8,
        items: [{ nameVi: 'Nuoc suoi', price: 10000, quantity: 2 }],
        status: 'served',
        totalPrice: 20000,
        createdAt: '2026-07-02T11:00:00.000Z',
      }],
    });

    const { container } = render(<App />);

    await screen.findByText('Test Hotpot');
    await userEvent.click(screen.getByRole('button', { name: '+' }));

    const cartSidebar = container.querySelector('.tablet-cart-sidebar-panel');
    const tableCart = screen.getByTestId('tablet-table-cart');
    expect(container.querySelector('.tablet-ai-assistant-floating')).not.toBeInTheDocument();
    expect(cartSidebar?.querySelector('[data-testid="tablet-ai-assistant-card"]')).toBeInTheDocument();
    expect(tableCart.querySelector('[data-testid="tablet-ai-assistant-card"]')).toBeInTheDocument();
    expect(cartSidebar?.querySelector('.tablet-assistant-panel')).not.toBeInTheDocument();
    expect(container.querySelector('.tablet-ai-chat-panel')).not.toBeInTheDocument();

    const assistant = tableCart.querySelector('[data-testid="tablet-ai-assistant-card"]') as HTMLElement;
    expect(assistant).toBeInTheDocument();
    await userEvent.click(within(assistant).getByRole('button', { name: /AI|Chat/i }));

    const chatPanel = tableCart.querySelector('.tablet-ai-chat-panel') as HTMLElement;
    expect(chatPanel).toBeInTheDocument();
    expect(cartSidebar?.contains(chatPanel)).toBe(true);
    await userEvent.click(within(chatPanel).getByRole('button', { name: /Xem chi tiết đơn hàng/i }));

    expect(within(chatPanel).getAllByText(/Bàn T08/i).length).toBeGreaterThan(0);
    expect(within(chatPanel).getByText(/Lau/i)).toBeInTheDocument();
    expect(within(chatPanel).getByText(/Nuoc suoi/i)).toBeInTheDocument();

    await userEvent.click(within(chatPanel).getByRole('button', { name: /Đóng trợ lý/i }));
    expect(tableCart.querySelector('.tablet-ai-chat-panel')).not.toBeInTheDocument();
  });

  it('moves service requests from the other sidebar block into a separate service section', async () => {
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

    await screen.findByText('Test Hotpot');
    await userEvent.click(screen.getByRole('button', { name: '+' }));

    const categorySidebar = container.querySelector('.tablet-category-sidebar') as HTMLElement;
    const cartSidebar = container.querySelector('.tablet-cart-sidebar-panel');
    expect(container.querySelector('.tablet-sidebar-other')).not.toBeInTheDocument();
    expect(categorySidebar.querySelector('.service-request-panel')).not.toBeInTheDocument();
    expect(cartSidebar?.querySelector('.service-request-panel')).not.toBeInTheDocument();

    await userEvent.click(within(categorySidebar).getByRole('button', { name: /Phục vụ/i }));
    const serviceSection = screen.getByTestId('tablet-service-section');
    expect(within(serviceSection).getByRole('heading', { name: /Phục vụ/i })).toBeInTheDocument();
    await userEvent.click(within(serviceSection).getByRole('button', { name: /Yêu cầu hóa đơn/i }));
    expect(within(serviceSection).getByText(/Đã gửi yêu cầu/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('smart-menu-service-requests') ?? '[]')[0]).toMatchObject({
      tableNumber: 8,
    });
    expect(screen.getAllByText('Lau').length).toBeGreaterThan(0);
  });

  it('keeps a separate cart for each table on the same tablet device', async () => {
    vi.stubEnv('MODE', 'tablet');
    localStorage.setItem(
      'smart-menu-tablet-session',
      JSON.stringify({
        sessionId: 'session-8',
        restaurantId: 'restaurant-1',
        tableNumber: 8,
        expiresAt: '2026-07-02T12:00:00.000Z',
      }),
    );
    localStorage.setItem(
      'smart-menu-tablet-cart:restaurant-1:8',
      JSON.stringify([
        {
          menuItemId: 'item-1',
          name: 'Lau',
          price: 120000,
          quantity: 2,
          allergenLabel: 'none',
        },
      ]),
    );
    localStorage.setItem(
      'smart-menu-tablet-cart:restaurant-1:9',
      JSON.stringify([
        {
          menuItemId: 'item-1',
          name: 'Lau',
          price: 120000,
          quantity: 5,
          allergenLabel: 'none',
        },
      ]),
    );
    vi.mocked(tabletApi.getPublicMenu).mockResolvedValue({ success: true, message: 'ok', data: publicMenu });
    vi.mocked(tabletApi.getSessionOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    await screen.findByText('Test Hotpot');
    const tableCart = screen.getByTestId('tablet-table-cart');
    expect(within(tableCart).getByRole('heading', { name: /bàn 8/i })).toBeInTheDocument();
    expect(within(tableCart).getAllByText(/240\.000/).length).toBeGreaterThan(0);
    expect(within(tableCart).queryByText(/600\.000/)).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: '+' })[0]);

    expect(JSON.parse(localStorage.getItem('smart-menu-tablet-cart:restaurant-1:8') ?? '[]')[0].quantity).toBe(3);
    expect(JSON.parse(localStorage.getItem('smart-menu-tablet-cart:restaurant-1:9') ?? '[]')[0].quantity).toBe(5);
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

  it('renders the owner console without SVG icon elements', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: [] });

    const { container } = render(<App />);

    expect(await screen.findByTestId('owner-tablet-workspace')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
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

  it('renders the demo-style owner revenue page with hero, stats, selectors, and export panel', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    const completedOrders: Order[] = [
      {
        id: 'order-1',
        tableNumber: 1,
        items: [{ nameVi: 'Lau nam', price: 99000, quantity: 2 }],
        status: 'completed',
        totalPrice: 198000,
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T13:00:00.000Z',
      },
      {
        id: 'order-2',
        tableNumber: 2,
        items: [{ nameVi: 'Tra dao', price: 25000, quantity: 3 }],
        status: 'completed',
        totalPrice: 75000,
        createdAt: '2026-07-02T18:00:00.000Z',
        updatedAt: '2026-07-02T19:00:00.000Z',
      },
    ];
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: completedOrders });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: [] });

    const { container } = render(<App />);

    const workspace = await screen.findByTestId('owner-tablet-workspace');
    const rail = within(workspace).getByTestId('owner-left-category-rail');
    await userEvent.click(within(rail).getByRole('button', { name: /Doanh thu/i }));

    expect(container.querySelector('.owner-command-hero')).not.toBeInTheDocument();
    expect(container.querySelector('.metric-card')).not.toBeInTheDocument();
    const revenuePage = screen.getByTestId('owner-revenue-page');
    expect(revenuePage).toBeInTheDocument();
    expect(within(revenuePage).queryByText(/Owner \/ Phân tích kinh doanh/i)).not.toBeInTheDocument();
    expect(within(revenuePage).queryByText(/Chart dùng dữ liệu đơn đã thanh toán/i)).not.toBeInTheDocument();
    expect(within(revenuePage).queryByText(/Dữ liệu được tổng hợp từ bill đã thanh toán/i)).not.toBeInTheDocument();
    expect(revenuePage.querySelector('.owner-revenue-toolbar')).not.toBeInTheDocument();
    expect(revenuePage.querySelector('.owner-revenue-export-head')).not.toBeInTheDocument();
    expect(revenuePage.querySelector('.owner-revenue-export-buttons')).not.toBeInTheDocument();
    expect(within(revenuePage).getByText(/2 đơn đã thanh toán/i)).toBeInTheDocument();
    expect(revenuePage.querySelectorAll('.owner-revenue-stat-card')).toHaveLength(4);
    expect(within(revenuePage).getByText('Tổng tiền đã thanh toán')).toBeInTheDocument();
    expect(within(revenuePage).getByText('Bill thành công')).toBeInTheDocument();
    expect(within(revenuePage).getByText('Giá trị trung bình')).toBeInTheDocument();
    expect(within(revenuePage).getByText('Tổng số lượng món')).toBeInTheDocument();

    const chartPanel = screen.getByTestId('owner-revenue-chart-panel');
    const chartTypeSelect = within(chartPanel).getByRole('combobox', { name: /Loại biểu đồ/i });
    expect(chartTypeSelect).toBeInTheDocument();
    expect(Array.from(chartTypeSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      'Bar demos',
      'Pie',
    ]);
    expect(chartTypeSelect).toHaveValue('bar-demos');
    expect(within(chartPanel).queryByTestId('owner-revenue-chart-sparkline')).not.toBeInTheDocument();
    expect(within(chartPanel).getByRole('combobox', { name: /Khoảng thời gian/i })).toBeInTheDocument();
    expect(within(chartPanel).getByRole('button', { name: /Xuất Excel biểu đồ/i })).toBeInTheDocument();
    expect(within(chartPanel).getByTestId('owner-revenue-chart-bar-demos')).toBeInTheDocument();
    expect(within(chartPanel).getByTestId('owner-revenue-chart-bar-demos')).toHaveAttribute('data-chart-engine', 'mui-x-charts');
    await userEvent.selectOptions(chartTypeSelect, 'pie');
    expect(within(chartPanel).getByTestId('owner-revenue-chart-pie')).toBeInTheDocument();
    expect(within(chartPanel).getByTestId('owner-revenue-chart-pie')).toHaveAttribute('data-chart-engine', 'mui-x-charts');
    expect(chartPanel.querySelector('.owner-chart-canvas')).not.toBeInTheDocument();
    expect(chartPanel.querySelector('.owner-chart-hover-target')).not.toBeInTheDocument();
    await userEvent.click(within(chartPanel).getByRole('button', { name: /Món bán chạy/i }));
    expect(within(chartPanel).getAllByText(/Lau nam/i).length).toBeGreaterThan(0);

    expect(screen.getByTestId('owner-revenue-export-panel')).toBeInTheDocument();
  });

  it('filters the demo-style revenue table, exports reports, and expands bill details inline', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:revenue-report');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchorClicks: string[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        vi.spyOn(element, 'click').mockImplementation(() => {
          anchorClicks.push((element as HTMLAnchorElement).download);
        });
      }
      return element;
    });
    const orders: Order[] = [
      {
        id: 'BILL-001',
        tableNumber: 5,
        items: [
          { nameVi: 'Lau thai hai san', category: 'Lau', price: 189000, quantity: 1 },
          { nameVi: 'Bo My', category: 'Mon nhung', price: 89000, quantity: 2 },
        ],
        status: 'completed',
        totalPrice: 367000,
        paymentMethod: 'MoMo',
        paymentToken: 'PAY-202607-AB12',
        createdAt: '2026-07-06T12:30:00.000Z',
        updatedAt: '2026-07-06T13:00:00.000Z',
      },
      {
        id: 'BILL-OLD',
        tableNumber: 1,
        items: [{ nameVi: 'Kem dua', category: 'Trang mieng', price: 30000, quantity: 1 }],
        status: 'completed',
        totalPrice: 30000,
        paymentMethod: 'Tien mat',
        createdAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'BILL-PENDING',
        tableNumber: 2,
        items: [{ nameVi: 'Tra da', category: 'Do uong', price: 10000, quantity: 1 }],
        status: 'pending',
        totalPrice: 10000,
        createdAt: '2026-07-06T10:00:00.000Z',
      },
    ] as Order[];
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: orders });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    const workspace = await screen.findByTestId('owner-tablet-workspace');
    const rail = within(workspace).getByTestId('owner-left-category-rail');
    await userEvent.click(within(rail).getByRole('button', { name: /Doanh thu/i }));
    const chartPanel = screen.getByTestId('owner-revenue-chart-panel');
    const exportPanel = screen.getByTestId('owner-revenue-export-panel');
    expect(exportPanel.querySelector('.owner-revenue-export-buttons')).not.toBeInTheDocument();

    expect(screen.getByText('BILL-001')).toBeInTheDocument();
    expect(screen.queryByText('BILL-OLD')).not.toBeInTheDocument();
    expect(screen.queryByText('BILL-PENDING')).not.toBeInTheDocument();

    await userEvent.selectOptions(within(chartPanel).getByRole('combobox', { name: /Khoảng thời gian/i }), 'today');
    expect(screen.getByText('BILL-001')).toBeInTheDocument();
    await userEvent.click(within(chartPanel).getByRole('button', { name: /Xuất Excel biểu đồ/i }));
    expect(anchorClicks).toEqual(['owner-revenue-bar-demos-today.csv']);

    const toggleButton = screen.getByRole('button', { name: /Mở chi tiết BILL-001/i });
    await userEvent.click(toggleButton);
    const detailRow = screen.getByTestId('revenue-details-BILL-001');
    expect(detailRow).toBeInTheDocument();
    expect(within(detailRow).getByText(/Chi tiết bill BILL-001/i)).toBeInTheDocument();
    expect(within(detailRow).getByText(/Bo My/i)).toBeInTheDocument();
    expect(within(detailRow).getByText(/Mon nhung/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Đóng chi tiết BILL-001/i }));
    expect(screen.queryByTestId('revenue-details-BILL-001')).not.toBeInTheDocument();

    expect(within(chartPanel).getByRole('combobox', { name: /Khoảng thời gian/i })).toHaveValue('today');

    expect(within(exportPanel).queryByRole('button', { name: /^Doanh thu$/i })).not.toBeInTheDocument();
    expect(anchorClicks).toEqual(['owner-revenue-bar-demos-today.csv']);
    expect(createObjectUrl).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:revenue-report');
  });

  it('shows tablet service requests as table notes in the owner order board', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    localStorage.setItem(
      'smart-menu-service-requests',
      JSON.stringify([
        {
          id: 'service-note-1',
          tableNumber: 8,
          label: 'Yeu cau hoa don',
          message: 'Da gui: Yeu cau hoa don.',
          createdAt: '2026-07-07T10:00:00.000Z',
        },
      ]),
    );
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    const workspace = await screen.findByTestId('owner-tablet-workspace');
    const rail = within(workspace).getByTestId('owner-left-category-rail');
    await userEvent.click(within(rail).getAllByRole('button')[2]);

    const notes = screen.getByTestId('owner-service-request-notes');
    expect(notes).toHaveTextContent('8');
    expect(notes).toHaveTextContent(/Yeu cau hoa don/i);
    expect(notes).toHaveTextContent(/Da gui: Yeu cau hoa don/i);
    const orderServiceCard = screen.getByTestId('owner-service-request-order-card-8');
    expect(orderServiceCard).toHaveClass('order-card');
    expect(orderServiceCard).toHaveTextContent(/Yeu cau hoa don/i);
  });

  it('receives tablet service requests from another dev port and pins them to the right table', async () => {
    vi.stubEnv('MODE', 'owner');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token-1');
    vi.mocked(ownerApi.getRestaurant).mockResolvedValue({ success: true, message: 'ok', data: restaurant });
    vi.mocked(ownerApi.getMenus).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getOrders).mockResolvedValue({ success: true, message: 'ok', data: [] });
    vi.mocked(ownerApi.getItems).mockResolvedValue({ success: true, message: 'ok', data: [] });

    render(<App />);

    const workspace = await screen.findByTestId('owner-tablet-workspace');
    const rail = within(workspace).getByTestId('owner-left-category-rail');
    await userEvent.click(within(rail).getAllByRole('button')[2]);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'http://127.0.0.1:5174',
        data: {
          type: 'smart-menu-service-request',
          note: {
            id: 'service-note-2',
            tableNumber: 2,
            label: 'Goi nhan vien',
            message: 'Da gui: Goi nhan vien.',
            createdAt: '2026-07-07T10:05:00.000Z',
          },
        },
      }));
    });

    const orderServiceCard = await screen.findByTestId('owner-service-request-order-card-2');
    expect(orderServiceCard).toHaveTextContent(/Goi nhan vien/i);
    expect(orderServiceCard).toHaveTextContent('2');
  });
});
