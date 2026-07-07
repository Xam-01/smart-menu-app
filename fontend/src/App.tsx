import { Fragment, useEffect, useMemo, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { ACCESS_TOKEN_KEY, ApiError, authApi, ownerApi, tabletApi } from './lib/api';
import { addItemToCart, getCartTotal, toOrderPayload, updateCartQuantity } from './lib/cart';
import {
  buildCategoryRevenueChartData,
  getCheckoutTransitionPath,
  buildOrderCountChartData,
  buildPaymentMethodChartData,
  buildPeakHourChartData,
  buildRevenueChartData,
  buildRevenueTableRows,
  buildTablePerformanceChartData,
  buildTopDishesChartData,
  enrichOrdersWithMenuCatalog,
  filterPaidOrdersByDateRange,
  groupOrdersByTable,
  isClosedOrderStatus,
  type RevenueChartDataPoint,
  type RevenueDateRange,
  type RevenueTableRow,
} from './lib/dashboard';
import {
  ALLERGEN_OPTIONS,
  CATEGORIES,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABEL,
} from './lib/constants';
import { formatDateTime, formatVnd } from './lib/format';
import { shouldHideForAllergens } from './lib/menu';
import { getTabletTableUrl, parseQrPayload } from './lib/qr';
import {
  getLocalizedAllergenLabel,
  getLocalizedCategory,
  getLocalizedOrderStatus,
  getLocalizedRiskLabel,
  getTabletCopy,
  TABLET_LANGUAGES,
} from './lib/tabletI18n';
import type {
  AllergenTag,
  AllergenType,
  CartItem,
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
} from './lib/types';

const SESSION_KEY = 'smart-menu-tablet-session';
const CART_KEY = 'smart-menu-tablet-cart';
const MAX_CART_QUANTITY = 20;
const TABLET_SERVICE_SECTION = '__tablet_service__';
const SERVICE_REQUESTS_KEY = 'smart-menu-service-requests';
const SERVICE_REQUEST_EVENT = 'smart-menu-service-request';
const FALLBACK_DISH_IMAGES: Record<string, string> = {
  'Khai vị': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
  'Món chính': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=80',
  'Tráng miệng': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80',
  'Đồ uống': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=900&q=80',
};
type OwnerSection = 'menu' | 'tables' | 'orders' | 'revenue';
type ServiceRequestNote = {
  id: string;
  tableNumber: number;
  label: string;
  message: string;
  createdAt: string;
};

export default function App() {
  const mode = getAppMode();

  return mode === 'owner' ? <OwnerDashboard /> : <TabletApp />;
}

function getAppMode() {
  if (import.meta.env.MODE === 'owner' || import.meta.env.MODE === 'tablet') {
    return import.meta.env.MODE;
  }

  return window.location.port === '5173' ? 'owner' : 'tablet';
}

function getDishImageUrl(item: PublicMenuItem) {
  return item.imageUrl || FALLBACK_DISH_IMAGES[item.category] || FALLBACK_DISH_IMAGES.default;
}

function getCategoryOrder(category: string) {
  const index = CATEGORIES.findIndex((candidate) => candidate === category);
  return index === -1 ? CATEGORIES.length : index;
}

function sortMenuCategoryEntries<T>(entries: Array<readonly [string, T]>) {
  return [...entries].sort(([categoryA], [categoryB]) => {
    const orderDifference = getCategoryOrder(categoryA) - getCategoryOrder(categoryB);
    if (orderDifference !== 0) return orderDifference;
    return categoryA.localeCompare(categoryB, 'vi');
  });
}

function isServiceRequestNote(value: unknown): value is ServiceRequestNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<ServiceRequestNote>;
  return (
    typeof note.id === 'string' &&
    typeof note.tableNumber === 'number' &&
    typeof note.label === 'string' &&
    typeof note.message === 'string' &&
    typeof note.createdAt === 'string'
  );
}

function readServiceRequestNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SERVICE_REQUESTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isServiceRequestNote) : [];
  } catch {
    return [];
  }
}

function buildServiceRequestMessage(label: string) {
  return `Đã gửi: ${label}. Đã gửi yêu cầu ${label.toLocaleLowerCase('vi-VN')}.`;
}

function mergeServiceRequestNote(note: ServiceRequestNote, notes = readServiceRequestNotes()) {
  return [note, ...notes.filter((current) => current.id !== note.id)].slice(0, 50);
}

function readServiceRequestMessage(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const message = data as { type?: unknown; note?: unknown };
  return message.type === SERVICE_REQUEST_EVENT && isServiceRequestNote(message.note) ? message.note : null;
}

function isAllowedServiceRequestOrigin(origin: string) {
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    return source.hostname === window.location.hostname || (
      localHosts.has(source.hostname) && localHosts.has(window.location.hostname)
    );
  } catch {
    return false;
  }
}

function postServiceRequestToOwner(note: ServiceRequestNote) {
  if (!window.opener || window.opener === window) return;
  try {
    const ownerOrigin = import.meta.env.VITE_OWNER_ORIGIN || `${window.location.protocol}//${window.location.hostname}:5173`;
    window.opener.postMessage({ type: SERVICE_REQUEST_EVENT, note }, ownerOrigin);
  } catch {
    // A manually opened tablet window has no owner opener to notify.
  }
}

function saveServiceRequestNote(note: ServiceRequestNote, options: { notifyOwner?: boolean } = {}) {
  const nextNotes = mergeServiceRequestNote(note);
  localStorage.setItem(SERVICE_REQUESTS_KEY, JSON.stringify(nextNotes));
  window.dispatchEvent(new CustomEvent<ServiceRequestNote>(SERVICE_REQUEST_EVENT, { detail: note }));
  if (options.notifyOwner !== false) postServiceRequestToOwner(note);
  return nextNotes;
}

function BusyMark({ size = 'normal' }: { size?: 'normal' | 'small' }) {
  return <span className={`busy-mark ${size}`} aria-hidden="true" />;
}

async function fetchOwnerOrders(query: { status?: string } = {}) {
  const firstPage = await ownerApi.getOrders({ ...query, page: 1, limit: 50 });
  const totalPages = Number(firstPage.meta?.totalPages ?? 1);
  if (totalPages <= 1) return firstPage.data;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      ownerApi.getOrders({ ...query, page: index + 2, limit: 50 }),
    ),
  );

  return [...firstPage.data, ...rest.flatMap((response) => response.data)];
}

