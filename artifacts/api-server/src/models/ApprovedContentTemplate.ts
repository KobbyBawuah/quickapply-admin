import mongoose, { Schema, Document, Model } from "mongoose";

export type ApprovedContentType = "inactive_email" | "newsletter";
export type ApprovedTemplateStatus = "active" | "inactive" | "archived";
export type ApprovedTemplateSource = "ai_approved" | "manual";

export interface IApprovedContentTemplate extends Document {
  contentType: ApprovedContentType;

  draftId?: string;
  sourceDraftId?: string;

  title: string;
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;

  status: ApprovedTemplateStatus;
  source: ApprovedTemplateSource;

  angle?: string;

  aiProvider?: string;
  aiModel?: string;
  promptUsed?: string;
  targetAudience?: string;

  discountCode?: string;
  discountText?: string;
  discountUrl?: string;
  ctaUrl?: string;

  approvedAt?: Date;
  approvedBy?: string;

  usageCount: number;
  lastUsedAt?: Date;
  isDefault: boolean;

  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const ApprovedContentTemplateSchema = new Schema<IApprovedContentTemplate>(
  {
    contentType: {
      type: String,
      enum: ["inactive_email", "newsletter"],
      required: true,
      index: true,
    },

    draftId: {
      type: String,
      default: "",
      index: true,
    },

    sourceDraftId: {
      type: String,
      default: "",
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    preheader: {
      type: String,
      default: "",
    },

    htmlBody: {
      type: String,
      required: true,
    },

    textBody: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },

    source: {
      type: String,
      enum: ["ai_approved", "manual"],
      default: "ai_approved",
      index: true,
    },

    angle: {
      type: String,
      default: "",
      index: true,
    },

    aiProvider: {
      type: String,
      default: "",
    },

    aiModel: {
      type: String,
      default: "",
    },

    promptUsed: {
      type: String,
      default: "",
    },

    targetAudience: {
      type: String,
      default: "",
    },

    discountCode: {
      type: String,
      default: "",
    },

    discountText: {
      type: String,
      default: "",
    },

    discountUrl: {
      type: String,
      default: "",
    },

    ctaUrl: {
      type: String,
      default: "",
    },

    approvedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    approvedBy: {
      type: String,
      default: "",
    },

    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastUsedAt: {
      type: Date,
    },

    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

ApprovedContentTemplateSchema.index({
  contentType: 1,
  status: 1,
  createdAt: -1,
});

ApprovedContentTemplateSchema.index({
  source: 1,
  approvedAt: -1,
});

export const ApprovedContentTemplate: Model<IApprovedContentTemplate> =
  mongoose.models.ApprovedContentTemplate ||
  mongoose.model<IApprovedContentTemplate>(
    "ApprovedContentTemplate",
    ApprovedContentTemplateSchema,
    "approved_content_templates"
  );