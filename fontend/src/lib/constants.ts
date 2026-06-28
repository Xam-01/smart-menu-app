import type { AllergenType, MenuItemCategory, OrderStatus } from './types';

export const CATEGORIES: MenuItemCategory[] = [
  'Khai vị',
  'Món chính',
  'Tráng miệng',
  'Đồ uống',
  'Khác',
];

export const ALLERGEN_OPTIONS: Array<{ value: AllergenType; label: string }> = [
  { value: 'crustacean', label: 'Giáp xác' },
  { value: 'fish', label: 'Cá' },
  { value: 'mollusc', label: 'Nhuyễn thể' },
  { value: 'peanut', label: 'Đậu phộng' },
  { value: 'tree_nut', label: 'Hạt cây' },
  { value: 'milk', label: 'Sữa' },
  { value: 'egg', label: 'Trứng' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'soy', label: 'Đậu nành' },
  { value: 'sesame', label: 'Mè' },
  { value: 'celery', label: 'Cần tây' },
  { value: 'mustard', label: 'Mù tạt' },
  { value: 'lupin', label: 'Lupin' },
  { value: 'sulphite', label: 'Sulphite' },
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang làm',
  ready: 'Sẵn sàng',
  served: 'Đã phục vụ',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['served'],
  served: ['completed'],
};
