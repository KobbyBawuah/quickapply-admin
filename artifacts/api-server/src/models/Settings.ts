import mongoose, { Schema, Document } from "mongoose";

export interface IAppSettings extends Document {
  mongoUri: string;
  databaseName: string;
  usersCollection: string;
  fieldMapping: Record<string, string>;
  emailProvider: string;
  gmailUser: string;
  gmailPassword: string;
  resendApiKey: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  ctaUrl: string;
  adminEmail: string;
  inactiveCampaignEnabled: boolean;
  inactiveDaysThreshold: number;
  newsletterEnabled: boolean;
  newsletterIntervalDays: number;
  maxEmailsPerRun: number;
  delayBetweenEmailsMs: number;

  textAiProvider: "claude" | "openai" | "gemini" | "fal" | "local";
  claudeApiKey: string;
  claudeModel: string;
  openAiApiKey: string;
  openAiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  falKey: string;
  falTextModel: string;
  falImageModel: string;
  falGraphicsEnabled: boolean;
  aiAutoGenerationEnabled: boolean;
  aiGenerateIntervalDays: number;
  aiEmailDraftsPerRun: number;
  aiNewsletterDraftsPerRun: number;

  discountCode: string;
  discountText: string;
  discountUrl: string;
  discountExpiryDate: string;

  companyWebsiteUrl: string;
  brandLogoUrl: string;
  newsletterPrimaryColor: string;
  newsletterAccentColor: string;
  newsletterHeaderImageUrl: string;
  newsletterFooterText: string;
  brandNotes: string;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    mongoUri: { type: String, default: "" },
    databaseName: { type: String, default: "qap_demo" },
    usersCollection: { type: String, default: "users" },
    fieldMapping: {
      type: Map,
      of: String,
      default: {
        name: "name",
        firstName: "firstName",
        lastName: "lastName",
        email: "email",
        lastLoginAt: "lastLoginAt",
        subscriptionStatus: "subscriptionStatus",
        plan: "plan",
        country: "country",
        createdAt: "createdAt",
        doNotContact: "doNotContact",
        role: "role",
      },
    },

    emailProvider: { type: String, default: "gmail" },
    gmailUser: { type: String, default: "" },
    gmailPassword: { type: String, default: "" },
    resendApiKey: { type: String, default: "" },
    senderName: { type: String, default: "QuickApply Pro" },
    senderEmail: { type: String, default: "" },
    replyToEmail: { type: String, default: "" },
    ctaUrl: { type: String, default: "https://quickapplypro.com/pricing" },
    adminEmail: { type: String, default: "" },

    inactiveCampaignEnabled: { type: Boolean, default: true },
    inactiveDaysThreshold: { type: Number, default: 7 },
    newsletterEnabled: { type: Boolean, default: true },
    newsletterIntervalDays: { type: Number, default: 14 },
    maxEmailsPerRun: { type: Number, default: 50 },
    delayBetweenEmailsMs: { type: Number, default: 3000 },

    textAiProvider: {
      type: String,
      enum: ["claude", "openai", "gemini", "fal", "local"],
      default: "fal",
    },
    claudeApiKey: { type: String, default: "" },
    claudeModel: { type: String, default: "claude-sonnet-4-6" },
    openAiApiKey: { type: String, default: "" },
    openAiModel: { type: String, default: "gpt-4o-mini" },
    geminiApiKey: { type: String, default: "" },
    geminiModel: { type: String, default: "gemini-1.5-pro" },
    falKey: { type: String, default: "" },
    falTextModel: { type: String, default: "anthropic/claude-sonnet-4" },
    falImageModel: { type: String, default: "fal-ai/flux/schnell" },
    falGraphicsEnabled: { type: Boolean, default: true },
    aiAutoGenerationEnabled: { type: Boolean, default: true },
    aiGenerateIntervalDays: { type: Number, default: 2 },
    aiEmailDraftsPerRun: { type: Number, default: 2 },
    aiNewsletterDraftsPerRun: { type: Number, default: 1 },

    discountCode: { type: String, default: "QAP20" },
    discountText: { type: String, default: "20% off your next upgrade" },
    discountUrl: { type: String, default: "https://quickapplypro.com/pricing" },
    discountExpiryDate: { type: String, default: "" },

