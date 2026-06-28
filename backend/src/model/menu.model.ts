/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type MenuStatus = 'draft' | 'published' | 'archived';

export interface IMenu extends Document {
  restaurantId: Types.ObjectId;
  version: number;
  status: MenuStatus;
  originalImagePath?: string;
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  ocrJobId?: string;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MenuSchema = new Schema<IMenu>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    originalImagePath: {
      type: String,
    },
    ocrStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
    },
    ocrJobId: {
      type: String,
    },
    publishedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

MenuSchema.index({ restaurantId: 1, status: 1 });
MenuSchema.index({ restaurantId: 1, version: -1 });

const Menu = mongoose.model<IMenu>('Menu', MenuSchema);
export default Menu;