function OwnerDashboard() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [items, setItems] = useState<OwnerMenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestNote[]>(() => readServiceRequestNotes());
  const [statusFilter, setStatusFilter] = useState('');
  const [activeSection, setActiveSection] = useState<OwnerSection>('menu');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) {
      setLoading(false);
      return;
    }

    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        await refreshOwnerData();
      } catch (err) {
        if (!ignore) setError(readError(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function syncServiceRequests() {
      setServiceRequests(readServiceRequestNotes());
    }

    function receiveServiceRequest(event: MessageEvent) {
      if (!isAllowedServiceRequestOrigin(event.origin)) return;
      const note = readServiceRequestMessage(event.data);
      if (!note) return;
      const nextNotes = saveServiceRequestNote(note, { notifyOwner: false });
      setServiceRequests(nextNotes);
    }

    syncServiceRequests();
    window.addEventListener('storage', syncServiceRequests);
    window.addEventListener(SERVICE_REQUEST_EVENT, syncServiceRequests);
    window.addEventListener('message', receiveServiceRequest);
    return () => {
      window.removeEventListener('storage', syncServiceRequests);
      window.removeEventListener(SERVICE_REQUEST_EVENT, syncServiceRequests);
      window.removeEventListener('message', receiveServiceRequest);
    };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return;

    let ignore = false;
    async function loadOrders() {
      try {
        const nextOrders = await fetchOwnerOrders({
          status: statusFilter || undefined,
        });
        if (!ignore) setOrders(nextOrders);
      } catch (err) {
        if (!ignore) setError(readError(err));
      }
    }

    loadOrders();
    const timer = window.setInterval(loadOrders, 10000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedMenuId) {
      setItems([]);
      return;
    }

    let ignore = false;
    ownerApi
      .getItems(selectedMenuId)
      .then((response) => {
        if (!ignore) setItems(response.data);
      })
      .catch((err) => {
        if (!ignore) setError(readError(err));
      });

    return () => {
      ignore = true;
    };
  }, [selectedMenuId]);

  async function refreshOwnerData() {
    const [restaurantResult, menusResult, ordersResult] = await Promise.allSettled([
      ownerApi.getRestaurant(),
      ownerApi.getMenus(),
      fetchOwnerOrders(),
    ]);

    if (restaurantResult.status === 'fulfilled') setRestaurant(restaurantResult.value.data);
    if (menusResult.status === 'fulfilled') {
      setMenus(menusResult.value.data);
      setSelectedMenuId((current) => current || menusResult.value.data[0]?.id || '');
    }
    if (ordersResult.status === 'fulfilled') setOrders(ordersResult.value);
  }

  async function handleAuthed(result: { accessToken: string; owner: Owner }) {
    localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    setOwner(result.owner);
    setError('');
    setLoading(true);
    try {
      await refreshOwnerData();
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setOwner(null);
    setRestaurant(null);
    setMenus([]);
    setItems([]);
    setOrders([]);
    setServiceRequests([]);
  }

  if (!localStorage.getItem(ACCESS_TOKEN_KEY)) {
    return (
      <OwnerShell owner={owner} onLogout={logout}>
        <AuthPanel onAuthed={handleAuthed} />
      </OwnerShell>
    );
  }

  return (
    <OwnerShell owner={owner} onLogout={logout}>
      <StatusBanner message={message} error={error} onClear={() => {
        setMessage('');
        setError('');
      }} />

      {loading ? (
        <LoadingState label="Đang tải dashboard" />
      ) : (
        <div className="owner-workspace owner-tablet-workspace" data-testid="owner-tablet-workspace">
          <div className="owner-left-category-rail" data-testid="owner-left-category-rail">
            <OwnerSectionNav activeSection={activeSection} onSelect={setActiveSection} />
          </div>
          <div className="owner-content-workspace" data-testid="owner-content-workspace">
            <div className="owner-grid">
          <section
            className="owner-menu-panel span-2"
            data-testid="owner-menu-panel"
            hidden={activeSection !== 'menu'}
          >
            <div className="owner-grid">
              <section className="panel">
                {restaurant ? (
                  <RestaurantSummary restaurant={restaurant} onUpdated={(next) => setRestaurant(next)} />
                ) : (
                  <RestaurantCreateForm
                    onCreated={(next) => {
                      setRestaurant(next);
                      setMessage('Đã tạo nhà hàng');
                    }}
                  />
                )}
              </section>
              <section className="panel">
                <MenuManager
                  menus={menus}
                  selectedMenuId={selectedMenuId}
                  items={items}
                  onSelectMenu={setSelectedMenuId}
                  onMenusChanged={async () => {
                    const response = await ownerApi.getMenus();
                    setMenus(response.data);
                    setSelectedMenuId(response.data[0]?.id || '');
                  }}
                  onItemsChanged={async () => {
                    if (!selectedMenuId) return;
                    const response = await ownerApi.getItems(selectedMenuId);
                    setItems(response.data);
                  }}
                  onMessage={setMessage}
                  onError={setError}
                />
              </section>
            </div>
          </section>

          <section className="panel" hidden={activeSection !== 'tables'}>
            <TableAccessBoard
              restaurant={restaurant}
              onMessage={setMessage}
              onError={setError}
              onRestaurantChanged={(next) => setRestaurant(next)}
            />
          </section>

          <section className="panel span-2" hidden={activeSection !== 'orders'}>
            <OrdersBoard
              orders={orders}
              serviceRequests={serviceRequests}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              onMessage={setMessage}
              onUpdated={async () => {
                const nextOrders = await fetchOwnerOrders({
                  status: statusFilter || undefined,
                });
                setOrders(nextOrders);
              }}
              onError={setError}
            />
          </section>

          <section className="panel span-2" hidden={activeSection !== 'revenue'}>
            <RevenueBoard orders={orders} items={items} />
          </section>
            </div>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}

function OwnerShell({
  children,
  owner,
  onLogout,
}: {
  children: React.ReactNode;
  owner: Owner | null;
  onLogout: () => void;
}) {
  return (
    <div className="app owner-app design-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark-text">SM</span>
          <div>
            <strong>SmartMenu vận hành</strong>
            <span>Bảng điều khiển nhà hàng</span>
          </div>
        </div>
        <div className="topbar-actions">
          {owner ? <span className="muted">{owner.email}</span> : null}
          {localStorage.getItem(ACCESS_TOKEN_KEY) ? (
            <button className="secondary-button compact" onClick={onLogout}>
              Đăng xuất
            </button>
          ) : null}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function OwnerSectionNav({
  activeSection,
  onSelect,
}: {
  activeSection: OwnerSection;
  onSelect: (section: OwnerSection) => void;
}) {
  const sections: Array<{ id: OwnerSection; label: string }> = [
    { id: 'menu', label: 'Menu và món' },
    { id: 'tables', label: 'Tablet bàn' },
    { id: 'orders', label: 'Đơn theo bàn' },
    { id: 'revenue', label: 'Doanh thu' },
  ];

  return (
    <nav className="owner-section-nav" aria-label="Mục quản lý">
      {sections.map((section) => (
        <button
          key={section.id}
          className={activeSection === section.id ? 'active' : ''}
          onClick={() => onSelect(section.id)}
          type="button"
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}


function AuthPanel({ onAuthed }: { onAuthed: (result: { accessToken: string; owner: Owner }) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response =
        mode === 'login'
          ? await authApi.login(email, password)
          : await authApi.register(email, password);
      onAuthed(response.data);
    } catch (err) {
      setError(readError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <span className="feature-kicker">Owner Console</span>
        <h1>Quản lý menu, bàn và đơn gọi món</h1>
        <p>
          Quản lý menu, bàn và đơn gọi món trong một màn hình gọn hơn. Tablet của khách chỉ mở
          đúng menu của nhà hàng và bàn đã chọn.
        </p>
      </div>
      <form className="panel auth-panel" onSubmit={submit}>
        <div className="segmented">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Đăng ký
          </button>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          Mật khẩu
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={8}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" disabled={submitting}>
          {submitting ? <BusyMark size="small" /> : null}
          {mode === 'login' ? 'Vào màn chủ quán' : 'Tạo tài khoản chủ quán'}
        </button>
      </form>
    </section>
  );
}

function RestaurantCreateForm({ onCreated }: { onCreated: (restaurant: Restaurant) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [tableCount, setTableCount] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await ownerApi.createRestaurant({
        name,
        address,
        phone,
        tableCount,
      });
      onCreated(response.data);
    } catch (err) {
      setError(readError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div>
        <h2>Tạo hồ sơ nhà hàng</h2>
        <p className="muted">Nhà hàng và số bàn là dữ liệu gốc để tạo liên kết gọi món tại từng bàn.</p>
      </div>
      <label>
        Tên nhà hàng
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Địa chỉ
        <input value={address} onChange={(event) => setAddress(event.target.value)} required />
      </label>
      <label>
        Số điện thoại
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label>
        Số bàn
        <input
          value={tableCount}
          onChange={(event) => setTableCount(Number(event.target.value))}
          min={1}
          max={200}
          type="number"
          required
        />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="primary-button" disabled={submitting}>
        {submitting ? <BusyMark size="small" /> : null}
        Tạo nhà hàng
      </button>
    </form>
  );
}

function RestaurantSummary({
  restaurant,
  onUpdated,
}: {
  restaurant: Restaurant;
  onUpdated: (restaurant: Restaurant) => void;
}) {
  const [status, setStatus] = useState(restaurant.status);
  const [saving, setSaving] = useState(false);

  async function saveStatus() {
    setSaving(true);
    try {
      const response = await ownerApi.updateRestaurant(restaurant.id, { status });
      onUpdated({ ...restaurant, ...response.data });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="summary-row">
      <div>
        <div className="eyebrow">Nhà hàng</div>
        <h2>{restaurant.name}</h2>
        <p>{restaurant.address}</p>
        <p className="muted">
          {restaurant.tableCount} bàn · {restaurant.phone || 'Chưa có số điện thoại'}
        </p>
      </div>
      <div className="status-editor">
        <label>
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value as Restaurant['status'])}>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ngưng</option>
            <option value="suspended">Bị khóa</option>
          </select>
        </label>
        <button className="secondary-button" onClick={saveStatus} disabled={saving || status === restaurant.status}>
          {saving ? <BusyMark size="small" /> : null}
          Lưu trạng thái
        </button>
      </div>
    </div>
  );
}

function MenuManager({
  menus,
  selectedMenuId,
  items,
  onSelectMenu,
  onMenusChanged,
  onItemsChanged,
  onMessage,
  onError,
}: {
  menus: Menu[];
  selectedMenuId: string;
  items: OwnerMenuItem[];
  onSelectMenu: (id: string) => void;
  onMenusChanged: () => Promise<void>;
  onItemsChanged: () => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [savingAllergenItemId, setSavingAllergenItemId] = useState('');
  const [form, setForm] = useState({
    nameVi: '',
    descVi: '',
    price: 50000,
    category: 'Món chính' as MenuItemCategory,
    imageUrl: '',
  });
  const selectedMenu = menus.find((menu) => menu.id === selectedMenuId);
  const [menuForm, setMenuForm] = useState({ name: '', imageUrl: '' });

  useEffect(() => {
    setMenuForm({
      name: selectedMenu?.name ?? `Menu v${selectedMenu?.version ?? ''}`.trim(),
      imageUrl: selectedMenu?.imageUrl ?? '',
    });
  }, [selectedMenu?.id, selectedMenu?.name, selectedMenu?.imageUrl, selectedMenu?.version]);

  async function uploadMenu() {
    try {
      await ownerApi.uploadMenu({ name: 'Menu mới' });
      await onMenusChanged();
      onMessage('Đã tạo bản menu draft');
    } catch (err) {
      onError(readError(err));
    }
  }

  async function saveMenuDetails() {
    if (!selectedMenuId) return;
    try {
      await ownerApi.updateMenu(selectedMenuId, {
        name: menuForm.name.trim(),
        imageUrl: menuForm.imageUrl,
      });
      await onMenusChanged();
      onMessage('Đã cập nhật menu');
    } catch (err) {
      onError(readError(err));
    }
  }

  async function publishMenu() {
    if (!selectedMenuId) return;
    const unverifiedCount = items.filter((item) => !item.allergenVerified).length;
    if (
      unverifiedCount > 0 &&
      !window.confirm(`${unverifiedCount} món chưa xác nhận dị ứng. Bạn vẫn muốn publish menu?`)
    ) {
      return;
    }

    try {
      await ownerApi.publishMenu(selectedMenuId);
      await onMenusChanged();
      onMessage('Đã publish menu');
    } catch (err) {
      onError(readError(err));
    }
  }

  async function updateItemAllergens(item: OwnerMenuItem, allergenTags: AllergenTag[], verified: boolean) {
    if (!selectedMenuId) return;
    setSavingAllergenItemId(item.id);
    try {
      await ownerApi.updateAllergens(selectedMenuId, item.id, allergenTags, verified);
      await onItemsChanged();
      onMessage(verified ? 'Đã xác nhận dị ứng cho món' : 'Đã lưu tag dị ứng');
    } catch (err) {
      onError(readError(err));
    } finally {
      setSavingAllergenItemId('');
    }
  }

  function toggleAllergen(item: OwnerMenuItem, allergen: AllergenType) {
    const exists = item.allergenTags.some((tag) => tag.allergen === allergen);
    const nextTags = exists
      ? item.allergenTags.filter((tag) => tag.allergen !== allergen)
      : [
          ...item.allergenTags,
          { allergen, confidence: 'contains', source: 'owner_verified' } satisfies AllergenTag,
        ];
    updateItemAllergens(item, nextTags, false);
  }

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMenuId) return;
    if (!form.nameVi.trim() || form.price < 1) {
      onError('Vui lòng nhập tên món và giá hợp lệ');
      return;
    }
    try {
      const response = await ownerApi.createItem(selectedMenuId, {
        ...form,
        nameVi: form.nameVi.trim(),
        descVi: form.descVi.trim(),
      });
      setForm({ nameVi: '', descVi: '', price: 50000, category: 'Món chính', imageUrl: '' });
      if (response.data) {
        // Optimistic render from backend response; refresh below keeps server truth.
        onMessage('Đã thêm món');
      }
      await onItemsChanged();
    } catch (err) {
      onError(readError(err));
    }
  }

  async function updateItemStatus(item: OwnerMenuItem, status: OwnerMenuItem['status']) {
    if (!selectedMenuId) return;
    try {
      await ownerApi.updateItem(selectedMenuId, item.id, { status });
      await onItemsChanged();
    } catch (err) {
      onError(readError(err));
    }
  }

  async function updateItemImage(item: OwnerMenuItem, file: File | null) {
    if (!selectedMenuId || !file) return;
    try {
      const imageUrl = await readImageFile(file);
      await ownerApi.updateItem(selectedMenuId, item.id, { imageUrl });
      await onItemsChanged();
      onMessage('Đã cập nhật ảnh món ăn');
    } catch (err) {
      onError(readError(err));
    }
  }

  async function setFormImage(file: File | null) {
    if (!file) return;
    try {
      setForm({ ...form, imageUrl: await readImageFile(file) });
    } catch (err) {
      onError(readError(err));
    }
  }

  async function setMenuImage(file: File | null) {
    if (!file) return;
    try {
      setMenuForm({ ...menuForm, imageUrl: await readImageFile(file) });
    } catch (err) {
      onError(readError(err));
    }
  }

  async function deleteSelectedMenu() {
    if (!selectedMenu) return;
    const confirmed = window.confirm(
      selectedMenu.status === 'published'
        ? `Menu v${selectedMenu.version} đang publish. Xóa sẽ chuyển menu sang lưu trữ. Tiếp tục?`
        : `Xóa menu v${selectedMenu.version} và toàn bộ món trong menu này?`,
    );
    if (!confirmed) return;

    try {
      await ownerApi.deleteMenu(selectedMenu.id);
      await onMenusChanged();
      onMessage(selectedMenu.status === 'published' ? 'Đã lưu trữ menu đang publish' : 'Đã xóa menu');
    } catch (err) {
      onError(readError(err));
    }
  }

  async function deleteItem(item: OwnerMenuItem) {
    if (!selectedMenuId) return;
    if (!window.confirm(`Xóa món "${item.nameVi}" khỏi menu?`)) return;

    try {
      await ownerApi.deleteItem(selectedMenuId, item.id);
      await onItemsChanged();
      onMessage('Đã xóa món');
    } catch (err) {
      onError(readError(err));
    }
  }

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Menu và món</h2>
          <p className="muted"></p>
        </div>
        <button className="secondary-button" onClick={uploadMenu}>
          Tạo menu
        </button>
      </div>
      <input
        hidden
        placeholder="imagePath tùy chọn cho /menus/upload"
        value=""
        readOnly
      />
      <div className="menu-tabs">
        {menus.length === 0 ? <span className="muted">Chưa có menu</span> : null}
        {menus.map((menu) => (
          <button
            key={menu.id}
            className={menu.id === selectedMenuId ? 'active' : ''}
            onClick={() => onSelectMenu(menu.id)}
          >
            {menu.name ?? `Menu v${menu.version}`} · {menu.status}
          </button>
        ))}
      </div>
      {selectedMenu ? (
        <div className="menu-detail-editor">
          <label>
            Tên menu
            <input
              value={menuForm.name}
              onChange={(event) => setMenuForm({ ...menuForm, name: event.target.value })}
              placeholder="Ví dụ: Menu tối cuối tuần"
            />
          </label>
          <label className="file-upload compact">
            Ảnh menu
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setMenuImage(event.target.files?.[0] ?? null)}
            />
          </label>
          {menuForm.imageUrl ? (
            <img className="menu-cover-preview" src={menuForm.imageUrl} alt={menuForm.name || 'Ảnh menu'} />
          ) : null}
          <button className="secondary-button compact" onClick={saveMenuDetails}>
            Lưu menu
          </button>
        </div>
      ) : null}
      {selectedMenu ? (
        <div className="menu-actions">
          <button
            className="primary-button"
            onClick={publishMenu}
            disabled={selectedMenu.status !== 'draft'}
          >
            Publish menu v{selectedMenu.version}
          </button>
          <button className="danger-button" onClick={deleteSelectedMenu}>
            Xóa menu
          </button>
        </div>
      ) : null}
      <form className="item-form" onSubmit={createItem}>
        <input
          placeholder="Tên món"
          value={form.nameVi}
          onChange={(event) => setForm({ ...form, nameVi: event.target.value })}
          required
        />
        <input
          placeholder="Mô tả"
          value={form.descVi}
          onChange={(event) => setForm({ ...form, descVi: event.target.value })}
        />
        <input
          type="number"
          min={1}
          max={10000000}
          value={form.price}
          onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
        />
        <select
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value as MenuItemCategory })}
        >
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <label className="file-upload compact">
          Ảnh
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFormImage(event.target.files?.[0] ?? null)}
          />
        </label>
        {form.imageUrl ? <img className="menu-cover-preview compact" src={form.imageUrl} alt={form.nameVi || 'Ảnh món mới'} /> : null}
        <button className="secondary-button" disabled={!selectedMenuId}>
          Thêm món
        </button>
      </form>
      <div className="owner-item-list">
        {items.map((item) => (
          <article className="owner-item" key={item.id}>
            <div className="owner-item-main">
              {item.imageUrl ? <img className="owner-item-image" src={item.imageUrl} alt={item.nameVi} /> : null}
              <div>
                <strong>{item.nameVi}</strong>
                <span>{item.category} · {formatVnd(item.price)}</span>
              </div>
              <span className={item.allergenVerified ? 'verify-pill ok' : 'verify-pill'}>
                {item.allergenVerified ? 'Dị ứng đã xác nhận' : 'Chưa xác nhận dị ứng'}
              </span>
            </div>
            <div className="owner-item-controls">
              <select
                value={item.status}
                onChange={(event) => updateItemStatus(item, event.target.value as OwnerMenuItem['status'])}
              >
                <option value="available">Đang bán</option>
                <option value="sold_out">Hết món</option>
                <option value="hidden">Ẩn khỏi tablet</option>
              </select>
              <button
                className="secondary-button compact"
                disabled={savingAllergenItemId === item.id}
                onClick={() => updateItemAllergens(item, item.allergenTags, true)}
              >
                {savingAllergenItemId === item.id ? <BusyMark size="small" /> : null}
                Xác nhận
              </button>
              <label className="file-upload compact">
                Ảnh món
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => updateItemImage(item, event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="danger-button compact" onClick={() => deleteItem(item)}>
                Xóa món
              </button>
            </div>
            <div className="owner-allergen-grid">
              {ALLERGEN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={
                    item.allergenTags.some((tag) => tag.allergen === option.value)
                      ? 'mini-chip selected'
                      : 'mini-chip'
                  }
                  onClick={() => toggleAllergen(item, option.value)}
                  disabled={savingAllergenItemId === item.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TableAccessBoard({
  restaurant,
  onMessage,
  onError,
  onRestaurantChanged,
}: {
  restaurant: Restaurant | null;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
  onRestaurantChanged: (restaurant: Restaurant) => void;
}) {
  if (!restaurant) {
    return (
      <div className="empty-state">
        <p>Tạo nhà hàng để có liên kết gọi món cho từng bàn.</p>
      </div>
    );
  }

  async function revoke(tableNumber: number) {
    try {
      const response = await ownerApi.revokeTableQr(restaurant!.id, tableNumber);
      onRestaurantChanged({
        ...restaurant!,
        tables: restaurant!.tables.map((table) =>
          table.tableNumber === tableNumber
            ? { ...table, qrCode: response.data.qrCode }
            : table,
        ),
      });
      onMessage(`Đã làm mới liên kết bàn ${tableNumber}`);
    } catch (err) {
      onError(readError(err));
    }
  }

  return (
    <div className="stack owner-revenue-analytics">
      <div className="section-heading">
        <div>
          <h2>Tablet theo bàn</h2>
          <p className="muted"></p>
        </div>
      </div>
      <div className="table-list">
        {restaurant.tables.map((table) => {
          const url = getTabletTableUrl({
            qrCode: table.qrCode,
            restaurantId: restaurant.id,
          });
          return (
            <article className="table-card" key={table.tableNumber}>
              <div className="table-card-main">
                <strong>Bàn {table.tableNumber}</strong>
                <span className={table.isActive ? 'table-state active' : 'table-state'}>{table.isActive ? 'Đang dùng' : 'Tạm tắt'}</span>
              </div>
              <div className="table-card-actions">
                <TableLaunchLink href={url} tableNumber={table.tableNumber} />
              <button className="icon-button text-icon-button" onClick={() => revoke(table.tableNumber)} title="Làm mới liên kết bàn" aria-label={`Làm mới liên kết bàn ${table.tableNumber}`}>
                ↻
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TableLaunchLink({ href, tableNumber }: { href: string; tableNumber: number }) {
  return (
    <a
      className="icon-link table-launch-link text-icon-button"
      href={href}
      target="_blank"
      rel="opener"
      aria-label={`Mở bàn ${tableNumber}`}
    >
      ↗
    </a>
  );
}

function OrdersBoard({
  orders,
  serviceRequests,
  statusFilter,
  onStatusFilter,
  onMessage,
  onUpdated,
  onError,
}: {
  orders: Order[];
  serviceRequests: ServiceRequestNote[];
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onMessage: (message: string) => void;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const tableGroups = useMemo(() => {
    const orderGroups = groupOrdersByTable(orders);
    const groupedTables = new Set(orderGroups.map((group) => group.tableNumber));
    const serviceOnlyGroups = Array.from(new Set(serviceRequests.map((note) => note.tableNumber)))
      .filter((tableNumber) => !groupedTables.has(tableNumber))
      .map((tableNumber) => ({
        tableNumber,
        orders: [],
        openTotal: 0,
      }));

    return [...orderGroups, ...serviceOnlyGroups].sort((left, right) => left.tableNumber - right.tableNumber);
  }, [orders, serviceRequests]);
  const serviceRequestsByTable = useMemo(
    () =>
      serviceRequests.reduce<Record<number, ServiceRequestNote[]>>((groups, note) => {
        groups[note.tableNumber] = [...(groups[note.tableNumber] ?? []), note];
        return groups;
      }, {}),
    [serviceRequests],
  );
  const [checkingOutTable, setCheckingOutTable] = useState<number | null>(null);

  async function setStatus(order: Order, status: OrderStatus) {
    try {
      await ownerApi.updateOrderStatus(order.id, status);
      await onUpdated();
    } catch (err) {
      onError(readError(err));
    }
  }

  async function checkoutTable(tableNumber: number, tableOrders: Order[]) {
    const openOrders = tableOrders.filter((order) => !isClosedOrderStatus(order.status));
    if (openOrders.length === 0) return;

    setCheckingOutTable(tableNumber);
    try {
      for (const order of openOrders) {
        for (const status of getCheckoutTransitionPath(order.status)) {
          await ownerApi.updateOrderStatus(order.id, status);
        }
      }
      await onUpdated();
      onMessage(`Đã thanh toán và đóng bàn ${tableNumber}`);
    } catch (err) {
      onError(readError(err));
    } finally {
      setCheckingOutTable(null);
    }
  }

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Đơn theo bàn</h2>
          <p className="muted"></p>
        </div>
        <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([status, label]) => (
            <option key={status} value={status}>{label}</option>
          ))}
        </select>
      </div>
      <div className="table-order-board">
        {serviceRequests.length > 0 ? (
          <section className="owner-service-request-notes" data-testid="owner-service-request-notes">
            <div className="owner-service-request-notes-head">
              <strong>Thông báo phục vụ</strong>
              <span>{serviceRequests.length} request đang theo bàn</span>
            </div>
            <div className="owner-service-request-note-grid">
              {serviceRequests.slice(0, 12).map((note) => (
                <article className="owner-service-request-note" key={note.id}>
                  <div>
                    <strong>Bàn {note.tableNumber}</strong>
                    <span>{formatDateTime(note.createdAt)}</span>
                  </div>
                  <p>{note.label}</p>
                  <small>{note.message}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {tableGroups.length === 0 && serviceRequests.length === 0 ? (
          <div className="empty-state">
            <p>Chưa có đơn phù hợp.</p>
          </div>
        ) : null}
        {tableGroups.map((group) => {
          const tableServiceRequests = serviceRequestsByTable[group.tableNumber] ?? [];

          return (
          <section className="table-order-group" key={group.tableNumber}>
            <div className="table-order-head">
              <div>
                <strong>Bàn {group.tableNumber}</strong>
                <span>{group.orders.length} đơn · đang mở {formatVnd(group.openTotal)}</span>
              </div>
              <div className="table-order-tools">
                {group.orders.some((order) => order.allergyNotes) ? (
                  <span className="warning-badge">
                    Dị ứng
                  </span>
                ) : null}
                <button
                  className="primary-button compact"
                  disabled={group.openTotal === 0 || checkingOutTable === group.tableNumber}
                  onClick={() => checkoutTable(group.tableNumber, group.orders)}
                >
                  {checkingOutTable === group.tableNumber ? <BusyMark size="small" /> : null}
                  Thanh toán & đóng bàn
                </button>
              </div>
            </div>
            <div className="orders-grid">
              {tableServiceRequests.length > 0 ? (
                <article
                  className="order-card service-request-order-card"
                  data-testid={`owner-service-request-order-card-${group.tableNumber}`}
                >
                  <div className="order-card-head">
                    <strong>Thông báo phục vụ</strong>
                    <span className="status-pill pending">Bàn {group.tableNumber}</span>
                  </div>
                  <ul>
                    {tableServiceRequests.slice(0, 4).map((note) => (
                      <li key={note.id}>
                        <strong>{note.label}</strong>
                        <span>{formatDateTime(note.createdAt)}</span>
                        <small>{note.message}</small>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {group.orders.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-card-head">
                    <strong>{formatDateTime(order.createdAt)}</strong>
                    <span className={`status-pill ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                  </div>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${index}`}>
                        {item.quantity}x {item.nameVi}
                      </li>
                    ))}
                  </ul>
                  {order.allergyNotes ? <p className="warning-text">{order.allergyNotes}</p> : null}
                  {order.customerNotes ? <p className="muted">Ghi chú: {order.customerNotes}</p> : null}
                  <div className="order-actions">
                    <span>{formatVnd(order.totalPrice)}</span>
                    {(NEXT_ORDER_STATUS[order.status] ?? []).map((status) => (
                      <button key={status} onClick={() => setStatus(order, status)}>
                        {ORDER_STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}

type OwnerChartMetric = 'revenue' | 'orders' | 'dishes' | 'category' | 'payment' | 'tables' | 'hours';
type OwnerChartType = 'bar-demos' | 'pie';
type OwnerDateRange = RevenueDateRange;

const REVENUE_METRICS: Array<{ id: OwnerChartMetric; label: string }> = [
  { id: 'revenue', label: 'Doanh thu' },
  { id: 'orders', label: 'Đơn hàng' },
  { id: 'dishes', label: 'Món bán chạy' },
  { id: 'category', label: 'Danh mục món' },
  { id: 'payment', label: 'Thanh toán' },
  { id: 'tables', label: 'Hiệu suất bàn' },
  { id: 'hours', label: 'Giờ cao điểm' },
];

function RevenueBoard({ orders, items }: { orders: Order[]; items: OwnerMenuItem[] }) {
  const [selectedChartMetric, setSelectedChartMetric] = useState<OwnerChartMetric>('revenue');
  const [selectedChartType, setSelectedChartType] = useState<OwnerChartType>('bar-demos');
  const [selectedDateRange, setSelectedDateRange] = useState<OwnerDateRange>('month');
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});
  const enrichedOrders = useMemo(() => enrichOrdersWithMenuCatalog(orders, items), [orders, items]);
  const paidOrders = useMemo(
    () => filterPaidOrdersByDateRange(enrichedOrders, selectedDateRange),
    [enrichedOrders, selectedDateRange],
  );
  const revenueRows = useMemo(() => buildRevenueTableRows(paidOrders), [paidOrders]);
  const chartData = useMemo(
    () => buildRevenueAnalyticsData(paidOrders, selectedDateRange, selectedChartMetric),
    [paidOrders, selectedDateRange, selectedChartMetric],
  );
  const stats = useMemo(() => buildRevenueStats(revenueRows), [revenueRows]);
  const metricLabel = REVENUE_METRICS.find((metric) => metric.id === selectedChartMetric)?.label ?? 'Doanh thu';
  const chartTypes: Array<{ id: OwnerChartType; label: string }> = [
    { id: 'bar-demos', label: 'Bar demos' },
    { id: 'pie', label: 'Pie' },
  ];
  const ranges: Array<{ id: OwnerDateRange; label: string }> = [
    { id: 'today', label: 'Hôm nay' },
    { id: '7d', label: '7 ngày' },
    { id: '30d', label: '30 ngày' },
    { id: 'month', label: 'Tháng này' },
  ];

  function downloadCsv(csv: string, fileName: string) {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleChartExport() {
    downloadCsv(buildChartRowsExportCsv(chartData), `owner-${selectedChartMetric}-${selectedChartType}-${selectedDateRange}.csv`);
  }

  function toggleBill(row: RevenueTableRow) {
    setExpandedBills((current) => ({
      ...current,
      [row.billId]: !current[row.billId],
    }));
  }

  return (
    <div className="owner-revenue-page" data-testid="owner-revenue-page">
      <section className="owner-revenue-hero">
        <div>
          <h1>Phân tích doanh thu</h1>
        </div>
        <div className="owner-revenue-paid-pill">{stats.orderCount} đơn đã thanh toán</div>
      </section>

      <section className="owner-revenue-stats">
        {[
          { title: 'Doanh thu', value: formatVnd(stats.totalRevenue), note: 'Tổng tiền đã thanh toán' },
          { title: 'Đơn hàng', value: String(stats.orderCount), note: 'Bill thành công' },
          { title: 'Trung bình bill', value: formatVnd(stats.averageBill), note: 'Giá trị trung bình' },
          { title: 'Món đã bán', value: String(stats.itemCount), note: 'Tổng số lượng món' },
        ].map((card) => (
          <article className="owner-revenue-stat-card" key={card.title}>
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </section>

      <section className="owner-revenue-panel" data-testid="owner-revenue-chart-panel">
        <div className="owner-revenue-control-row">
          <div className="owner-revenue-tabs" role="tablist" aria-label="Nhóm phân tích doanh thu">
            {REVENUE_METRICS.map((metric) => (
              <button
                type="button"
                key={metric.id}
                className={selectedChartMetric === metric.id ? 'active' : ''}
                onClick={() => setSelectedChartMetric(metric.id)}
              >
                {metric.label}
              </button>
            ))}
          </div>
          <div className="owner-revenue-filters">
            <label>
              Loại biểu đồ
              <select
                value={selectedChartType}
                onChange={(event) => setSelectedChartType(event.target.value as OwnerChartType)}
                aria-label="Loại biểu đồ"
              >
                {chartTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </label>
            <label>
              Khoảng thời gian
              <select
                value={selectedDateRange}
                onChange={(event) => setSelectedDateRange(event.target.value as OwnerDateRange)}
                aria-label="Khoảng thời gian"
              >
                {ranges.map((range) => (
                  <option key={range.id} value={range.id}>{range.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="owner-revenue-divider" />
        <div className="owner-revenue-chart-head">
          <div>
            <h2>{metricLabel}</h2>
          </div>
          <div className="owner-revenue-chart-actions">
            <button
              type="button"
              className="owner-chart-export-button"
              onClick={handleChartExport}
              aria-label="Xuất Excel biểu đồ"
            >
              Xuất Excel
            </button>
          </div>
        </div>
        <OwnerMainChart metric={selectedChartMetric} chartType={selectedChartType} data={chartData} />
      </section>

      <section className="owner-revenue-panel" data-testid="owner-revenue-export-panel">
        <h2 className="owner-revenue-table-title">Bảng doanh thu</h2>
        <div className="revenue-report-table-wrap owner-revenue-table-wrap">
          <table className="revenue-report-table owner-revenue-report-table">
            <tbody>
              {revenueRows.map((row) => {
                const isOpen = Boolean(expandedBills[row.billId]);

                return (
                  <Fragment key={row.billId}>
                    <tr className="owner-revenue-bill-row" onClick={() => toggleBill(row)}>
                      <td>
                        <button
                          type="button"
                          className="owner-revenue-toggle"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleBill(row);
                          }}
                          aria-label={`${isOpen ? 'Đóng' : 'Mở'} chi tiết ${row.billId}`}
                        >
                          {isOpen ? '−' : '+'}
                        </button>
                      </td>
                      <td><strong>{row.billId}</strong></td>
                      <td>{row.paymentToken}</td>
                      <td>{row.tableName}</td>
                      <td>{formatDateTime(row.paidAt)}</td>
                      <td className="money">{formatVnd(row.totalAmount)}</td>
                      <td><span className="owner-revenue-chip">{row.paymentMethod}</span></td>
                      <td><span className="owner-revenue-chip success">{row.statusLabel}</span></td>
                    </tr>
                    {isOpen ? (
                      <tr className="owner-revenue-details-row" data-testid={`revenue-details-${row.billId}`}>
                        <td colSpan={8}>
                          <div className="owner-revenue-details-box">
                            <h3>Chi tiết bill {row.billId}</h3>
                            <table>
                              <thead>
                                <tr>
                                  <th>Món</th>
                                  <th>Danh mục</th>
                                  <th className="money">SL</th>
                                  <th className="money">Giá</th>
                                  <th className="money">Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.order.items.map((item, index) => (
                                  <tr key={`${row.billId}-${index}`}>
                                    <td>{item.nameVi || item.name || 'Món'}</td>
                                    <td>{item.category || 'Khác'}</td>
                                    <td className="money">{item.quantity}</td>
                                    <td className="money">{formatVnd(item.price)}</td>
                                    <td className="money">{formatVnd(item.price * item.quantity)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {revenueRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="owner-revenue-empty">Không có bill đã thanh toán trong khoảng thời gian này.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function OwnerMainChart({
  metric,
  chartType,
  data,
}: {
  metric: OwnerChartMetric;
  chartType: OwnerChartType;
  data: RevenueChartDataPoint[];
}) {
  const chartTypeLabel: Record<OwnerChartType, string> = {
    'bar-demos': '',
    pie: '',
  };
  const title = {
    revenue: 'Doanh thu theo ngày/tháng',
    orders: 'Số đơn theo ngày',
    dishes: 'Top món bán chạy',
    category: 'Doanh thu theo danh mục',
    payment: 'Tỷ lệ phương thức thanh toán',
    tables: 'Hiệu suất bàn',
    hours: 'Khung giờ cao điểm',
  }[metric];
  const pieColors = ['#8e111a', '#d7a447', '#256f5b', '#5b4b8a', '#c75c2c', '#1f5d8a', '#7a2f45'];
  const chartRows = data.map((point) => ({
    ...point,
    formatted: `${point.label}: ${point.detail}`,
  }));

  function renderChartBody() {
    if (data.length === 0) return <p className="muted">Chưa có dữ liệu phù hợp.</p>;

    if (chartType === 'pie') {
      return (
        <div className="owner-mui-chart owner-pie-chart" data-testid="owner-revenue-chart-pie" data-chart-engine="mui-x-charts">
          <PieChart
            height={340}
            colors={pieColors}
            series={[
              {
                data: data.map((point, index) => ({
                  id: `${point.label}-${index}`,
                  label: point.label,
                  value: point.value,
                })),
                valueFormatter: (item) => formatRevenueChartValue(item.value, metric),
              },
            ]}
          />
        </div>
      );
    }

    return (
      <div className="owner-mui-chart owner-bar-demos-chart" data-testid="owner-revenue-chart-bar-demos" data-chart-engine="mui-x-charts">
        <BarChart
          height={340}
          dataset={chartRows}
          colors={[pieColors[0]]}
          xAxis={[{ scaleType: 'band', dataKey: 'label' }]}
          series={[
            {
              dataKey: 'value',
              label: title,
              valueFormatter: (value) => formatRevenueChartValue(value ?? 0, metric),
            },
          ]}
          margin={{ top: 28, right: 16, bottom: 52, left: 72 }}
        />
      </div>
    );
  }

  return (
    <div className={`owner-main-chart ${chartType}`}>
      <div className="mini-heading">
        <strong>{title}</strong>
        <span>{chartTypeLabel[chartType]}</span>
      </div>
      {renderChartBody()}
    </div>
  );
}

function buildRevenueAnalyticsData(
  paidOrders: Order[],
  range: OwnerDateRange,
  metric: OwnerChartMetric,
): RevenueChartDataPoint[] {
  if (metric === 'revenue') return buildRevenueChartData(paidOrders, range);
  if (metric === 'orders') return buildOrderCountChartData(paidOrders);
  if (metric === 'dishes') return buildTopDishesChartData(paidOrders);
  if (metric === 'category') return buildCategoryRevenueChartData(paidOrders);
  if (metric === 'payment') return buildPaymentMethodChartData(paidOrders);
  if (metric === 'tables') return buildTablePerformanceChartData(paidOrders);
  return buildPeakHourChartData(paidOrders);
}

function formatRevenueChartValue(value: number, metric: OwnerChartMetric): string {
  if (metric === 'revenue' || metric === 'category' || metric === 'payment') return formatVnd(value);
  if (metric === 'dishes') return `${value} phần`;
  if (metric === 'hours') return `${value} món`;
  return `${value} đơn`;
}

function buildRevenueStats(rows: RevenueTableRow[]) {
  const totalRevenue = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const itemCount = rows.reduce(
    (sum, row) => sum + row.order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  return {
    totalRevenue,
    orderCount: rows.length,
    averageBill: rows.length === 0 ? 0 : Math.round(totalRevenue / rows.length),
    itemCount,
  };
}

function buildChartRowsExportCsv(rows: RevenueChartDataPoint[]): string {
  const csvRows = [
    ['Nhóm', 'Giá trị', 'Chi tiết'],
    ...rows.map((row) => [row.label, String(row.value), row.detail]),
  ];

  return csvRows.map((row) => row.map(escapeRevenueCsvCell).join(',')).join('\r\n');
}

function escapeRevenueCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function TabletApp() {
  const [session, setSession] = useState<Session | null>(() => readStored<Session>(SESSION_KEY));
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const storedSession = readStored<Session>(SESSION_KEY);
    return storedSession ? readStored<CartItem[]>(getTableCartKey(storedSession)) ?? [] : [];
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [allergens, setAllergens] = useState<AllergenType[]>([]);
  const [language, setLanguage] = useState('vi');
  const [customerNotes, setCustomerNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const copy = useMemo(() => getTabletCopy(language), [language]);

  useEffect(() => {
    if (!session) return;
    setCart(readStored<CartItem[]>(getTableCartKey(session)) ?? []);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    localStorage.setItem(getTableCartKey(session), JSON.stringify(cart));
  }, [cart, session]);

  useEffect(() => {
    const data = new URL(window.location.href).searchParams.get('data');
    if (!data) return;

    const scanUrl = `${window.location.origin}/scan?data=${data}`;
    try {
      const payload = parseQrPayload(scanUrl);
      if (
        session?.restaurantId === payload.restaurantId &&
        session.tableNumber === payload.tableNumber
      ) {
        return;
      }
      localStorage.removeItem(SESSION_KEY);
      startSession(scanUrl);
    } catch (err) {
      setError(readError(err));
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;

    let ignore = false;
    const activeSession = session;
    async function load() {
      setLoading(true);
      try {
        const [menuResponse, orderResponse] = await Promise.all([
          tabletApi.getPublicMenu(activeSession.restaurantId, activeSession.sessionId, language),
          tabletApi.getSessionOrders(activeSession.sessionId),
        ]);
        if (!ignore) {
          setMenu(menuResponse.data);
          setOrders(orderResponse.data);
          setAllergens(menuResponse.data.guestAllergens);
        }
      } catch (err) {
        if (!ignore) setError(readError(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [session, language]);

  async function startSession(qrInput: string) {
    setLoading(true);
    setError('');
    try {
      const payload = parseQrPayload(qrInput);
      const response = await tabletApi.createSession(payload);
      const nextCart = readStored<CartItem[]>(getTableCartKey(response.data)) ?? [];
      localStorage.setItem(SESSION_KEY, JSON.stringify(response.data));
      setCart(nextCart);
      setSession(response.data);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveAllergens(next: AllergenType[]) {
    if (!session) return;
    setAllergens(next);
    try {
      await tabletApi.updateAllergens(session.sessionId, next, []);
      const response = await tabletApi.getPublicMenu(session.restaurantId, session.sessionId, language);
      setMenu(response.data);
    } catch (err) {
      setError(readError(err));
    }
  }

  async function submitOrder() {
    if (!session || cart.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const response = await tabletApi.createOrder(toOrderPayload(session.sessionId, cart, customerNotes));
      setOrders([response.data, ...orders]);
      setCart([]);
      setCustomerNotes('');
      setMessage('Đã gửi đơn cho quán');
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function payCash() {
    if (!session) return;
    if (cart.length > 0 && !window.confirm('Giỏ còn món chưa gửi. Thanh toán tiền mặt các đơn đã gửi?')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await tabletApi.cashPayment(session.sessionId);
      setOrders(response.data);
      setCart([]);
      setCustomerNotes('');
      setMessage('Đã thanh toán tiền mặt');
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  function resetTablet() {
    if (session) localStorage.removeItem(getTableCartKey(session));
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setMenu(null);
    setCart([]);
    setOrders([]);
    setAllergens([]);
  }

  if (!session) {
    return (
      <div className="app tablet-app design-shell">
        <TabletWelcome onStart={startSession} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <div className="app tablet-app design-shell">
      <header className="tablet-header">
        <div className="tablet-title">
          <span className="eyebrow">{copy.table} {session.tableNumber}</span>
          <h1>{menu?.restaurant.name ?? 'SmartMenu'}</h1>
          {menu?.restaurant.address ? <p>{menu.restaurant.address}</p> : null}
        </div>
        <button className="icon-button tablet-reset-button text-icon-button" onClick={resetTablet} title={copy.resetTablet} aria-label={copy.resetTablet}>
          ↻
        </button>
        <TabletHeaderControls
          language={language}
          onLanguageChange={setLanguage}
          allergens={allergens}
          onAllergensChange={saveAllergens}
        />
      </header>
      <StatusBanner message={message} error={error} onClear={() => {
        setMessage('');
        setError('');
      }} />
      {loading && !menu ? <LoadingState label={copy.loadingMenu} /> : null}
      {menu ? (
        <TabletKioskBoard
          menu={menu}
          session={session}
          cart={cart}
          customerNotes={customerNotes}
          orders={orders}
          loading={loading}
          language={language}
          selectedAllergens={allergens}
          onAdd={(item) => setCart(addItemToCart(cart, item))}
          onNotesChange={setCustomerNotes}
          onQuantityChange={(id, quantity) => setCart(updateCartQuantity(cart, id, quantity))}
          onSubmit={submitOrder}
          onCashPayment={payCash}
          tableNumber={session.tableNumber}
        />
      ) : null}
    </div>
  );
}

function TabletWelcome({
  onStart,
  loading,
  error,
}: {
  onStart: (qrInput: string) => void;
  loading: boolean;
  error: string;
}) {
  const [qrInput, setQrInput] = useState('');

  return (
    <main className="welcome-screen">
      <div className="welcome-art">
      </div>
      <section className="panel tablet-start">
        <span className="eyebrow">SmartMenu tại bàn</span>
        <h1>Chọn món tại bàn</h1>
        <p>
          Mở liên kết bàn từ màn chủ quán để khách xem menu, chọn món và gửi đơn cho bếp.
        </p>
        <label>
          Liên kết bàn
          <textarea
            value={qrInput}
            onChange={(event) => setQrInput(event.target.value)}
            placeholder="Dán liên kết bàn do chủ quán cấp"
            rows={4}
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button large" onClick={() => onStart(qrInput)} disabled={loading || !qrInput}>
          {loading ? <BusyMark /> : null}
          Mở menu bàn này
        </button>
      </section>
    </main>
  );
}

function TabletHeaderControls({
  language,
  onLanguageChange,
  allergens,
  onAllergensChange,
}: {
  language: string;
  onLanguageChange: (language: string) => void;
  allergens: AllergenType[];
  onAllergensChange: (allergens: AllergenType[]) => void;
}) {
  const [allergenOpen, setAllergenOpen] = useState(false);
  const copy = getTabletCopy(language);
  const selectedText = allergens.length === 0 ? copy.noneSelected : copy.selectedCount(allergens.length);

  function toggle(value: AllergenType) {
    onAllergensChange(
      allergens.includes(value)
        ? allergens.filter((item) => item !== value)
        : [...allergens, value],
    );
  }

  return (
    <div className="tablet-header-controls">
      <label className="language-control">
        {copy.language}
        <select value={language} onChange={(event) => onLanguageChange(event.target.value)}>
          {TABLET_LANGUAGES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="allergen-dropdown">
        <span>{copy.allergyFilter}</span>
        <button
          type="button"
          className="select-like-button"
          data-testid="tablet-allergen-trigger"
          aria-expanded={allergenOpen}
          onClick={() => setAllergenOpen((open) => !open)}
        >
          <span>{selectedText}</span>
          <span className="dropdown-cue" aria-hidden="true">Mở</span>
        </button>
        {allergenOpen ? (
          <div className="allergen-menu" data-testid="tablet-allergen-menu" role="group" aria-label={copy.allergyFilter}>
            {ALLERGEN_OPTIONS.map((option) => {
              const selected = allergens.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`allergen-option-${option.value}`}
                  className={selected ? 'allergen-option selected' : 'allergen-option'}
                  aria-pressed={selected}
                  onClick={() => toggle(option.value)}
                >
                  <span className="checkbox-mark">{selected ? 'Chọn' : ''}</span>
                  <span>{getLocalizedAllergenLabel(option.value, language)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TabletExperienceHero({
  menu,
  session,
  copy,
}: {
  menu: PublicMenu;
  session: Session;
  copy: ReturnType<typeof getTabletCopy>;
}) {
  const dishCount = Object.values(menu.categories).reduce((total, items) => total + items.length, 0);

  return (
    <section className="tablet-experience-hero">
      <div>
        <span className="eyebrow">Bàn {session.tableNumber} · {dishCount} món đang phục vụ</span>
        <h2>{copy.searchDishes}</h2>
        <p>Chọn món, lọc dị ứng và gửi đơn trực tiếp cho bếp. Món mới thêm sẽ nằm trong giỏ bên phải.</p>
      </div>
      <div className="hotpot-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}


function TabletKioskBoard({
  menu,
  session,
  cart,
  customerNotes,
  orders,
  loading,
  language,
  selectedAllergens,
  onAdd,
  onNotesChange,
  onQuantityChange,
  onSubmit,
  onCashPayment,
  tableNumber,
}: {
  menu: PublicMenu;
  session: Session;
  cart: CartItem[];
  customerNotes: string;
  orders: Order[];
  loading: boolean;
  language: string;
  selectedAllergens: AllergenType[];
  onAdd: (item: PublicMenuItem) => void;
  onNotesChange: (notes: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onSubmit: () => void;
  onCashPayment: () => void;
  tableNumber: number;
}) {
  const copy = getTabletCopy(language);
  const categories = useMemo(
    () => sortMenuCategoryEntries(
      Object.entries(menu.categories)
        .map(([category, items]) => [
          category,
          items.filter((item) => !shouldHideForAllergens(item, selectedAllergens)),
        ] as const)
        .filter(([, items]) => items.length > 0),
    ),
    [menu.categories, selectedAllergens],
  );
  const [activeCategory, setActiveCategory] = useState(categories[0]?.[0] ?? '');
  const [query, setQuery] = useState('');
  const [serviceStatus, setServiceStatus] = useState('');
  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const dishCount = categories.reduce((sum, [, items]) => sum + items.length, 0);

  function handleServiceRequest(label: string) {
    const message = buildServiceRequestMessage(label);
    setServiceStatus(message);
    saveServiceRequestNote({
      id: `service-${session.restaurantId}-${session.tableNumber}-${Date.now()}`,
      tableNumber: session.tableNumber,
      label,
      message,
      createdAt: new Date().toISOString(),
    });
  }

  useEffect(() => {
    if (!activeCategory && categories[0]) setActiveCategory(categories[0][0]);
    if (
      activeCategory &&
      activeCategory !== TABLET_SERVICE_SECTION &&
      !categories.some(([category]) => category === activeCategory)
    ) {
      setActiveCategory(categories[0]?.[0] ?? '');
    }
  }, [activeCategory, categories]);

  const isServiceSectionActive = activeCategory === TABLET_SERVICE_SECTION;
  const activeItems = isServiceSectionActive
    ? []
    : categories.find(([category]) => category === activeCategory)?.[1] ?? categories[0]?.[1] ?? [];
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
  const visibleItems = activeItems.filter((item) => {
    if (!normalizedQuery) return true;
    return `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery);
  });

  return (
    <>
    <main className="tablet-menu-shell" aria-label="Giao diện gọi món tại bàn">
      <div className="tablet-search-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchDishes}
          aria-label={copy.searchDishes}
        />
      </div>

      <div className="tablet-order-layout">
        <aside className="tablet-category-sidebar" aria-label={copy.menuCategories}>
          {categories.map(([category, items]) => (
            <button
              key={category}
              type="button"
              className={category === activeCategory ? 'active' : ''}
              onClick={() => setActiveCategory(category)}
            >
              <span>{getLocalizedCategory(category, language)}</span>
              <small>{items.length}</small>
            </button>
          ))}
          <button
            type="button"
            className={isServiceSectionActive ? 'active' : ''}
            onClick={() => setActiveCategory(TABLET_SERVICE_SECTION)}
          >
            <span>Phục vụ</span>
            <small>8</small>
          </button>
        </aside>

        <section className="tablet-dish-section">
          <div className="tablet-section-title-row">
            <div>
              <span className="eyebrow">Bàn {session.tableNumber} · {dishCount} món</span>
              <h2>{isServiceSectionActive ? 'Phục vụ' : getLocalizedCategory(activeCategory, language)}</h2>
            </div>
          </div>
          {isServiceSectionActive ? (
            <div className="tablet-service-section" data-testid="tablet-service-section">
              <ServiceRequestPanel
                serviceStatus={serviceStatus}
                onServiceRequest={handleServiceRequest}
                onUnlockPayment={() => setPaymentUnlocked(true)}
              />
            </div>
          ) : null}

          {!isServiceSectionActive && visibleItems.length === 0 ? (
            <div className="empty-state tablet-empty-state">
              <p>{copy.noMatchingDishes}</p>
            </div>
          ) : null}

          {!isServiceSectionActive ? <div className="tablet-square-grid">
            {visibleItems.map((item) => {
              const currentQuantity = cart.find((cartItem) => cartItem.menuItemId === item.id)?.quantity ?? 0;
              return (
              <article className="tablet-square-dish-card" key={item.id}>
                <div className="tablet-square-image-wrap">
                  <img src={getDishImageUrl(item)} alt={item.name} />
                  <span className={`tablet-check-mark ${item.allergenLabel}`}>
                    {getLocalizedRiskLabel(item.allergenLabel, language)}
                  </span>
                </div>
                <div className="tablet-square-content">
                  <strong>{item.name}</strong>
                  <span>{item.description || item.name}</span>
                  <div className="tablet-square-bottom">
                    <small>{formatVnd(item.price)}</small>
                    <div className="tablet-dish-stepper" aria-label={`Số lượng ${item.name}`}>
                      <button
                        type="button"
                        aria-label="-"
                        disabled={currentQuantity === 0}
                        onClick={() => onQuantityChange(item.id, currentQuantity - 1)}
                      >
                        -
                      </button>
                      <span>{currentQuantity}</span>
                      <button
                        type="button"
                        aria-label="+"
                        disabled={currentQuantity >= MAX_CART_QUANTITY}
                        onClick={() => {
                          if (currentQuantity === 0) onAdd(item);
                          else onQuantityChange(item.id, currentQuantity + 1);
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </article>
              );
            })}
          </div> : null}
        </section>

        <aside className="tablet-cart-sidebar-panel" aria-label={copy.cart}>
          <CartPanel
            cart={cart}
            customerNotes={customerNotes}
            orders={orders}
            loading={loading}
            onNotesChange={onNotesChange}
            onQuantityChange={onQuantityChange}
            onSubmit={onSubmit}
            onCashPayment={onCashPayment}
            language={language}
            tableNumber={tableNumber}
            paymentUnlocked={paymentUnlocked}
          />
        </aside>
      </div>
    </main>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MenuList({
  menu,
  language,
  selectedAllergens,
  onAdd,
}: {
  menu: PublicMenu;
  language: string;
  selectedAllergens: AllergenType[];
  onAdd: (item: PublicMenuItem) => void;
}) {
  const copy = getTabletCopy(language);
  const categories = sortMenuCategoryEntries(
    Object.entries(menu.categories)
      .map(([category, items]) => [
        category,
        items.filter((item) => !shouldHideForAllergens(item, selectedAllergens)),
      ] as const)
      .filter(([, items]) => items.length > 0),
  );
  const [activeCategory, setActiveCategory] = useState(categories[0]?.[0] ?? '');
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!activeCategory && categories[0]) setActiveCategory(categories[0][0]);
    if (activeCategory && !categories.some(([category]) => category === activeCategory)) {
      setActiveCategory(categories[0]?.[0] ?? '');
    }
  }, [activeCategory, categories]);

  const visibleCategories = categories
    .filter(([category]) => !activeCategory || category === activeCategory)
    .map(([category, items]) => [
      category,
      items.filter((item) => {
        const normalized = query.trim().toLocaleLowerCase('vi-VN');
        if (!normalized) return true;
        return `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('vi-VN').includes(normalized);
      }),
    ] as const)
    .filter(([, items]) => items.length > 0);

  return (
    <div className="menu-list">
      <div className="menu-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchDishes}
          aria-label={copy.searchDishes}
        />
      </div>
      <div className="menu-browser">
        <div className="category-tabs category-rail" role="tablist" aria-label={copy.menuCategories}>
          {categories.map(([category]) => (
            <button
              key={category}
              className={category === activeCategory ? 'active' : ''}
              onClick={() => setActiveCategory(category)}
            >
              {getLocalizedCategory(category, language)}
            </button>
          ))}
        </div>
        <div className="dish-pane">
          {visibleCategories.length === 0 ? (
            <div className="empty-state">
              <p>{copy.noMatchingDishes}</p>
            </div>
          ) : null}
          {visibleCategories.map(([category, items]) => (
            <section key={category}>
              <h2>{getLocalizedCategory(category, language)}</h2>
              <div className="dish-grid">
                {items.map((item) => (
                  <article className="dish-card" key={item.id}>
                    <div className={`allergen-dot ${item.allergenLabel}`} title={getLocalizedRiskLabel(item.allergenLabel, language)}>
                      {getLocalizedRiskLabel(item.allergenLabel, language)}
                    </div>
                    <img className="dish-image" src={getDishImageUrl(item)} alt={item.name} />
                    <div className="dish-body">
                      <h3>{item.name}</h3>
                      {item.description ? <p>{item.description}</p> : null}
                      <div className="dish-meta">
                        <span>{formatVnd(item.price)}</span>
                        {item.allergenLabel !== 'none' ? (
                          <small className={`risk-text ${item.allergenLabel}`}>{getLocalizedRiskLabel(item.allergenLabel, language)}</small>
                        ) : null}
                      </div>
                    </div>
                    <button className="secondary-button compact filled" onClick={() => onAdd(item)}>
                      {copy.addToCart}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function CartPanel({
  cart,
  customerNotes,
  orders,
  loading,
  language,
  onNotesChange,
  onQuantityChange,
  onSubmit,
  onCashPayment,
  tableNumber,
  paymentUnlocked,
}: {
  cart: CartItem[];
  customerNotes: string;
  orders: Order[];
  loading: boolean;
  language: string;
  onNotesChange: (notes: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onSubmit: () => void;
  onCashPayment: () => void;
  tableNumber: number;
  paymentUnlocked: boolean;
}) {
  const copy = getTabletCopy(language);
  const total = useMemo(() => getCartTotal(cart), [cart]);
  const riskyItems = cart.filter((item) => item.allergenLabel === 'red' || item.allergenLabel === 'yellow');
  const payableOrders = orders.filter((order) => !isClosedOrderStatus(order.status));
  const billTotal = payableOrders.reduce((sum, order) => sum + order.totalPrice, 0) + total;
  const billToken = getPaymentToken(tableNumber, payableOrders[0]?.id ?? cart[0]?.menuItemId ?? 'new');

  return (
    <div className="cart-panel tablet-table-cart-card" data-testid="tablet-table-cart">
      <div className="section-heading">
        <div>
          <h2>{language === 'vi' ? `Cart bàn ${tableNumber}` : `Cart table ${tableNumber}`}</h2>
          <p className="muted">
            {copy.itemsTotal(cart.length, formatVnd(total))} · Tạm tính {formatVnd(billTotal)}
          </p>
        </div>
      </div>
      {riskyItems.length > 0 ? (
        <div className="cart-warning">
          <span>{copy.allergyCartWarning(riskyItems.length)}</span>
        </div>
      ) : null}
      {cart.length === 0 ? <p className="muted">{copy.cartEmpty}</p> : null}
      {cart.length > 0 ? (
        <div className="cart-current-list">
          <strong className="cart-context-title">{language === 'vi' ? 'Đang chọn' : 'Current items'}</strong>
          {cart.map((item) => (
            <article className="cart-item" key={item.menuItemId}>
              <div>
                <strong>{item.name}</strong>
                <span>{formatVnd(item.price)} · {formatVnd(item.price * item.quantity)}</span>
              </div>
              <div className="stepper">
                <button type="button" aria-label="-" onClick={() => onQuantityChange(item.menuItemId, item.quantity - 1)}>
                  -
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  aria-label="+"
                  disabled={item.quantity >= MAX_CART_QUANTITY}
                  onClick={() => onQuantityChange(item.menuItemId, item.quantity + 1)}
                >
                  +
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <label>
        {copy.notesLabel}
        <textarea
          value={customerNotes}
          onChange={(event) => onNotesChange(event.target.value.slice(0, 200))}
          rows={3}
          placeholder={copy.notesPlaceholder}
        />
      </label>
      <button className="primary-button large" onClick={onSubmit} disabled={loading || cart.length === 0}>
        {loading ? <BusyMark /> : null}
        {copy.sendOrder}
      </button>
      <PaymentPanel
        unlocked={paymentUnlocked}
        token={billToken}
        total={billTotal}
        canPayCash={payableOrders.length > 0}
        loading={loading}
        onCashPayment={onCashPayment}
      />
      <TabletOrderingAssistant
        cart={cart}
        orders={orders}
        tableNumber={tableNumber}
        billToken={billToken}
        paymentUnlocked={paymentUnlocked}
      />
    </div>
  );
}

type AssistantMessage = {
  role: 'assistant' | 'user';
  text: string;
};

function TabletOrderingAssistant({
  cart,
  orders,
  tableNumber,
  billToken,
  paymentUnlocked,
}: {
  cart: CartItem[];
  orders: Order[];
  tableNumber: number;
  billToken: string;
  paymentUnlocked: boolean;
}) {
  const quickPrompts = [
    'Tư vấn món ăn',
    'Món bán chạy hôm nay',
    'Món ít cay',
    'Món phù hợp trẻ em',
    'Gợi ý combo tiết kiệm',
    'Gợi ý món ăn kèm',
    'Xem chi tiết đơn hàng',
    'Xem tổng tiền tạm tính',
    'Kiểm tra món đã gọi',
    'Hỏi trạng thái món',
  ];
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'assistant',
      text: 'Xin chào, mình là trợ lý gọi món. Bạn muốn mình gợi ý món, xem chi tiết đơn hàng hay tư vấn combo phù hợp?',
    },
  ]);
  const [input, setInput] = useState('');

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((current) => [
      ...current,
      { role: 'user', text: trimmed },
      {
        role: 'assistant',
        text: buildAssistantReply(trimmed, cart, orders, tableNumber, billToken, paymentUnlocked),
      },
    ]);
    setInput('');
  }

  return (
    <div className="tablet-ai-assistant-card" data-testid="tablet-ai-assistant-card">
      <button
        type="button"
        className="tablet-ai-assistant-button"
        aria-label={isAssistantOpen ? 'Đóng Chat với AI' : 'Chat với AI'}
        onClick={() => setIsAssistantOpen((prev) => !prev)}
      >
        <span aria-hidden="true">AI</span>
        <strong>Chat với AI</strong>
      </button>
      {!isAssistantOpen ? <span className="tablet-ai-assistant-badge">Cần gợi ý món?</span> : null}
      {isAssistantOpen ? (
        <section className="tablet-ai-chat-panel" aria-label="Trợ lý gọi món">
          <header className="tablet-ai-chat-header">
            <div>
              <span className="assistant-avatar" aria-hidden="true">AI</span>
              <div>
                <h3>Trợ lý gọi món</h3>
                <small>Đang hỗ trợ</small>
              </div>
            </div>
            <button type="button" aria-label="Đóng trợ lý" onClick={() => setIsAssistantOpen(false)}>
              X
            </button>
          </header>
          <div className="tablet-ai-chat-body">
            {messages.map((message, index) => (
              <article
                className={message.role === 'assistant' ? 'assistant-message ai' : 'assistant-message user'}
                key={`${message.role}-${index}-${message.text.slice(0, 12)}`}
              >
                <p>{message.text}</p>
              </article>
            ))}
            {messages.some((message) => message.text.includes('Đơn hiện tại của bàn')) ? (
              <div className="tablet-ai-order-summary-card">
                <strong>Mã bàn T{String(tableNumber).padStart(2, '0')}</strong>
                <span>{paymentUnlocked ? `Mã bill ${billToken}` : 'Chưa yêu cầu thanh toán'}</span>
              </div>
            ) : null}
          </div>
          <div className="tablet-ai-quick-actions">
            {quickPrompts.map((prompt) => (
              <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <footer className="tablet-ai-chat-footer">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập câu hỏi cho trợ lý..."
            />
            <button type="button" onClick={() => sendMessage(input)}>
              Gửi
            </button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

function buildAssistantReply(
  action: string,
  cart: CartItem[],
  orders: Order[],
  tableNumber: number,
  billToken: string,
  paymentUnlocked: boolean,
) {
  const normalized = action.toLocaleLowerCase('vi-VN');

  if (
    normalized.includes('chi tiết') ||
    normalized.includes('tổng tiền') ||
    normalized.includes('đã gọi') ||
    normalized.includes('trạng thái')
  ) {
    return buildOrderSummary(cart, orders, tableNumber, billToken, paymentUnlocked);
  }

  if (normalized.includes('ít cay')) {
    return 'Bạn muốn tìm món ít cay? Mình sẽ ưu tiên món thanh nhẹ, ít gia vị cay và có thể gợi ý thêm nước uống cân vị.';
  }

  if (normalized.includes('bán chạy')) {
    return cart.length === 0
      ? 'Món bán chạy hôm nay thường là lẩu, món nướng và nước trái cây. Bạn có thể bắt đầu với một món chính rồi mình gợi ý món ăn kèm.'
      : buildCartBasedSuggestion(cart);
  }

  if (normalized.includes('combo') || normalized.includes('tiết kiệm')) {
    return cart.length === 0
      ? 'Combo tiết kiệm nên gồm một món chính, một món rau hoặc ăn kèm và một đồ uống.'
      : `${buildCartBasedSuggestion(cart)} Nếu muốn tiết kiệm hơn, bạn có thể thêm một món ăn kèm chia sẻ thay vì gọi thêm món chính.`;
  }

  if (normalized.includes('trẻ em')) {
    return 'Mình gợi ý chọn món ít cay, mềm, dễ ăn và có thể ghi chú không hành hoặc giảm gia vị trước khi gửi đơn.';
  }

  if (normalized.includes('ăn kèm')) {
    return buildCartBasedSuggestion(cart);
  }

  return cart.length > 0
    ? buildCartBasedSuggestion(cart)
    : 'Bạn có thể thử món bán chạy, món ít cay hoặc cho mình biết ngân sách để mình gợi ý combo phù hợp.';
}

function buildCartBasedSuggestion(cart: CartItem[]) {
  if (cart.length === 0) {
    return 'Bàn hiện chưa có món nào trong đơn. Bạn có thể chọn món hoặc hỏi mình gợi ý món phù hợp.';
  }

  const names = cart.map((item) => item.name.toLocaleLowerCase('vi-VN')).join(' ');
  if (names.includes('lẩu') || names.includes('lau')) {
    return 'Bạn đang có món lẩu, nên thêm rau, nấm, mì hoặc đồ uống nhẹ để bữa ăn cân bằng hơn.';
  }
  if (names.includes('cay')) {
    return 'Đơn có món cay, mình gợi ý thêm nước suối, trà hoặc món thanh mát để cân vị.';
  }
  if (names.includes('bò') || names.includes('thịt') || names.includes('ga')) {
    return 'Đơn có nhiều món thịt, nên thêm rau, nấm hoặc món nhẹ để ăn đỡ ngấy.';
  }
  return 'Đơn hiện tại đã có món chính. Bạn có thể thêm đồ uống hoặc món ăn kèm để hoàn chỉnh bữa ăn.';
}

function buildOrderSummary(
  cart: CartItem[],
  orders: Order[],
  tableNumber: number,
  billToken: string,
  paymentUnlocked: boolean,
) {
  const openOrders = orders.filter((order) => !isClosedOrderStatus(order.status));
  if (cart.length === 0 && openOrders.length === 0) {
    return 'Bàn hiện chưa có món nào trong đơn. Bạn có thể chọn món hoặc hỏi mình gợi ý món phù hợp.';
  }

  const cartLines = cart.map((item, index) =>
    `${index + 1}. ${item.name} x${item.quantity} - ${formatVnd(item.price * item.quantity)}`,
  );
  const sentLines = openOrders.flatMap((order) =>
    order.items.map((item) =>
      `Đã gửi bếp: ${item.nameVi || item.name || 'Món'} x${item.quantity} - ${formatVnd(item.price * item.quantity)} (${getLocalizedOrderStatus(order.status, 'vi')})`,
    ),
  );
  const total = getCartTotal(cart) + openOrders.reduce((sum, order) => sum + order.totalPrice, 0);

  return [
    `Đơn hiện tại của bàn T${String(tableNumber).padStart(2, '0')}:`,
    ...cartLines,
    ...sentLines,
    `Tổng tạm tính: ${formatVnd(total)}`,
    `Mã bill: ${billToken}`,
    `Trạng thái thanh toán: ${paymentUnlocked ? 'Đã mở thanh toán' : 'Chưa yêu cầu thanh toán'}`,
  ].join('\n');
}

function ServiceRequestPanel({
  serviceStatus,
  onServiceRequest,
  onUnlockPayment,
}: {
  serviceStatus: string;
  onServiceRequest: (label: string) => void;
  onUnlockPayment: () => void;
}) {
  const requests = [
    'Thêm nước',
    'Gọi nhân viên',
    'Yêu cầu hóa đơn',
    'Thêm dụng cụ',
    'Dọn bàn',
    'Thêm khăn giấy',
    'Hỗ trợ món',
    'Báo sự cố',
  ];

  return (
    <section className="service-request-panel">
      <div>
        <h3>Phục vụ</h3>
        <p className="muted">Gửi yêu cầu nhanh cho nhân viên tại bàn.</p>
      </div>
      <div className="service-request-grid">
        {requests.map((request) => (
          <button key={request} type="button" onClick={() => onServiceRequest(request)}>
            <span aria-hidden="true">•</span>
            {request}
          </button>
        ))}
      </div>
      {serviceStatus ? <p className="service-status">{serviceStatus}</p> : null}
      <button type="button" className="secondary-button compact staff-unlock-button" onClick={onUnlockPayment}>
        Mở thanh toán
      </button>
    </section>
  );
}

function PaymentPanel({
  unlocked,
  token,
  total,
  canPayCash,
  loading,
  onCashPayment,
}: {
  unlocked: boolean;
  token: string;
  total: number;
  canPayCash: boolean;
  loading: boolean;
  onCashPayment: () => void;
}) {
  const [method, setMethod] = useState<'cash' | 'momo' | 'bank'>('cash');

  if (!unlocked) {
    return null;
  }

  return (
    <section className="payment-panel">
      <div>
        <h3>Thanh toán</h3>
        <p className="muted">Mã thanh toán: <strong>{token}</strong></p>
        <p className="payment-total">{formatVnd(total)}</p>
      </div>
      <div className="payment-method-tabs">
        <button className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>Tiền mặt</button>
        <button className={method === 'momo' ? 'active' : ''} onClick={() => setMethod('momo')}>MoMo</button>
        <button className={method === 'bank' ? 'active' : ''} onClick={() => setMethod('bank')}>Ngân hàng</button>
      </div>
      {method === 'cash' ? (
        <button className="cash-button large" onClick={onCashPayment} disabled={loading || !canPayCash}>
          Thanh toán tiền mặt
        </button>
      ) : (
        <div className="payment-qr-placeholder">
          <strong>{method === 'momo' ? 'MoMo' : 'Ngân hàng'}</strong>
          <span>QR mẫu</span>
          <small>Đang chờ nhân viên xác nhận thanh toán</small>
        </div>
      )}
    </section>
  );
}

function getPaymentToken(tableNumber: number, seed: string) {
  const suffix = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0).toString(36).toUpperCase().slice(-4).padStart(4, '0');
  return `BILL-T${String(tableNumber).padStart(2, '0')}-${suffix}`;
}

function StatusBanner({
  message,
  error,
  onClear,
}: {
  message: string;
  error: string;
  onClear: () => void;
}) {
  const visibleError = shouldHideUiNotice(error) ? '' : error;
  const visibleMessage = shouldHideUiNotice(message) ? '' : message;

  if (!visibleMessage && !visibleError) return null;

  return (
    <div className={visibleError ? 'status-banner error' : 'status-banner'}>
      <span>{visibleError || visibleMessage}</span>
      <button onClick={onClear}>Đóng</button>
    </div>
  );
}

function shouldHideUiNotice(value: string) {
  const normalized = value.trim().toLocaleLowerCase('vi-VN');
  if (!normalized) return false;

  return [
    'token',
    'session',
    'hết phiên',
    'hết hạn',
    'phiên không hợp lệ',
    'đã mở bàn',
    '/scan?data',
    'localhost',
  ].some((term) => normalized.includes(term));
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state">
      <BusyMark />
      <span>{label}</span>
    </div>
  );
}

function getTableCartKey(session: Pick<Session, 'restaurantId' | 'tableNumber'>): string {
  return `${CART_KEY}:${session.restaurantId}:${session.tableNumber}`;
}

function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Vui lòng chọn file ảnh món ăn'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    reader.readAsDataURL(file);
  });
}

function readError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Có lỗi xảy ra';
}
