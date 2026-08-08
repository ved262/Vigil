import { InferSchemaType, model, Schema } from 'mongoose';

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
export const PingModel = model('Ping', pingSchema);
