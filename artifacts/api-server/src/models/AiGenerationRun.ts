import mongoose, { Schema, Document, Model } from "mongoose";

export type AiGenerationRunType = "manual" | "scheduled";

export type AiGenerationContentType =
  | "inactive_email"
  | "newsletter"
  | "both"
  | "post_concepts";

export type AiGenerationRunStatus = "running" | "completed" | "failed";

export interface IAiGenerationRun extends Document {
  runType: AiGenerationRunType;
  contentType: AiGenerationContentType;

  startedAt: Date;
  finishedAt?: Date;

  status: AiGenerationRunStatus;

  generatedEmailDrafts: number;
  generatedNewsletterDrafts: number;
  generatedPostConcepts: number;

  failedCount: number;
  errorMessage?: string;

  aiModel?: string;
  aiProvider?: string;

  usedWebsiteResearch: boolean;
  websiteResearchUrl?: string;
  websiteResearchSummary?: string;

  coveredTopicsCount: number;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AiGenerationRunSchema = new Schema<IAiGenerationRun>(
  {
    runType: {
      type: String,
      enum: ["manual", "scheduled"],
      required: true,
    },

    contentType: {
      type: String,
      enum: ["inactive_email", "newsletter", "both", "post_concepts"],
      required: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    finishedAt: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },

    generatedEmailDrafts: {
      type: Number,
      default: 0,
    },

    generatedNewsletterDrafts: {
      type: Number,
      default: 0,
    },

    generatedPostConcepts: {
      type: Number,
      default: 0,
    },

    failedCount: {
      type: Number,
      default: 0,
    },

    errorMessage: {
      type: String,
    },

    aiModel: {
      type: String,
    },

    aiProvider: {
      type: String,
    },

    usedWebsiteResearch: {
      type: Boolean,
      default: false,
    },

    websiteResearchUrl: {
      type: String,
    },

    websiteResearchSummary: {
      type: String,
    },

    coveredTopicsCount: {
      type: Number,
      default: 0,
    },

    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

AiGenerationRunSchema.index({ runType: 1, createdAt: -1 });
AiGenerationRunSchema.index({ contentType: 1, createdAt: -1 });
AiGenerationRunSchema.index({ status: 1, createdAt: -1 });
AiGenerationRunSchema.index({ startedAt: -1 });

export const AiGenerationRun: Model<IAiGenerationRun> =
  mongoose.models.AiGenerationRun ||
  mongoose.model<IAiGenerationRun>(
    "AiGenerationRun",
    AiGenerationRunSchema,
    "ai_generation_runs"
  );