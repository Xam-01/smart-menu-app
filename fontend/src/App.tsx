import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChefHat,
  ClipboardList,
  ExternalLink,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Minus,
  Plus,
  QrCode,
  RefreshCcw,
  Save,
  Send,
  ShieldAlert,
  ShoppingCart,
  TabletSmartphone,
  Trash2,
  Upload,
  Utensils,
} from 'lucide-react';
import { ACCESS_TOKEN_KEY, ApiError, authApi, ownerApi, tabletApi } from './lib/api';
import { addItemToCart, getCartTotal, toOrderPayload, updateCartQuantity } from './lib/cart';
import {
  getCheckoutTransitionPath,
  getDishRevenueBreakdown,
  getOwnerSummary,
  getTableHistory,
  groupOrdersByTable,
  isClosedOrderStatus,
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
const FALLBACK_DISH_IMAGES: Record<string, string> = {
  'Khai vị': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
  'Món chính': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=80',
  'Tráng miệng': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80',
  'Đồ uống': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80',
  Khác: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=900&q=80',
};
type OwnerSection = 'overview' | 'menu' | 'tables' | 'orders' | 'revenue';

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
  return item.imageUrl || FALLBACK_DISH_IMAGES[item.category] || FALLBACK_DISH_IMAGES.Khác;
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

function OwnerDashboard() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [items, setItems] = useState<OwnerMenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [activeSection, setActiveSection] = useState<OwnerSection>('overview');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const summary = useMemo(
    () => getOwnerSummary({ restaurant, items, orders }),
    [restaurant, items, orders],
  );

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
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return;

    let ignore = false;
    async function loadOrders() {
      try {
        const response = await ownerApi.getOrders({
          status: statusFilter || undefined,
          limit: 50,
        });
        if (!ignore) setOrders(response.data);
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
      ownerApi.getOrders({ limit: 50 }),
    ]);

    if (restaurantResult.status === 'fulfilled') setRestaurant(restaurantResult.value.data);
    if (menusResult.status === 'fulfilled') {
      setMenus(menusResult.value.data);
      setSelectedMenuId((current) => current || menusResult.value.data[0]?.id || '');
    }
    if (ordersResult.status === 'fulfilled') setOrders(ordersResult.value.data);
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
            <OwnerCommandHero restaurant={restaurant} summary={summary} />
            <OwnerSummaryCards summary={summary} />

            <div className="owner-grid">
          <section className="panel span-2" hidden={activeSection !== 'overview'}>
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

          <section
            className="panel owner-menu-panel"
            data-testid="owner-menu-panel"
            hidden={activeSection !== 'menu'}
          >
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
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              onMessage={setMessage}
              onUpdated={async () => {
                const response = await ownerApi.getOrders({
                  status: statusFilter || undefined,
                  limit: 50,
                });
                setOrders(response.data);
              }}
              onError={setError}
            />
          </section>

          <section className="panel span-2" hidden={activeSection !== 'revenue'}>
            <RevenueBoard orders={orders} />
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
          <LayoutDashboard aria-hidden="true" />
          <div>
            <strong>SmartMenu vận hành</strong>
            <span>Bảng điều khiển nhà hàng</span>
          </div>
        </div>
        <div className="topbar-actions">
          {owner ? <span className="muted">{owner.email}</span> : null}
          {localStorage.getItem(ACCESS_TOKEN_KEY) ? (
            <button className="icon-button" onClick={onLogout} title="Đăng xuất" aria-label="Đăng xuất">
              <LogOut size={18} />
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
  const sections: Array<{ id: OwnerSection; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Tổng quan', icon: <LayoutDashboard size={17} /> },
    { id: 'menu', label: 'Menu và món', icon: <Utensils size={17} /> },
    { id: 'tables', label: 'Tablet bàn', icon: <TabletSmartphone size={17} /> },
    { id: 'orders', label: 'Đơn theo bàn', icon: <ClipboardList size={17} /> },
    { id: 'revenue', label: 'Doanh thu', icon: <BarChart3 size={17} /> },
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
          {section.icon}
          {section.label}
        </button>
      ))}
    </nav>
  );
}


function OwnerCommandHero({
  restaurant,
  summary,
}: {
  restaurant: Restaurant | null;
  summary: ReturnType<typeof getOwnerSummary>;
}) {
  return (
    <section className="owner-command-hero">
      <div className="hero-copy-block">
        <span className="eyebrow">SmartMenu Owner Console</span>
        <h1>{restaurant?.name ?? 'Vận hành nhà hàng chuẩn hiện đại'}</h1>
        <p>
          Theo dõi bàn, menu, đơn hàng và thanh toán trên một màn hình. Giao diện mới ưu tiên tốc độ thao tác,
          cảnh báo dị ứng và trải nghiệm tablet tại bàn.
        </p>
      </div>
      <div className="hero-live-card">
        <span>Đang phục vụ</span>
        <strong>{summary.openOrders}</strong>
        <small>đơn mở · {summary.pendingOrders} đơn chờ xác nhận</small>
      </div>
      <div className="hero-live-card accent">
        <span>Doanh thu mở</span>
        <strong>{formatVnd(summary.openRevenue)}</strong>
        <small>{summary.activeTables} bàn đang hoạt động</small>
      </div>
    </section>
  );
}

