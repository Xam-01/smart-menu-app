import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChefHat,
  ClipboardList,
  ExternalLink,
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
  Utensils,
} from 'lucide-react';
import { ACCESS_TOKEN_KEY, ApiError, authApi, ownerApi, tabletApi } from './lib/api';
import { addItemToCart, getCartTotal, toOrderPayload, updateCartQuantity } from './lib/cart';
import { getOwnerSummary, groupOrdersByTable } from './lib/dashboard';
import {
  ALLERGEN_OPTIONS,
  CATEGORIES,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABEL,
} from './lib/constants';
import { formatDateTime, formatVnd } from './lib/format';
import { getTabletScanUrl, parseQrPayload } from './lib/qr';
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

function OwnerDashboard() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [items, setItems] = useState<OwnerMenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
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
        <div className="owner-workspace">
          <OwnerSummaryCards summary={summary} />

          <div className="owner-grid">
          <section className="panel span-2">
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

          <section className="panel">
            <TableAccessBoard
              restaurant={restaurant}
              onMessage={setMessage}
              onError={setError}
              onRestaurantChanged={(next) => setRestaurant(next)}
            />
          </section>

          <section className="panel span-2">
            <OrdersBoard
              orders={orders}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
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
    <div className="app owner-app">
      <header className="topbar">
        <div className="brand">
          <LayoutDashboard aria-hidden="true" />
          <div>
            <strong>SmartMenu vận hành</strong>
            <span>Owner host · localhost:5173</span>
          </div>
        </div>
        <div className="topbar-actions">
          <a className="icon-link" href={import.meta.env.VITE_TABLET_ORIGIN ?? 'http://localhost:5174'}>
            <TabletSmartphone size={18} />
            Mở tablet
          </a>
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

