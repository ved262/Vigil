import { InferSchemaType, model, Schema } from 'mongoose';

const serviceSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['operational', 'degraded', 'down', 'unknown'],
      default: 'unknown',
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export type Service = InferSchemaType<typeof serviceSchema>;
export const ServiceModel = model('Service', serviceSchema);
