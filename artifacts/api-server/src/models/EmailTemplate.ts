import mongoose, { Schema, Document } from "mongoose";

export interface IEmailTemplate extends Document {
  name: string;
  campaignType: "inactive" | "newsletter";
  subject: string;
  htmlBody: string;
  textBody?: string;
  angle?: string;
  isActive: boolean;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    name: { type: String, required: true },
    campaignType: { type: String, enum: ["inactive", "newsletter"], required: true },
    subject: { type: String, required: true },
    htmlBody: { type: String, required: true },
    textBody: { type: String },
    angle: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const EmailTemplate = mongoose.model<IEmailTemplate>("email_templates", EmailTemplateSchema);
