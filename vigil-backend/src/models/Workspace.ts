import { InferSchemaType, model, Schema } from 'mongoose';

const workspaceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
  },
  { timestamps: true },
);

export type Workspacce = InferSchemaType<typeof workspaceSchema>;
export const WorkspaceModel = model('Workspace', workspaceSchema);