    companyWebsiteUrl: { type: String, default: "https://quickapplypro.com" },
    brandLogoUrl: { type: String, default: "https://quickapplypro.com/logo.png" },
    newsletterPrimaryColor: { type: String, default: "#0B88D5" },
    newsletterAccentColor: { type: String, default: "#48A5DF" },
    newsletterHeaderImageUrl: { type: String, default: "https://quickapplypro.com/logo.png" },
    newsletterFooterText: {
      type: String,
      default: "You are receiving this because you signed up for QuickApply Pro.",
    },
    brandNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const AppSettings = mongoose.model<IAppSettings>(
  "app_settings",
  AppSettingsSchema
);

export async function getSettings(): Promise<IAppSettings> {
  let settings = await AppSettings.findOne();

  if (!settings) {
    settings = await AppSettings.create({
      mongoUri: process.env.MONGO_URI || "",
      databaseName: process.env.MONGO_DB_NAME || "qap_demo",
      usersCollection: process.env.USERS_COLLECTION || "users",

      emailProvider: process.env.EMAIL_PROVIDER || "gmail",
      gmailUser: process.env.EMAIL_USER || "",
      gmailPassword: process.env.EMAIL_APP_PASSWORD || "",
      senderName: process.env.SENDER_NAME || "QuickApply Pro",
      senderEmail: process.env.SENDER_EMAIL || "",
      replyToEmail: process.env.REPLY_TO_EMAIL || "",
      ctaUrl: process.env.CTA_URL || "https://quickapplypro.com/pricing",
      adminEmail: (process.env.ADMIN_EMAIL || "").trim(),

      inactiveCampaignEnabled: process.env.INACTIVE_CAMPAIGN_ENABLED !== "false",
      inactiveDaysThreshold: parseInt(process.env.INACTIVE_DAYS_THRESHOLD || "7", 10),
      newsletterEnabled: process.env.NEWSLETTER_CAMPAIGN_ENABLED !== "false",
      newsletterIntervalDays: parseInt(process.env.NEWSLETTER_INTERVAL_DAYS || "14", 10),
      maxEmailsPerRun: parseInt(process.env.MAX_EMAILS_PER_RUN || "50", 10),
      delayBetweenEmailsMs: parseInt(process.env.DELAY_BETWEEN_EMAILS_MS || "3000", 10),

      textAiProvider: (process.env.TEXT_AI_PROVIDER as any) || "fal",
      claudeApiKey: process.env.CLAUDE_API_KEY || "",
      claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      openAiApiKey: process.env.OPENAI_API_KEY || "",
      openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      geminiApiKey: process.env.GEMINI_API_KEY || "",
      geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-pro",
      falKey: process.env.FAL_KEY || "",
      falTextModel: process.env.FAL_TEXT_MODEL || "anthropic/claude-sonnet-4",
      falImageModel: process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell",
      falGraphicsEnabled: process.env.FAL_NEWSLETTER_GRAPHICS_ENABLED !== "false",
      aiAutoGenerationEnabled: process.env.AI_AUTO_GENERATION_ENABLED !== "false",
      aiGenerateIntervalDays: parseInt(process.env.AI_GENERATE_INTERVAL_DAYS || "2", 10),
      aiEmailDraftsPerRun: parseInt(process.env.AI_EMAIL_DRAFTS_PER_RUN || "2", 10),
      aiNewsletterDraftsPerRun: parseInt(process.env.AI_NEWSLETTER_DRAFTS_PER_RUN || "1", 10),

      discountCode: process.env.DISCOUNT_CODE || "QAP20",
      discountText: process.env.DISCOUNT_TEXT || "20% off your next upgrade",
      discountUrl: process.env.DISCOUNT_URL || "https://quickapplypro.com/pricing",
      discountExpiryDate: process.env.DISCOUNT_EXPIRY_DATE || "",

      companyWebsiteUrl: process.env.COMPANY_WEBSITE_URL || "https://quickapplypro.com",
      brandLogoUrl: process.env.BRAND_LOGO_URL || "https://quickapplypro.com/logo.png",
      newsletterPrimaryColor: process.env.NEWSLETTER_PRIMARY_COLOR || "#0B88D5",
      newsletterAccentColor: process.env.NEWSLETTER_ACCENT_COLOR || "#48A5DF",
      newsletterHeaderImageUrl:
        process.env.NEWSLETTER_HEADER_IMAGE_URL ||
        process.env.BRAND_LOGO_URL ||
        "https://quickapplypro.com/logo.png",
      newsletterFooterText:
        process.env.NEWSLETTER_FOOTER_TEXT ||
        "You are receiving this because you signed up for QuickApply Pro.",
      brandNotes: "",
    });
  }

  return settings;
}