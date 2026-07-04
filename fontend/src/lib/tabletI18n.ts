import type { AllergenType, OrderStatus, PublicMenuItem } from './types';

export type TabletLanguage = 'vi' | 'en' | 'ko' | 'ja' | 'zh';

export const TABLET_LANGUAGES: Array<{ value: TabletLanguage; label: string }> = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
];

export const TABLET_COPY: Record<TabletLanguage, {
  table: string;
  resetTablet: string;
  loadingMenu: string;
  language: string;
  allergyFilter: string;
  noneSelected: string;
  selectedCount: (count: number) => string;
  searchDishes: string;
  menuCategories: string;
  noMatchingDishes: string;
  addToCart: string;
  cart: string;
  itemsTotal: (count: number, total: string) => string;
  cartEmpty: string;
  allergyCartWarning: (count: number) => string;
  notesLabel: string;
  notesPlaceholder: string;
  sendOrder: string;
  cashPayment: string;
  sessionOrders: string;
  noOrders: string;
  disclaimer: string;
}> = {
  vi: {
    table: 'Tablet tại bàn',
    resetTablet: 'Reset tablet',
    loadingMenu: 'Đang tải menu',
    language: 'Ngôn ngữ',
    allergyFilter: 'Lọc dị ứng',
    noneSelected: 'Chưa chọn',
    selectedCount: (count) => `${count} đã chọn`,
    searchDishes: 'Tìm món...',
    menuCategories: 'Danh mục món',
    noMatchingDishes: 'Không có món phù hợp.',
    addToCart: 'Thêm vào giỏ',
    cart: 'Giỏ món',
    itemsTotal: (count, total) => `${count} món · ${total}`,
    cartEmpty: 'Chọn món trong menu để bắt đầu.',
    allergyCartWarning: (count) => `${count} món trong giỏ cần kiểm tra dị ứng với nhân viên.`,
    notesLabel: 'Ghi chú cho quán',
    notesPlaceholder: 'Ví dụ: ít cay, không hành...',
    sendOrder: 'Gửi đơn',
    cashPayment: 'Thanh toán tiền mặt',
    sessionOrders: 'Đơn đã gọi',
    noOrders: 'Chưa có đơn.',
    disclaimer:
      'Thông tin dị ứng mang tính tham khảo. Vui lòng xác nhận lại với nhân viên nếu bạn dị ứng nặng.',
  },
  en: {
    table: 'Table tablet',
    resetTablet: 'Reset tablet',
    loadingMenu: 'Loading menu',
    language: 'Language',
    allergyFilter: 'Allergy filter',
    noneSelected: 'None selected',
    selectedCount: (count) => `${count} selected`,
    searchDishes: 'Search dishes...',
    menuCategories: 'Menu categories',
    noMatchingDishes: 'No matching dishes.',
    addToCart: 'Add to cart',
    cart: 'Cart',
    itemsTotal: (count, total) => `${count} items · ${total}`,
    cartEmpty: 'Choose dishes from the menu to start.',
    allergyCartWarning: (count) => `${count} cart items need allergy review with staff.`,
    notesLabel: 'Notes for the restaurant',
    notesPlaceholder: 'Example: less spicy, no onion...',
    sendOrder: 'Send order',
    cashPayment: 'Pay cash',
    sessionOrders: 'Sent orders',
    noOrders: 'No orders yet.',
    disclaimer:
      'Allergy information is for reference only. Please confirm with staff if you have severe allergies.',
  },
  ko: {
    table: '테이블 태블릿',
    resetTablet: '태블릿 초기화',
    loadingMenu: '메뉴 불러오는 중',
    language: '언어',
    allergyFilter: '알레르기 필터',
    noneSelected: '선택 없음',
    selectedCount: (count) => `${count}개 선택됨`,
    searchDishes: '메뉴 검색...',
    menuCategories: '메뉴 카테고리',
    noMatchingDishes: '일치하는 메뉴가 없습니다.',
    addToCart: '담기',
    cart: '장바구니',
    itemsTotal: (count, total) => `${count}개 · ${total}`,
    cartEmpty: '메뉴에서 음식을 선택하세요.',
    allergyCartWarning: (count) => `장바구니의 ${count}개 메뉴는 직원에게 알레르기 확인이 필요합니다.`,
    notesLabel: '요청 사항',
    notesPlaceholder: '예: 덜 맵게, 양파 제외...',
    sendOrder: '주문 보내기',
    cashPayment: '현금 결제',
    sessionOrders: '보낸 주문',
    noOrders: '아직 주문이 없습니다.',
    disclaimer: '알레르기 정보는 참고용입니다. 심한 알레르기가 있으면 직원에게 확인하세요.',
  },
  ja: {
    table: 'テーブル用タブレット',
    resetTablet: 'タブレットをリセット',
    loadingMenu: 'メニューを読み込み中',
    language: '言語',
    allergyFilter: 'アレルギーフィルター',
    noneSelected: '未選択',
    selectedCount: (count) => `${count}件選択中`,
    searchDishes: '料理を検索...',
    menuCategories: 'メニューカテゴリ',
    noMatchingDishes: '該当する料理がありません。',
    addToCart: 'カートに追加',
    cart: 'カート',
    itemsTotal: (count, total) => `${count}品 · ${total}`,
    cartEmpty: 'メニューから料理を選んでください。',
    allergyCartWarning: (count) => `カート内の${count}品はスタッフにアレルギー確認が必要です。`,
    notesLabel: 'お店へのメモ',
    notesPlaceholder: '例: 辛さ控えめ、玉ねぎ抜き...',
    sendOrder: '注文を送信',
    cashPayment: '現金で支払う',
    sessionOrders: '送信済み注文',
    noOrders: 'まだ注文はありません。',
    disclaimer: 'アレルギー情報は参考です。重いアレルギーがある場合はスタッフに確認してください。',
  },
  zh: {
    table: '餐桌平板',
    resetTablet: '重置平板',
    loadingMenu: '正在加载菜单',
    language: '语言',
    allergyFilter: '过敏筛选',
    noneSelected: '未选择',
    selectedCount: (count) => `已选择 ${count} 项`,
    searchDishes: '搜索菜品...',
    menuCategories: '菜单分类',
    noMatchingDishes: '没有匹配的菜品。',
    addToCart: '加入购物车',
    cart: '购物车',
    itemsTotal: (count, total) => `${count} 项 · ${total}`,
    cartEmpty: '请从菜单中选择菜品。',
    allergyCartWarning: (count) => `购物车中 ${count} 个菜品需要与员工确认过敏信息。`,
    notesLabel: '给餐厅的备注',
    notesPlaceholder: '例如：少辣，不要洋葱...',
    sendOrder: '发送订单',
    cashPayment: '现金支付',
    sessionOrders: '已发送订单',
    noOrders: '暂无订单。',
    disclaimer: '过敏信息仅供参考。如有严重过敏，请与员工确认。',
  },
};

