/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export interface IOrderItem {
  menuItemId: Types.ObjectId;
  nameVi: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface IOrder extends Document {
  restaurantId: Types.ObjectId;
  sessionId: string;
  tableNumber: number;
  items: IOrderItem[];
  status: OrderStatus;
  allergyNotes?: string;
  customerNotes?: string;
  totalPrice: number;
  servedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    nameVi: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    notes: {
      type: String,
      maxlength: 200,
    },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    tableNumber: {
      type: Number,
      required: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length >= 1,
        message: 'Đơn hàng phải có ít nhất 1 món',
      },
    },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'served',
        'completed',
        'cancelled',
      ],
      default: 'pending',
    },
    allergyNotes: {
      type: String,
    },
    customerNotes: {
      type: String,
      maxlength: 200,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    servedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ sessionId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, tableNumber: 1, createdAt: -1 });

const Order = mongoose.model<IOrder>('Order', OrderSchema);
export default Order;
