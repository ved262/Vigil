import { InferSchemaType, model, Schema } from 'mongoose';
import { required } from 'zod/mini';

const pingSchema = new Schema(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      requored: true,
      index: true,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    responseTime: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['up', 'down', 'timeout', 'error'],
      required: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    checkedAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: false },
);

export type Ping = InferSchemaType<typeof pingSchema>;
export const pingModel = model('Ping', pingSchema);
