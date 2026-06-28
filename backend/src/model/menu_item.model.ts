/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { ALLERGEN_TYPES, AllergenType } from './session.model';

export type MenuItemCategory =
  | 'Khai vị'
  | 'Món chính'
  | 'Tráng miệng'
  | 'Đồ uống'
  | 'Khác';

export type MenuItemStatus = 'available' | 'sold_out' | 'hidden';

export type AllergenConfidence = 'contains' | 'may_contain' | 'unknown';

export type AllergenSource = 'ai' | 'owner_verified';

export interface IAllergenTag {
  allergen: AllergenType;
  confidence: AllergenConfidence;
  source: AllergenSource;
}

export interface ITranslation {
  language: string;
  translatedName: string;
  translatedDesc?: string;
  cachedAt: Date;
}

export interface IMenuItem extends Document {
  menuId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  nameVi: string;
  descVi?: string;
  price: number;
  category: MenuItemCategory;
  status: MenuItemStatus;
  imageUrl?: string;
  imageS3Key?: string;
  allergenTags: IAllergenTag[];
  allergenVerified: boolean;
  translations: ITranslation[];
  createdAt: Date;
  updatedAt: Date;
}

const AllergenTagSchema = new Schema<IAllergenTag>(
  {
    allergen: {
      type: String,
      enum: ALLERGEN_TYPES,
      required: true,
    },
    confidence: {
      type: String,
      enum: ['contains', 'may_contain', 'unknown'],
      required: true,
    },
    source: {
      type: String,
      enum: ['ai', 'owner_verified'],
      required: true,
    },
  },
  { _id: false },
);

const TranslationSchema = new Schema<ITranslation>(
  {
    language: { type: String, required: true },
    translatedName: { type: String, required: true },
    translatedDesc: { type: String },
    cachedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const MenuItemSchema = new Schema<IMenuItem>(
  {
    menuId: {
      type: Schema.Types.ObjectId,
      ref: 'Menu',
      required: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    nameVi: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    descVi: {
      type: String,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      max: 10000000,
    },
    category: {
      type: String,
      enum: ['Khai vị', 'Món chính', 'Tráng miệng', 'Đồ uống', 'Khác'],
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'sold_out', 'hidden'],
      default: 'available',
    },
    imageUrl: { type: String },
    imageS3Key: { type: String },
    allergenTags: [AllergenTagSchema],
    allergenVerified: {
      type: Boolean,
      default: false,
    },
    translations: [TranslationSchema],
  },
  {
    timestamps: true,
  },
);

MenuItemSchema.index({ menuId: 1, category: 1 });
MenuItemSchema.index({ restaurantId: 1, status: 1 });
MenuItemSchema.index({ menuId: 1, nameVi: 1 });

const MenuItem = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
export default MenuItem;
