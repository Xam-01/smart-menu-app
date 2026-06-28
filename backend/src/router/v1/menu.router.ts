/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import uploadMenu from 'src/controller/v1/menu/upload_menu';
import getMenus from 'src/controller/v1/menu/get_menus';
import publishMenu from 'src/controller/v1/menu/publish_menu';
import createMenuItem from 'src/controller/v1/menu_item/create_menu_item';
import getMenuItems from 'src/controller/v1/menu_item/get_menu_items';
import updateMenuItem from 'src/controller/v1/menu_item/update_menu_item';
import deleteMenuItem from 'src/controller/v1/menu_item/delete_menu_item';
import updateAllergens from 'src/controller/v1/menu_item/update_allergens';
import validationError from 'src/middleware/validationError';
import { authenticate } from 'src/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/upload', uploadMenu);

router.get('/', getMenus);

router.post(
  '/:menuId/publish',
  [param('menuId').notEmpty()],
  validationError,
  publishMenu,
);

router.get(
  '/:menuId/items',
  [param('menuId').notEmpty()],
  validationError,
  getMenuItems,
);

router.post(
  '/:menuId/items',
  [
    param('menuId').notEmpty(),
    body('nameVi')
      .notEmpty()
      .trim()
      .withMessage('Tên món tiếng Việt là bắt buộc'),
    body('price')
      .isInt({ min: 1, max: 10000000 })
      .withMessage('Giá phải từ 1 đến 10,000,000 VND'),
    body('category')
      .isIn(['Khai vị', 'Món chính', 'Tráng miệng', 'Đồ uống', 'Khác'])
      .withMessage('Danh mục không hợp lệ'),
    body('descVi')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Mô tả tối đa 500 ký tự'),
    body('status')
      .optional()
      .isIn(['available', 'sold_out', 'hidden'])
      .withMessage('Trạng thái không hợp lệ'),
  ],
  validationError,
  createMenuItem,
);

router.patch(
  '/:menuId/items/:itemId',
  [
    param('menuId').notEmpty(),
    param('itemId').notEmpty(),
    body('price')
      .optional()
      .isInt({ min: 1, max: 10000000 })
      .withMessage('Giá phải từ 1 đến 10,000,000 VND'),
    body('status')
      .optional()
      .isIn(['available', 'sold_out', 'hidden'])
      .withMessage('Trạng thái không hợp lệ'),
    body('descVi')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Mô tả tối đa 500 ký tự'),
  ],
  validationError,
  updateMenuItem,
);

router.delete(
  '/:menuId/items/:itemId',
  [param('menuId').notEmpty(), param('itemId').notEmpty()],
  validationError,
  deleteMenuItem,
);

router.patch(
  '/:menuId/items/:itemId/allergens',
  [
    param('menuId').notEmpty(),
    param('itemId').notEmpty(),
    body('allergenTags').isArray().withMessage('allergenTags phải là mảng'),
  ],
  validationError,
  updateAllergens,
);

export default router;
