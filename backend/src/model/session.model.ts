/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export const ALLERGEN_TYPES = [
  'crustacean',
  'fish',
  'mollusc',
  'peanut',
  'tree_nut',
  'milk',
  'egg',
  'gluten',
  'soy',
  'sesame',
  'celery',
  'mustard',
  'lupin',
  'sulphite',
] as const;

export type AllergenType = (typeof ALLERGEN_TYPES)[number];

export interface ISessionAllergen {
  allergen: AllergenType;
  addedAt: Date;
}

export interface ISession extends Document {
  sessionId: string;
  restaurantId: Types.ObjectId;
  tableNumber: number;
  allergens: ISessionAllergen[];
  preferences: string[];
  expiresAt: Date;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionAllergenSchema = new Schema<ISessionAllergen>(
  {
    allergen: {
      type: String,
      enum: ALLERGEN_TYPES,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const SessionSchema = new Schema<ISession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    tableNumber: {
      type: Number,
      required: true,
    },
    allergens: [SessionAllergenSchema],
    preferences: [{ type: String }],
    expiresAt: {
      type: Date,
      required: true,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ restaurantId: 1, tableNumber: 1 });

const Session = mongoose.model<ISession>('Session', SessionSchema);
export default Session;