function OwnerSummaryCards({ summary }: { summary: ReturnType<typeof getOwnerSummary> }) {
  const cards = [
    { label: 'Bàn đang dùng được', value: summary.activeTables, detail: 'bàn có thiết bị hoạt động' },
    { label: 'Đơn đang mở', value: summary.openOrders, detail: `${summary.pendingOrders} đơn chờ xác nhận` },
    { label: 'Cảnh báo dị ứng', value: summary.allergyOrders, detail: 'đơn cần bếp chú ý' },
    { label: 'Doanh thu đơn mở', value: formatVnd(summary.openRevenue), detail: 'chưa gồm đơn đã đóng' },
    { label: 'Món trong menu', value: summary.menuItems, detail: `${summary.unavailableItems} món hết/ẩn` },
  ];

  return (
    <section className="summary-cards" aria-label="Tổng quan vận hành">
      {cards.map((card) => (
        <article className="metric-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.detail}</small>
        </article>
      ))}
    </section>
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
        <ChefHat size={42} />
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
          {submitting ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
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
        {submitting ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
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
          {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
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

  async function uploadMenu() {
    try {
      await ownerApi.uploadMenu();
      await onMenusChanged();
      onMessage('Đã tạo bản menu draft');
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
    try {
      await ownerApi.createItem(selectedMenuId, form);
      setForm({ nameVi: '', descVi: '', price: 50000, category: 'Món chính', imageUrl: '' });
      await onItemsChanged();
      onMessage('Đã thêm món');
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
          <p className="muted">Tạo draft, nhập món, kiểm tra dị ứng rồi publish cho tablet tại bàn.</p>
        </div>
        <button className="secondary-button" onClick={uploadMenu}>
          <Plus size={16} />
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
            v{menu.version} · {menu.status}
          </button>
        ))}
      </div>
      {selectedMenu ? (
        <div className="menu-actions">
          <button
            className="primary-button"
            onClick={publishMenu}
            disabled={selectedMenu.status !== 'draft'}
          >
            <Check size={18} />
            Publish menu v{selectedMenu.version}
          </button>
          <button className="danger-button" onClick={deleteSelectedMenu}>
            <Trash2 size={18} />
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
          <Upload size={16} />
          Ảnh
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFormImage(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className="secondary-button" disabled={!selectedMenuId}>
          <Plus size={16} />
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
                {savingAllergenItemId === item.id ? <Loader2 className="spin" size={16} /> : <ShieldAlert size={16} />}
                Xác nhận
              </button>
              <label className="file-upload compact">
                <Upload size={16} />
                Ảnh món
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => updateItemImage(item, event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="danger-button compact" onClick={() => deleteItem(item)}>
                <Trash2 size={16} />
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
        <TabletSmartphone size={30} />
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
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Tablet theo bàn</h2>
          <p className="muted">Mỗi bàn dùng một liên kết riêng để khách mở đúng menu gọi món.</p>
        </div>
      </div>
      <div className="table-list">
        {restaurant.tables.map((table) => {
          const url = getTabletTableUrl({
            qrCode: table.qrCode,
            restaurantId: restaurant.id,
          });
          return (
            <article className="table-row" key={table.tableNumber}>
              <div>
                <strong>Bàn {table.tableNumber}</strong>
                <span className={table.isActive ? 'table-state active' : 'table-state'}>{table.isActive ? 'Đang dùng' : 'Tạm tắt'}</span>
              </div>
              <TableLaunchLink href={url} tableNumber={table.tableNumber} />
              <button className="icon-button" onClick={() => revoke(table.tableNumber)} title="Làm mới liên kết bàn" aria-label={`Làm mới liên kết bàn ${table.tableNumber}`}>
                <RefreshCcw size={16} />
              </button>
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
      className="icon-link table-launch-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Mở bàn ${tableNumber}`}
    >
      <ExternalLink size={16} />
      Mở bàn
    </a>
  );
}

function OrdersBoard({
  orders,
  statusFilter,
  onStatusFilter,
  onMessage,
  onUpdated,
  onError,
}: {
  orders: Order[];
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onMessage: (message: string) => void;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const tableGroups = useMemo(() => groupOrdersByTable(orders), [orders]);
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
          <p className="muted">Polling 10 giây/lần để không bỏ sót đơn nếu chưa có WebSocket.</p>
        </div>
        <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([status, label]) => (
            <option key={status} value={status}>{label}</option>
          ))}
        </select>
      </div>
      <div className="table-order-board">
        {tableGroups.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={30} />
            <p>Chưa có đơn phù hợp.</p>
          </div>
        ) : null}
        {tableGroups.map((group) => (
          <section className="table-order-group" key={group.tableNumber}>
            <div className="table-order-head">
              <div>
                <strong>Bàn {group.tableNumber}</strong>
                <span>{group.orders.length} đơn · đang mở {formatVnd(group.openTotal)}</span>
              </div>
              <div className="table-order-tools">
                {group.orders.some((order) => order.allergyNotes) ? (
                  <span className="warning-badge">
                    <AlertTriangle size={15} />
                    Dị ứng
                  </span>
                ) : null}
                <button
                  className="primary-button compact"
                  disabled={group.openTotal === 0 || checkingOutTable === group.tableNumber}
                  onClick={() => checkoutTable(group.tableNumber, group.orders)}
                >
                  {checkingOutTable === group.tableNumber ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                  Thanh toán & đóng bàn
                </button>
              </div>
            </div>
            <div className="orders-grid">
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
        ))}
      </div>
    </div>
  );
}

function RevenueBoard({ orders }: { orders: Order[] }) {
  const dishRevenue = useMemo(() => getDishRevenueBreakdown(orders), [orders]);
  const tableHistory = useMemo(() => getTableHistory(orders), [orders]);
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(null);
  const maxDishRevenue = Math.max(...dishRevenue.map((item) => item.revenue), 1);
  const selectedTableOrders = useMemo(
    () =>
      selectedTableNumber === null
        ? []
        : orders.filter(
            (order) => order.tableNumber === selectedTableNumber && order.status === 'completed',
          ),
    [orders, selectedTableNumber],
  );

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Biểu đồ doanh thu</h2>
          <p className="muted">Doanh thu chỉ tính các đơn đã thanh toán và đóng bàn.</p>
        </div>
        <BarChart3 size={24} />
      </div>
      <div className="revenue-layout">
        <section className="revenue-panel">
          <div className="mini-heading">
            <BarChart3 size={18} />
            <strong>Món ăn</strong>
          </div>
          {dishRevenue.length === 0 ? <p className="muted">Chưa có doanh thu món.</p> : null}
          <div className="dish-revenue-list">
            {dishRevenue.map((item) => (
              <article className="dish-revenue-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.quantity} phần · {formatVnd(item.revenue)}</span>
                </div>
                <div className="bar-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(8, (item.revenue / maxDishRevenue) * 100)}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="revenue-panel">
          <div className="mini-heading">
            <History size={18} />
            <strong>Lịch sử bàn</strong>
          </div>
          {tableHistory.length === 0 ? <p className="muted">Chưa có bàn đã đóng.</p> : null}
          <div className="table-history-list">
            {tableHistory.map((entry) => (
              <article className="table-history-row" key={`${entry.tableNumber}-${entry.latestClosedAt}`}>
                <div>
                  <strong>Bàn {entry.tableNumber}</strong>
                  <span>{entry.orderCount} đơn · {formatDateTime(entry.latestClosedAt)}</span>
                </div>
                <span>{formatVnd(entry.revenue)}</span>
                <button className="secondary-button compact" onClick={() => setSelectedTableNumber(entry.tableNumber)}>
                  Chi tiết
                </button>
              </article>
            ))}
          </div>
          {selectedTableNumber !== null ? (
            <div className="revenue-detail">
              <div className="mini-heading">
                <ClipboardList size={18} />
                <strong>Chi tiết bàn {selectedTableNumber}</strong>
              </div>
              {selectedTableOrders.map((order) => (
                <article className="revenue-detail-order" key={order.id}>
                  <div className="mini-order">
                    <strong>{formatDateTime(order.createdAt)}</strong>
                    <span>{formatVnd(order.totalPrice)}</span>
                  </div>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${index}`}>
                        {item.quantity}x {item.nameVi} - {formatVnd(item.price * item.quantity)}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function TabletApp() {
  const [session, setSession] = useState<Session | null>(() => readStored<Session>(SESSION_KEY));
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => readStored<CartItem[]>(CART_KEY) ?? []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allergens, setAllergens] = useState<AllergenType[]>([]);
  const [language, setLanguage] = useState('vi');
  const [customerNotes, setCustomerNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const copy = useMemo(() => getTabletCopy(language), [language]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

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
      localStorage.removeItem(CART_KEY);
      setCart([]);
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(response.data));
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
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CART_KEY);
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
        <button className="icon-button" onClick={resetTablet} title={copy.resetTablet} aria-label={copy.resetTablet}>
          <RefreshCcw size={18} />
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
        <Utensils size={58} />
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
          {loading ? <Loader2 className="spin" size={20} /> : <QrCode size={20} />}
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
          <ChevronDown size={16} />
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
                  <span className="checkbox-mark">{selected ? <Check size={15} /> : null}</span>
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
  const dishCount = categories.reduce((sum, [, items]) => sum + items.length, 0);

  useEffect(() => {
    if (!activeCategory && categories[0]) setActiveCategory(categories[0][0]);
    if (activeCategory && !categories.some(([category]) => category === activeCategory)) {
      setActiveCategory(categories[0]?.[0] ?? '');
    }
  }, [activeCategory, categories]);

  const activeItems = categories.find(([category]) => category === activeCategory)?.[1] ?? categories[0]?.[1] ?? [];
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
  const visibleItems = activeItems.filter((item) => {
    if (!normalizedQuery) return true;
    return `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery);
  });

  return (
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
        </aside>

        <section className="tablet-dish-section">
          <div className="tablet-section-title-row">
            <div>
              <span className="eyebrow">Bàn {session.tableNumber} · {dishCount} món</span>
              <h2>{getLocalizedCategory(activeCategory, language)}</h2>
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className="empty-state tablet-empty-state">
              <Utensils size={32} />
              <p>{copy.noMatchingDishes}</p>
            </div>
          ) : null}

          <div className="tablet-square-grid">
            {visibleItems.map((item) => (
              <article className="tablet-square-dish-card" key={item.id}>
                <div className="tablet-square-image-wrap">
                  <img src={getDishImageUrl(item)} alt={item.name} />
                  <span className="tablet-check-mark"><Check size={18} /></span>
                </div>
                <div className="tablet-square-content">
                  <strong>{item.name}</strong>
                  <span>{item.description || item.name}</span>
                  <div className="tablet-square-bottom">
                    <small>{formatVnd(item.price)}</small>
                    <button className="tablet-plus-button" onClick={() => onAdd(item)} title={copy.addToCart}>
                      <Plus size={22} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
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
          />
        </aside>
      </div>
    </main>
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
              <Utensils size={28} />
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
                      {item.allergenLabel === 'red' ? <AlertTriangle size={16} /> : <Check size={16} />}
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
                    <button className="icon-button filled" onClick={() => onAdd(item)} title={copy.addToCart}>
                      <Plus size={18} />
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
}) {
  const copy = getTabletCopy(language);
  const total = useMemo(() => getCartTotal(cart), [cart]);
  const riskyItems = cart.filter((item) => item.allergenLabel === 'red' || item.allergenLabel === 'yellow');
  const payableOrders = orders.filter((order) => !isClosedOrderStatus(order.status));

  return (
    <div className="cart-panel">
      <div className="section-heading">
        <div>
          <h2>{copy.cart}</h2>
          <p className="muted">{copy.itemsTotal(cart.length, formatVnd(total))}</p>
        </div>
        <ShoppingCart size={24} />
      </div>
      {riskyItems.length > 0 ? (
        <div className="cart-warning">
          <AlertTriangle size={18} />
          <span>{copy.allergyCartWarning(riskyItems.length)}</span>
        </div>
      ) : null}
      {cart.length === 0 ? <p className="muted">{copy.cartEmpty}</p> : null}
      {cart.map((item) => (
        <article className="cart-item" key={item.menuItemId}>
          <div>
            <strong>{item.name}</strong>
            <span>{formatVnd(item.price)}</span>
          </div>
          <div className="stepper">
            <button onClick={() => onQuantityChange(item.menuItemId, item.quantity - 1)}>
              <Minus size={16} />
            </button>
            <span>{item.quantity}</span>
            <button onClick={() => onQuantityChange(item.menuItemId, item.quantity + 1)}>
              <Plus size={16} />
            </button>
          </div>
        </article>
      ))}
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
        {loading ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
        {copy.sendOrder}
      </button>
      <button
        className="cash-button large"
        onClick={onCashPayment}
        disabled={loading || payableOrders.length === 0}
      >
        <Check size={20} />
        {copy.cashPayment}
      </button>
      <div className="session-orders">
        <h3>{copy.sessionOrders}</h3>
        {orders.length === 0 ? <p className="muted">{copy.noOrders}</p> : null}
        {orders.map((order) => (
          <article className="mini-order" key={order.id}>
            <div>
              <strong>{getLocalizedOrderStatus(order.status, language)}</strong>
              <span>{formatDateTime(order.createdAt)}</span>
            </div>
            <span>{formatVnd(order.totalPrice)}</span>
          </article>
        ))}
      </div>
    </div>
  );
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
      <Loader2 className="spin" size={28} />
      <span>{label}</span>
    </div>
  );
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
