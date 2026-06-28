/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import mongoose, { Schema, Document } from 'mongoose';

export type OwnerRole = 'owner' | 'admin';

export interface IOwner extends Document {
  email: string;
  password: string;
  role: OwnerRole;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OwnerSchema = new Schema<IOwner>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin'],
      default: 'owner',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Owner = mongoose.model<IOwner>('Owner', OwnerSchema);
export default Owner;
