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
      index: true,
    },

    contentType: {
      type: String,
      enum: ["inactive_email", "newsletter", "both", "post_concepts"],
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    finishedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
      index: true,
    },

    generatedEmailDrafts: {
      type: Number,
      default: 0,
      min: 0,
    },

    generatedNewsletterDrafts: {
      type: Number,
      default: 0,
      min: 0,
    },

    generatedPostConcepts: {
      type: Number,
      default: 0,
      min: 0,
    },

    failedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    errorMessage: {
      type: String,
      default: "",
    },

    aiModel: {
      type: String,
      default: "",
    },

    aiProvider: {
      type: String,
      default: "",
    },

    usedWebsiteResearch: {
      type: Boolean,
      default: false,
    },

    websiteResearchUrl: {
      type: String,
      default: "",
    },

    websiteResearchSummary: {
      type: String,
      default: "",
    },

    coveredTopicsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
      type: String,
      default: "",
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