const ALLERGEN_LABELS: Record<TabletLanguage, Record<AllergenType, string>> = {
  vi: {
    crustacean: 'Giáp xác',
    fish: 'Cá',
    mollusc: 'Nhuyễn thể',
    peanut: 'Đậu phộng',
    tree_nut: 'Hạt cây',
    milk: 'Sữa',
    egg: 'Trứng',
    gluten: 'Gluten',
    soy: 'Đậu nành',
    sesame: 'Mè',
    celery: 'Cần tây',
    mustard: 'Mù tạt',
    lupin: 'Lupin',
    sulphite: 'Sulphite',
  },
  en: {
    crustacean: 'Crustacean shellfish',
    fish: 'Fish',
    mollusc: 'Mollusc',
    peanut: 'Peanut',
    tree_nut: 'Tree nut',
    milk: 'Milk',
    egg: 'Egg',
    gluten: 'Gluten',
    soy: 'Soy',
    sesame: 'Sesame',
    celery: 'Celery',
    mustard: 'Mustard',
    lupin: 'Lupin',
    sulphite: 'Sulphite',
  },
  ko: {
    crustacean: '갑각류',
    fish: '생선',
    mollusc: '연체동물',
    peanut: '땅콩',
    tree_nut: '견과류',
    milk: '우유',
    egg: '달걀',
    gluten: '글루텐',
    soy: '대두',
    sesame: '참깨',
    celery: '셀러리',
    mustard: '겨자',
    lupin: '루핀',
    sulphite: '아황산염',
  },
  ja: {
    crustacean: '甲殻類',
    fish: '魚',
    mollusc: '軟体動物',
    peanut: 'ピーナッツ',
    tree_nut: '木の実',
    milk: '乳',
    egg: '卵',
    gluten: 'グルテン',
    soy: '大豆',
    sesame: 'ごま',
    celery: 'セロリ',
    mustard: 'マスタード',
    lupin: 'ルピナス',
    sulphite: '亜硫酸塩',
  },
  zh: {
    crustacean: '甲壳类',
    fish: '鱼',
    mollusc: '软体动物',
    peanut: '花生',
    tree_nut: '坚果',
    milk: '牛奶',
    egg: '鸡蛋',
    gluten: '麸质',
    soy: '大豆',
    sesame: '芝麻',
    celery: '芹菜',
    mustard: '芥末',
    lupin: '羽扇豆',
    sulphite: '亚硫酸盐',
  },
};

