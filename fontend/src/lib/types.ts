export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type Owner = {
  id: string;
  email: string;
  role: 'owner' | 'admin';
};

export type LoginResult = {
  accessToken: string;
  owner: Owner;
};

export type RestaurantStatus = 'active' | 'inactive' | 'suspended';

export type RestaurantTable = {
  tableNumber: number;
  qrCode: string;
  isActive: boolean;
};

export type Restaurant = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  description?: string;
  tableCount: number;
  status: RestaurantStatus;
  tables: RestaurantTable[];
  createdAt?: string;
  updatedAt?: string;
};

export type MenuStatus = 'draft' | 'published' | 'archived';

export type Menu = {
  id: string;
  version: number;
  status: MenuStatus;
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  publishedAt?: string;
  archivedAt?: string;
  createdAt?: string;
};

export type MenuItemCategory =
  | 'Khai vị'
  | 'Món chính'
  | 'Tráng miệng'
  | 'Đồ uống'
  | 'Khác';

export type MenuItemStatus = 'available' | 'sold_out' | 'hidden';

export type AllergenType =
  | 'crustacean'
  | 'fish'
  | 'mollusc'
  | 'peanut'
  | 'tree_nut'
  | 'milk'
  | 'egg'
  | 'gluten'
  | 'soy'
  | 'sesame'
  | 'celery'
  | 'mustard'
  | 'lupin'
  | 'sulphite';

export type AllergenTag = {
  allergen: AllergenType;
  confidence: 'contains' | 'may_contain' | 'unknown';
  source?: 'ai' | 'owner_verified';
};

export type OwnerMenuItem = {
  id: string;
  nameVi: string;
  descVi?: string;
  price: number;
  category: MenuItemCategory;
  status: MenuItemStatus;
  imageUrl?: string;
  allergenTags: AllergenTag[];
  allergenVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicMenuItem = {
  id: string;
  nameVi: string;
  name: string;
  description?: string;
  price: number;
  category: MenuItemCategory;
  imageUrl?: string;
  allergenTags: AllergenTag[];
  allergenVerified: boolean;
  allergenLabel: 'red' | 'yellow' | 'green' | 'none';
};

export type PublicMenu = {
  restaurant: Pick<Restaurant, 'id' | 'name' | 'address' | 'description'>;
  menu: Pick<Menu, 'id' | 'version' | 'publishedAt'>;
  categories: Record<string, PublicMenuItem[]>;
  guestAllergens: AllergenType[];
  language: string;
  disclaimer: string;
};

export type SessionInput = {
  restaurantId: string;
  tableNumber: number;
  qrSecret: string;
};

export type Session = {
  sessionId: string;
  restaurantId: string;
  tableNumber: number;
  expiresAt: string;
};

export type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  allergenLabel: PublicMenuItem['allergenLabel'];
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type OrderItem = {
  menuItemId?: string;
  nameVi: string;
  name?: string;
  price: number;
  quantity: number;
  notes?: string;
};

export type Order = {
  id: string;
  tableNumber: number;
  items: OrderItem[];
  status: OrderStatus;
  allergyNotes?: string;
  customerNotes?: string;
  totalPrice: number;
  createdAt: string;
  updatedAt?: string;
};
