import { InferSchemaType, model, Schema } from 'mongoose';

const UserScehma = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      reuqired: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'owner',
    },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof UserScehma>;
export const UserModel = model('User', UserScehma);
