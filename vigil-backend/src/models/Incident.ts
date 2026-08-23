import { InferSchemaType, model, Schema } from 'mongoose';

const probabaleCauseSchema = new Schema(
  {
    cause: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const developerDiagnosticSchema = new Schema(
  {
    probableCauses: {
      type: [probabaleCauseSchema],
      default: [],
    },
    suggestedFirstSteps: {
      type: [String],
      default: [],
    },
    patternDetected: {
      type: String,
      default: null,
    },
    crossServiceCorrelation: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const incidentSchema = new Schema(
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
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['investigating', 'identified', 'monitoring', 'resolved'],
      default: 'investigating',
    },
    customerMessage: {
      type: String,
      default: null,
    },
    developerDiagnostic: {
      type: developerDiagnosticSchema,
      default: null,
    },
    published: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    postMortem: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export type Incident = InferSchemaType<typeof incidentSchema>;
export const IncidentModel = model('Incident', incidentSchema);
