/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type RestaurantStatus = 'active' | 'inactive' | 'suspended';

export interface ITable {
  tableNumber: number;
  qrCode: string;
  qrSecret: string;
  isActive: boolean;
}

export interface IRestaurant extends Document {
  ownerId: Types.ObjectId;
  name: string;
  address: string;
  phone?: string;
  description?: string;
  tableCount: number;
  tables: ITable[];
  status: RestaurantStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    tableNumber: { type: Number, required: true },
    qrCode: { type: String, required: true },
    qrSecret: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const RestaurantSchema = new Schema<IRestaurant>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'Owner',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    tableCount: {
      type: Number,
      required: true,
      min: 1,
      max: 200,
    },
    tables: [TableSchema],
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  },
);

RestaurantSchema.index({ name: 1, address: 1 }, { unique: true });
RestaurantSchema.index({ ownerId: 1 });

const Restaurant = mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
export default Restaurant;
