import mongoose, { Schema, Document } from "mongoose";

export interface IEmailLog extends Document {
  recipientEmail: string;
  recipientName: string;
  userId: string;
  campaignType: "inactive" | "newsletter" | "manual";
  campaignRunId?: string;
  templateId?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  status: "sent" | "failed" | "skipped";
  provider: string;
  providerMessageId?: string;
  errorMessage?: string;
  sentAt: Date;
  skipReason?: string;
  openedAt?: Date;
  clickedAt?: Date;
}

const EmailLogSchema = new Schema<IEmailLog>(
  {
    recipientEmail: { type: String, required: true },
    recipientName: { type: String, default: "" },
    userId: { type: String, default: "" },
    campaignType: { type: String, enum: ["inactive", "newsletter", "manual"], default: "manual" },
    campaignRunId: { type: String },
    templateId: { type: String },
    subject: { type: String, required: true },
    htmlBody: { type: String, default: "" },
    textBody: { type: String },
    status: { type: String, enum: ["sent", "failed", "skipped"], required: true },
    provider: { type: String, default: "gmail" },
    providerMessageId: { type: String },
    errorMessage: { type: String },
    sentAt: { type: Date, default: Date.now },
    skipReason: { type: String },
    openedAt: { type: Date },
    clickedAt: { type: Date },
  },
  { timestamps: true }
);

export const EmailLog = mongoose.model<IEmailLog>("email_logs", EmailLogSchema);
