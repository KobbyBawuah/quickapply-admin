import mongoose, { Schema, Document } from "mongoose";

export interface ICampaignRun extends Document {
  campaignType: "inactive" | "newsletter";
  triggerType: "manual" | "scheduled";
  startedAt: Date;
  finishedAt?: Date;
  matchedUsers: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  status: "running" | "completed" | "failed";
  notes?: string;
}

const CampaignRunSchema = new Schema<ICampaignRun>(
  {
    campaignType: { type: String, enum: ["inactive", "newsletter"], required: true },
    triggerType: { type: String, enum: ["manual", "scheduled"], required: true },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    matchedUsers: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
    notes: { type: String },
  },
  { timestamps: true }
);

export const CampaignRun = mongoose.model<ICampaignRun>("campaign_runs", CampaignRunSchema);
