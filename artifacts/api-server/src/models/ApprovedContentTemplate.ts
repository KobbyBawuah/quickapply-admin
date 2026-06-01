import mongoose, { Schema, Document } from "mongoose";

export interface IApprovedContentTemplate extends Document {
  contentType: "inactive_email" | "newsletter";
  draftId?: string;
  title: string;
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
  status: "active" | "inactive" | "archived";
  source: "ai_approved" | "manual";
  angle?: string;
  discountCode?: string;
  discountText?: string;
  discountUrl?: string;
  ctaUrl?: string;
  approvedAt?: Date;
  usageCount: number;
  lastUsedAt?: Date;
  isDefault: boolean;
}

const ApprovedContentTemplateSchema = new Schema<IApprovedContentTemplate>(
  {
    contentType: { type: String, enum: ["inactive_email", "newsletter"], required: true },
    draftId: { type: String },
    title: { type: String, required: true },
    subject: { type: String, required: true },
    preheader: { type: String, default: "" },
    htmlBody: { type: String, required: true },
    textBody: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    source: { type: String, enum: ["ai_approved", "manual"], default: "ai_approved" },
    angle: { type: String },
    discountCode: { type: String },
    discountText: { type: String },
    discountUrl: { type: String },
    ctaUrl: { type: String },
    approvedAt: { type: Date },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ApprovedContentTemplate = mongoose.model<IApprovedContentTemplate>(
  "approved_content_templates",
  ApprovedContentTemplateSchema
);
