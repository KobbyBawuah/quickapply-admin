import mongoose, { Schema, Document, Model } from "mongoose";

export type AiDraftContentType = "inactive_email" | "newsletter";
export type AiDraftStatus = "draft" | "pending_approval" | "approved" | "rejected" | "archived";
export type AiDraftGenerationSource = "manual" | "scheduled";
export type AiDraftProvider = "claude" | "openai" | "gemini" | "fal" | "local" | "ai";

export interface IAiContentDraft extends Document {
  contentType: AiDraftContentType;

  title: string;
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;

  status: AiDraftStatus;
  generationSource: AiDraftGenerationSource;

  aiProvider: AiDraftProvider;
  aiModel: string;
  promptUsed?: string;

  targetAudience?: string;
  angle?: string;

  discountCode?: string;
  discountText?: string;
  discountUrl?: string;
  ctaUrl?: string;

  approvedAt?: Date;
  approvedBy?: string;

  rejectedAt?: Date;
  rejectionReason?: string;

  usageCount: number;
  lastUsedAt?: Date;

  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const AiContentDraftSchema = new Schema<IAiContentDraft>(
  {
    contentType: {
      type: String,
      enum: ["inactive_email", "newsletter"],
      required: true,
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
      enum: ["draft", "pending_approval", "approved", "rejected", "archived"],
      default: "pending_approval",
      index: true,
    },

    generationSource: {
      type: String,
      enum: ["manual", "scheduled"],
      default: "manual",
      index: true,
    },

    aiProvider: {
      type: String,
      enum: ["claude", "openai", "gemini", "fal", "local", "ai"],
      default: "claude",
    },

    aiModel: {
      type: String,
      required: true,
    },

    promptUsed: {
      type: String,
    },

    targetAudience: {
      type: String,
    },

    angle: {
      type: String,
      index: true,
    },

    discountCode: {
      type: String,
    },

    discountText: {
      type: String,
    },

    discountUrl: {
      type: String,
    },

    ctaUrl: {
      type: String,
    },

    approvedAt: {
      type: Date,
    },

    approvedBy: {
      type: String,
    },

    rejectedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
    },

    usageCount: {
      type: Number,
      default: 0,
    },

    lastUsedAt: {
      type: Date,
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

AiContentDraftSchema.index({ status: 1, createdAt: -1 });
AiContentDraftSchema.index({ contentType: 1, status: 1, createdAt: -1 });
AiContentDraftSchema.index({ generationSource: 1, createdAt: -1 });

export const AiContentDraft: Model<IAiContentDraft> =
  mongoose.models.AiContentDraft ||
  mongoose.model<IAiContentDraft>(
    "AiContentDraft",
    AiContentDraftSchema,
    "ai_content_drafts"
  );