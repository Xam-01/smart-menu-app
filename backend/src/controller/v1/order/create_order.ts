/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Session from 'src/model/session.model';
import Restaurant from 'src/model/restaurant.model';
import Menu from 'src/model/menu.model';
import MenuItem from 'src/model/menu_item.model';
import Order from 'src/model/order.model';
import type { Request, Response } from 'express';
import type { IOrderItem } from 'src/model/order.model';

interface CreateOrderBody {
  sessionId: string;
  items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
  customerNotes?: string;
}

const createOrder = async (req: Request, res: Response): Promise<void> => {
  const { sessionId, items, customerNotes } = req.body as CreateOrderBody;

  const session = await Session.findOne({ sessionId });
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({
      success: false,
      code: 'SESSION_INVALID',
      message: 'Session không hợp lệ hoặc đã hết hạn. Vui lòng quét QR lại.',
    });
    return;
  }

  if (!items || items.length === 0) {
    res.status(422).json({
      success: false,
      code: 'EMPTY_ORDER',
      message: 'Đơn hàng phải có ít nhất 1 món',
    });
    return;
  }

  const restaurant = await Restaurant.findById(session.restaurantId);
  if (!restaurant || restaurant.status !== 'active') {
    res.status(404).json({
      success: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Nhà hàng không tồn tại hoặc không hoạt động',
    });
    return;
  }

  const activeOrdersCount = await Order.countDocuments({
    restaurantId: restaurant._id,
    status: { $nin: ['completed', 'cancelled'] },
  });
  if (activeOrdersCount >= 50) {
    res.status(503).json({
      success: false,
      code: 'RESTAURANT_QUEUE_FULL',
      message: 'Nhà hàng đang rất bận. Vui lòng thử lại sau.',
    });
    return;
  }

  const menu = await Menu.findOne({
    restaurantId: restaurant._id,
    status: 'published',
  });
  if (!menu) {
    res.status(404).json({
      success: false,
      code: 'MENU_NOT_FOUND',
      message: 'Nhà hàng chưa có menu',
    });
    return;
  }

  const orderItems: IOrderItem[] = [];
  let totalPrice = 0;
  const rejectedItems: string[] = [];

  for (const reqItem of items) {
    if (reqItem.quantity < 1 || reqItem.quantity > 20) {
      res.status(422).json({
        success: false,
        code: 'INVALID_QUANTITY',
        message: `Số lượng món phải từ 1 đến 20 (món: ${reqItem.menuItemId})`,
      });
      return;
    }

    const menuItem = await MenuItem.findOne({
      _id: reqItem.menuItemId,
      menuId: menu._id,
    });

    if (!menuItem || menuItem.status !== 'available') {
      rejectedItems.push(reqItem.menuItemId);
      continue;
    }

    orderItems.push({
      menuItemId: menuItem._id,
      nameVi: menuItem.nameVi,
      price: menuItem.price,
      quantity: reqItem.quantity,
      notes: reqItem.notes,
    });
    totalPrice += menuItem.price * reqItem.quantity;
  }

  if (rejectedItems.length > 0) {
    res.status(422).json({
      success: false,
      code: 'ITEMS_UNAVAILABLE',
      message: 'Một số món không còn phục vụ',
      data: { rejectedItemIds: rejectedItems },
    });
    return;
  }

  if (orderItems.length === 0) {
    res.status(422).json({
      success: false,
      code: 'EMPTY_ORDER',
      message: 'Đơn hàng không có món hợp lệ',
    });
    return;
  }

  let allergyNotes: string | undefined;
  if (session.allergens.length > 0) {
    allergyNotes = `Khách dị ứng: ${session.allergens.map((a) => a.allergen).join(', ')}`;
  }

  const validatedNotes =
    customerNotes && customerNotes.length > 200
      ? customerNotes.substring(0, 200)
      : customerNotes;

  const order = await Order.create({
    restaurantId: restaurant._id,
    sessionId: session.sessionId,
    tableNumber: session.tableNumber,
    items: orderItems,
    status: 'pending',
    allergyNotes,
    customerNotes: validatedNotes,
    totalPrice,
  });

  session.lastInteractionAt = new Date();
  await session.save();

  logger.info(
    `Order created: ${order._id} for table ${session.tableNumber} at restaurant ${restaurant._id}`,
  );

  res.status(201).json({
    success: true,
    message: 'Đơn hàng đã được đặt thành công',
    data: {
      id: order._id,
      tableNumber: order.tableNumber,
      items: order.items,
      status: order.status,
      allergyNotes: order.allergyNotes,
      customerNotes: order.customerNotes,
      totalPrice: order.totalPrice,
      createdAt: order.createdAt,
    },
  });
};

export default createOrder;
