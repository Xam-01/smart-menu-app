/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import Restaurant from 'src/model/restaurant.model';
import Menu from 'src/model/menu.model';
import MenuItem from 'src/model/menu_item.model';
import Session from 'src/model/session.model';
import type { Request, Response } from 'express';
import type { AllergenType } from 'src/model/session.model';
import type { IMenuItem } from 'src/model/menu_item.model';

const getMenuPublic = async (req: Request, res: Response): Promise<void> => {
  const { restaurantId } = req.params;
  const { sessionId, lang = 'vi' } = req.query as {
    sessionId?: string;
    lang?: string;
  };

  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    status: 'active',
  }).select('name address description');
  if (!restaurant) {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Nhà hàng không tồn tại hoặc không hoạt động',
    });
    return;
  }

  const menu = await Menu.findOne({ restaurantId, status: 'published' });
  if (!menu) {
    res.status(404).json({
      success: false,
      code: 'MENU_NOT_FOUND',
      message: 'Nhà hàng chưa có menu',
    });
    return;
  }

  const items = await MenuItem.find({
    menuId: menu._id,
    status: 'available',
  }).select('-__v');

  let guestAllergens: AllergenType[] = [];
  if (sessionId) {
    const session = await Session.findOne({ sessionId });
    if (session && session.expiresAt > new Date()) {
      guestAllergens = session.allergens.map((a) => a.allergen);
    }
  }

  const calcAllergenLabel = (
    item: IMenuItem,
  ): 'red' | 'yellow' | 'green' | 'none' => {
    if (guestAllergens.length === 0) return 'none';

    const containsTags = item.allergenTags
      .filter((t) => t.confidence === 'contains')
      .map((t) => t.allergen);
    const mayContainTags = item.allergenTags
      .filter((t) => t.confidence === 'may_contain')
      .map((t) => t.allergen);

    if (guestAllergens.some((a) => containsTags.includes(a))) return 'red';
    if (
      guestAllergens.some((a) => mayContainTags.includes(a)) ||
      !item.allergenVerified
    )
      return 'yellow';
    return 'green';
  };

  const mapItem = (item: IMenuItem) => {
    const translation =
      lang !== 'vi' ? item.translations.find((t) => t.language === lang) : null;
    return {
      id: item._id,
      nameVi: item.nameVi,
      name: translation ? translation.translatedName : item.nameVi,
      description: translation ? translation.translatedDesc : item.descVi,
      price: item.price,
      category: item.category,
      imageUrl: item.imageUrl,
      allergenTags: item.allergenTags.map((t) => ({
        allergen: t.allergen,
        confidence: t.confidence,
        source: t.source,
      })),
      allergenVerified: item.allergenVerified,
      allergenLabel: calcAllergenLabel(item),
    };
  };

  const grouped: Record<string, ReturnType<typeof mapItem>[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(mapItem(item));
  }

  res.status(200).json({
    success: true,
    message: 'Menu nhà hàng',
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        address: restaurant.address,
        description: restaurant.description,
      },
      menu: {
        id: menu._id,
        version: menu.version,
        publishedAt: menu.publishedAt,
      },
      categories: grouped,
      guestAllergens,
      language: lang,
      disclaimer:
        'Thông tin dị ứng mang tính tham khảo. Vui lòng xác nhận lại với nhân viên nếu bạn dị ứng nặng.',
    },
  });
};

export default getMenuPublic;