function OwnerSummaryCards({ summary }: { summary: ReturnType<typeof getOwnerSummary> }) {
  const cards = [
    { label: 'Bàn đang dùng được', value: summary.activeTables, detail: 'tablet/table active' },
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
          Màn này dành cho chủ quán tại localhost:5173. Tablet cho khách dùng riêng tại
          localhost:5174 và chỉ mở đúng menu của nhà hàng/bàn đã chọn.
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
        <p className="muted">Nhà hàng và số bàn là dữ liệu gốc để tạo link tablet tại từng bàn.</p>
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
  const [imagePath, setImagePath] = useState('');
  const [savingAllergenItemId, setSavingAllergenItemId] = useState('');
  const [form, setForm] = useState({
    nameVi: '',
    descVi: '',
    price: 50000,
    category: 'Món chính' as MenuItemCategory,
  });
  const selectedMenu = menus.find((menu) => menu.id === selectedMenuId);

  async function uploadMenu() {
    try {
      await ownerApi.uploadMenu(imagePath || undefined);
      setImagePath('');
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
      setForm({ nameVi: '', descVi: '', price: 50000, category: 'Món chính' });
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

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Menu và món</h2>
          <p className="muted">Tạo draft, nhập món, kiểm tra dị ứng rồi publish cho tablet tại bàn.</p>
        </div>
        <button className="secondary-button" onClick={uploadMenu}>
          <Plus size={16} />
          Menu draft
        </button>
      </div>
      <input
        placeholder="imagePath tùy chọn cho /menus/upload"
        value={imagePath}
        onChange={(event) => setImagePath(event.target.value)}
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
        <button
          className="primary-button"
          onClick={publishMenu}
          disabled={selectedMenu.status !== 'draft'}
        >
          <Check size={18} />
          Publish menu v{selectedMenu.version}
        </button>
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
        <button className="secondary-button" disabled={!selectedMenuId}>
          <Plus size={16} />
          Thêm món
        </button>
      </form>
      <div className="owner-item-list">
        {items.map((item) => (
          <article className="owner-item" key={item.id}>
            <div className="owner-item-main">
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
        <p>Tạo nhà hàng để có link tablet cho từng bàn.</p>
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
      onMessage(`Đã làm mới link tablet bàn ${tableNumber}`);
    } catch (err) {
      onError(readError(err));
    }
  }

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Tablet theo bàn</h2>
          <p className="muted">Mỗi link mở trên localhost:5174 và tự tạo session đúng bàn.</p>
        </div>
      </div>
      <div className="table-list">
        {restaurant.tables.map((table) => {
          const url = getTabletScanUrl(table.qrCode);
          return (
            <article className="table-row" key={table.tableNumber}>
              <div>
                <strong>Bàn {table.tableNumber}</strong>
                <span className={table.isActive ? 'table-state active' : 'table-state'}>{table.isActive ? 'Đang dùng' : 'Tạm tắt'}</span>
              </div>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Mở tablet
              </a>
              <button className="icon-button" onClick={() => revoke(table.tableNumber)} title="Làm mới link tablet" aria-label={`Làm mới link bàn ${table.tableNumber}`}>
                <RefreshCcw size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function OrdersBoard({
  orders,
  statusFilter,
  onStatusFilter,
  onUpdated,
  onError,
}: {
  orders: Order[];
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const tableGroups = useMemo(() => groupOrdersByTable(orders), [orders]);

  async function setStatus(order: Order, status: OrderStatus) {
    try {
      await ownerApi.updateOrderStatus(order.id, status);
      await onUpdated();
    } catch (err) {
      onError(readError(err));
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
              {group.orders.some((order) => order.allergyNotes) ? (
                <span className="warning-badge">
                  <AlertTriangle size={15} />
                  Dị ứng
                </span>
              ) : null}
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

function TabletApp() {
  const [session, setSession] = useState<Session | null>(() => readStored<Session>(SESSION_KEY));
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => readStored<CartItem[]>(CART_KEY) ?? []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allergens, setAllergens] = useState<AllergenType[]>([]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const data = new URL(window.location.href).searchParams.get('data');
    if (!data || session) return;

    startSession(`${window.location.origin}/scan?data=${data}`);
  }, [session]);

  useEffect(() => {
    if (!session) return;

    let ignore = false;
    const activeSession = session;
    async function load() {
      setLoading(true);
      try {
        const [menuResponse, orderResponse] = await Promise.all([
          tabletApi.getPublicMenu(activeSession.restaurantId, activeSession.sessionId),
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
  }, [session]);

  async function startSession(qrInput: string) {
    setLoading(true);
    setError('');
    try {
      const payload = parseQrPayload(qrInput);
      const response = await tabletApi.createSession(payload);
      localStorage.setItem(SESSION_KEY, JSON.stringify(response.data));
      setSession(response.data);
      setMessage(`Đã mở phiên bàn ${response.data.tableNumber}`);
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
      const response = await tabletApi.getPublicMenu(session.restaurantId, session.sessionId);
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
      <div className="app tablet-app">
        <TabletWelcome onStart={startSession} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <div className="app tablet-app">
      <header className="tablet-header">
        <div className="tablet-title">
          <span className="eyebrow">Tablet tại bàn {session.tableNumber}</span>
          <h1>{menu?.restaurant.name ?? 'SmartMenu'}</h1>
          {menu?.restaurant.address ? <p>{menu.restaurant.address}</p> : null}
        </div>
        <button className="icon-button" onClick={resetTablet} title="Reset tablet" aria-label="Reset tablet">
          <RefreshCcw size={18} />
        </button>
      </header>
      <StatusBanner message={message} error={error} onClear={() => {
        setMessage('');
        setError('');
      }} />
      {loading && !menu ? <LoadingState label="Đang tải menu" /> : null}
      {menu ? (
        <div className="tablet-layout">
          <section className="menu-column">
            <AllergenPicker selected={allergens} onChange={saveAllergens} />
            <MenuList menu={menu} onAdd={(item) => setCart(addItemToCart(cart, item))} />
            <p className="disclaimer">
              <ShieldAlert size={18} />
              {menu.disclaimer}
            </p>
          </section>
          <aside className="cart-column">
            <CartPanel
              cart={cart}
              customerNotes={customerNotes}
              orders={orders}
              loading={loading}
              onNotesChange={setCustomerNotes}
              onQuantityChange={(id, quantity) => setCart(updateCartQuantity(cart, id, quantity))}
              onSubmit={submitOrder}
            />
          </aside>
        </div>
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
        <span className="eyebrow">localhost:5174</span>
        <h1>Chọn món tại bàn</h1>
        <p>
          Mở link bàn từ màn chủ quán. Nếu đang cài tablet thủ công, dán URL bàn vào ô bên dưới
          để bắt đầu phiên gọi món.
        </p>
        <textarea
          value={qrInput}
          onChange={(event) => setQrInput(event.target.value)}
          placeholder="Dán URL bàn dạng /scan?data=..."
          rows={4}
        />
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button large" onClick={() => onStart(qrInput)} disabled={loading || !qrInput}>
          {loading ? <Loader2 className="spin" size={20} /> : <QrCode size={20} />}
          Mở menu bàn này
        </button>
      </section>
    </main>
  );
}

function AllergenPicker({
  selected,
  onChange,
}: {
  selected: AllergenType[];
  onChange: (allergens: AllergenType[]) => void;
}) {
  function toggle(value: AllergenType) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <section className="allergen-strip">
      <div>
        <h2>Dị ứng</h2>
        <p className="muted">Chọn chất cần tránh. Món đỏ/vàng cần hỏi lại nhân viên trước khi đặt.</p>
      </div>
      <div className="chip-list">
        {ALLERGEN_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={selected.includes(option.value) ? 'chip selected' : 'chip'}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function MenuList({
  menu,
  onAdd,
}: {
  menu: PublicMenu;
  onAdd: (item: PublicMenuItem) => void;
}) {
  const categories = Object.entries(menu.categories);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.[0] ?? '');
  const [query, setQuery] = useState('');
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
          placeholder="Tìm món..."
          aria-label="Tìm món"
        />
        <div className="category-tabs" role="tablist" aria-label="Danh mục món">
          {categories.map(([category]) => (
            <button
              key={category}
              className={category === activeCategory ? 'active' : ''}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      {visibleCategories.length === 0 ? (
        <div className="empty-state">
          <Utensils size={28} />
          <p>Không có món phù hợp.</p>
        </div>
      ) : null}
      {visibleCategories.map(([category, items]) => (
        <section key={category}>
          <h2>{category}</h2>
          <div className="dish-grid">
            {items.map((item) => (
              <article className="dish-card" key={item.id}>
                <div className={`allergen-dot ${item.allergenLabel}`} title={getAllergenLabelText(item.allergenLabel)}>
                  {item.allergenLabel === 'red' ? <AlertTriangle size={16} /> : <Check size={16} />}
                </div>
                <div>
                  <h3>{item.name}</h3>
                  {item.description ? <p>{item.description}</p> : null}
                  <div className="dish-meta">
                    <span>{formatVnd(item.price)}</span>
                    {item.allergenLabel !== 'none' ? (
                      <small className={`risk-text ${item.allergenLabel}`}>{getAllergenLabelText(item.allergenLabel)}</small>
                    ) : null}
                  </div>
                </div>
                <button className="icon-button filled" onClick={() => onAdd(item)} title="Thêm vào giỏ">
                  <Plus size={18} />
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function getAllergenLabelText(label: PublicMenuItem['allergenLabel']) {
  switch (label) {
    case 'red':
      return 'Có chất dị ứng đã chọn';
    case 'yellow':
      return 'Cần hỏi lại nhân viên';
    case 'green':
      return 'Không trùng dị ứng đã chọn';
    default:
      return 'Chưa chọn dị ứng';
  }
}

function CartPanel({
  cart,
  customerNotes,
  orders,
  loading,
  onNotesChange,
  onQuantityChange,
  onSubmit,
}: {
  cart: CartItem[];
  customerNotes: string;
  orders: Order[];
  loading: boolean;
  onNotesChange: (notes: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onSubmit: () => void;
}) {
  const total = useMemo(() => getCartTotal(cart), [cart]);
  const riskyItems = cart.filter((item) => item.allergenLabel === 'red' || item.allergenLabel === 'yellow');

  return (
    <div className="cart-panel">
      <div className="section-heading">
        <div>
          <h2>Giỏ món</h2>
          <p className="muted">{cart.length} món · {formatVnd(total)}</p>
        </div>
        <ShoppingCart size={24} />
      </div>
      {riskyItems.length > 0 ? (
        <div className="cart-warning">
          <AlertTriangle size={18} />
          <span>{riskyItems.length} món trong giỏ cần kiểm tra dị ứng với nhân viên.</span>
        </div>
      ) : null}
      {cart.length === 0 ? <p className="muted">Chọn món trong menu để bắt đầu.</p> : null}
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
        Ghi chú cho quán
        <textarea
          value={customerNotes}
          onChange={(event) => onNotesChange(event.target.value.slice(0, 200))}
          rows={3}
          placeholder="Ví dụ: ít cay, không hành..."
        />
      </label>
      <button className="primary-button large" onClick={onSubmit} disabled={loading || cart.length === 0}>
        {loading ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
        Gửi đơn
      </button>
      <div className="session-orders">
        <h3>Đơn đã gọi</h3>
        {orders.length === 0 ? <p className="muted">Chưa có đơn.</p> : null}
        {orders.map((order) => (
          <article className="mini-order" key={order.id}>
            <div>
              <strong>{ORDER_STATUS_LABEL[order.status]}</strong>
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
  if (!message && !error) return null;

  return (
    <div className={error ? 'status-banner error' : 'status-banner'}>
      <span>{error || message}</span>
      <button onClick={onClear}>Đóng</button>
    </div>
  );
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

function readError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Có lỗi xảy ra';
}