const RISK_LABELS: Record<TabletLanguage, Record<PublicMenuItem['allergenLabel'], string>> = {
  vi: {
    red: 'Có chất dị ứng đã chọn',
    yellow: 'Cần hỏi lại nhân viên',
    green: 'Không trùng dị ứng đã chọn',
    none: 'Chưa chọn dị ứng',
  },
  en: {
    red: 'Contains a selected allergen',
    yellow: 'Ask staff before ordering',
    green: 'No selected allergen match',
    none: 'No allergy filter selected',
  },
  ko: {
    red: '선택한 알레르기 포함',
    yellow: '주문 전 직원에게 문의',
    green: '선택한 알레르기와 일치 없음',
    none: '알레르기 필터 미선택',
  },
  ja: {
    red: '選択したアレルゲンを含みます',
    yellow: '注文前にスタッフへ確認',
    green: '選択したアレルゲンに該当しません',
    none: 'アレルギーフィルター未選択',
  },
  zh: {
    red: '含有所选过敏原',
    yellow: '下单前请询问员工',
    green: '未匹配所选过敏原',
    none: '未选择过敏筛选',
  },
};

const ORDER_STATUS_LABELS: Record<TabletLanguage, Record<OrderStatus, string>> = {
  vi: {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang làm',
    ready: 'Sẵn sàng',
    served: 'Đã phục vụ',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
  },
  en: {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    served: 'Served',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
  ko: {
    pending: '확인 대기',
    confirmed: '확인됨',
    preparing: '준비 중',
    ready: '준비 완료',
    served: '서빙 완료',
    completed: '완료',
    cancelled: '취소됨',
  },
  ja: {
    pending: '確認待ち',
    confirmed: '確認済み',
    preparing: '調理中',
    ready: '準備完了',
    served: '提供済み',
    completed: '完了',
    cancelled: 'キャンセル',
  },
  zh: {
    pending: '待确认',
    confirmed: '已确认',
    preparing: '制作中',
    ready: '已备好',
    served: '已上菜',
    completed: '已完成',
    cancelled: '已取消',
  },
};

const CATEGORY_LABELS: Record<string, Partial<Record<TabletLanguage, string>>> = {
  'Khai vị': { en: 'Appetizers', ko: '전채', ja: '前菜', zh: '前菜' },
  'Khai vá»‹': { en: 'Appetizers', ko: '전채', ja: '前菜', zh: '前菜' },
  'Món chính': { en: 'Main dishes', ko: '메인', ja: 'メイン', zh: '主菜' },
  'MÃ³n chÃ­nh': { en: 'Main dishes', ko: '메인', ja: 'メイン', zh: '主菜' },
  'Tráng miệng': { en: 'Desserts', ko: '디저트', ja: 'デザート', zh: '甜点' },
  'TrÃ¡ng miá»‡ng': { en: 'Desserts', ko: '디저트', ja: 'デザート', zh: '甜点' },
  'Đồ uống': { en: 'Drinks', ko: '음료', ja: 'ドリンク', zh: '饮品' },
  'Äá»“ uá»‘ng': { en: 'Drinks', ko: '음료', ja: 'ドリンク', zh: '饮品' },
  Khác: { en: 'Other', ko: '기타', ja: 'その他', zh: '其他' },
  'KhÃ¡c': { en: 'Other', ko: '기타', ja: 'その他', zh: '其他' },
};

export function toTabletLanguage(language: string): TabletLanguage {
  return ['vi', 'en', 'ko', 'ja', 'zh'].includes(language) ? (language as TabletLanguage) : 'vi';
}

export function getTabletCopy(language: string) {
  return TABLET_COPY[toTabletLanguage(language)];
}

export function getLocalizedAllergenLabel(allergen: AllergenType, language: string) {
  return ALLERGEN_LABELS[toTabletLanguage(language)][allergen];
}

export function getLocalizedRiskLabel(label: PublicMenuItem['allergenLabel'], language: string) {
  return RISK_LABELS[toTabletLanguage(language)][label];
}

export function getLocalizedOrderStatus(status: OrderStatus, language: string) {
  return ORDER_STATUS_LABELS[toTabletLanguage(language)][status];
}

export function getLocalizedCategory(category: string, language: string) {
  const lang = toTabletLanguage(language);
  if (lang === 'vi') return category;
  return CATEGORY_LABELS[category]?.[lang] ?? category;
}
