import mongoose, { Schema, Document, Model } from "mongoose";

export type EmailCampaignType =
  | "inactive"
  | "newsletter"
  | "manual"
  | "test_email";

export type EmailLogStatus = "sent" | "failed" | "skipped" | "pending";

export interface IEmailLog extends Document {
  recipientEmail: string;
  recipientName: string;
  userId: string;

  campaignType: EmailCampaignType;
  campaignRunId?: string;
  templateId?: string;

  subject: string;
  htmlBody: string;
  textBody?: string;

  status: EmailLogStatus;
  provider: string;
  providerMessageId?: string;
  errorMessage?: string;

  sentAt: Date;
  skipReason?: string;
  openedAt?: Date;
  clickedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const EmailLogSchema = new Schema<IEmailLog>(
  {
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    recipientName: {
      type: String,
      default: "",
      trim: true,
    },

    userId: {
      type: String,
      default: "",
      index: true,
    },

    campaignType: {
      type: String,
      enum: ["inactive", "newsletter", "manual", "test_email"],
      default: "manual",
      required: true,
      index: true,
    },

    campaignRunId: {
      type: String,
      default: "",
      index: true,
    },

    templateId: {
      type: String,
      default: "",
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    htmlBody: {
      type: String,
      default: "",
    },

    textBody: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["sent", "failed", "skipped", "pending"],
      required: true,
      index: true,
    },

    provider: {
      type: String,
      default: "gmail",
    },

    providerMessageId: {
      type: String,
      default: "",
    },

    errorMessage: {
      type: String,
      default: "",
    },

    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    skipReason: {
      type: String,
      default: "",
    },

    openedAt: {
      type: Date,
    },

    clickedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

EmailLogSchema.index({ recipientEmail: 1, sentAt: -1 });
EmailLogSchema.index({ campaignType: 1, status: 1, sentAt: -1 });
EmailLogSchema.index({ status: 1, sentAt: -1 });
EmailLogSchema.index({ campaignRunId: 1, sentAt: -1 });

export const EmailLog: Model<IEmailLog> =
  mongoose.models.EmailLog ||
  mongoose.model<IEmailLog>("EmailLog", EmailLogSchema, "email_logs");