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

function envString(key: string): string | undefined {
  const value = process.env[key];

  if (value === undefined || value === null) return undefined;

  const clean = String(value).trim();

  return clean === "" ? undefined : clean;
}

function envNumber(key: string, fallback: number): number {
  const raw = envString(key);
  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBoolean(key: string, fallback: boolean): boolean {
  const raw = envString(key);

  if (raw === undefined) return fallback;

  return raw !== "false";
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    mongoUri: { type: String, default: "" },
    databaseName: { type: String, default: "test" },
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
      default: "claude",
    },

    claudeApiKey: { type: String, default: "" },
    claudeModel: {
      type: String,
      default: "claude-3-5-sonnet-20241022",
    },

    openAiApiKey: { type: String, default: "" },
    openAiModel: { type: String, default: "gpt-4o-mini" },

    geminiApiKey: { type: String, default: "" },
    geminiModel: { type: String, default: "gemini-1.5-pro" },

    falKey: { type: String, default: "" },
    falTextModel: { type: String, default: "anthropic/claude-3.5-sonnet" },
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
    newsletterHeaderImageUrl: {
      type: String,
      default: "https://quickapplypro.com/logo.png",
    },
    newsletterFooterText: {
      type: String,
      default:
        "You are receiving this because you signed up for QuickApply Pro.",
    },
    brandNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const AppSettings =
  mongoose.models.AppSettings ||
  mongoose.model<IAppSettings>(
    "AppSettings",
    AppSettingsSchema,
    "app_settings"
  );

function applyRuntimeEnvOverrides(settings: IAppSettings): IAppSettings {
  const overrides: Partial<IAppSettings> = {
    mongoUri: envString("MONGO_URI") || settings.mongoUri,
    databaseName:
      envString("MONGO_DB_NAME") ||
      envString("MONGODB_DB") ||
      settings.databaseName ||
      "test",
    usersCollection:
      envString("USERS_COLLECTION") || settings.usersCollection || "users",

    emailProvider: envString("EMAIL_PROVIDER") || settings.emailProvider,
    gmailUser: envString("EMAIL_USER") || settings.gmailUser,
    gmailPassword: envString("EMAIL_APP_PASSWORD") || settings.gmailPassword,
    senderName: envString("SENDER_NAME") || settings.senderName,
    senderEmail: envString("SENDER_EMAIL") || settings.senderEmail,
    replyToEmail: envString("REPLY_TO_EMAIL") || settings.replyToEmail,
    ctaUrl: envString("CTA_URL") || settings.ctaUrl,
    adminEmail: envString("ADMIN_EMAIL") || settings.adminEmail,

    inactiveCampaignEnabled: envBoolean(
      "INACTIVE_CAMPAIGN_ENABLED",
      settings.inactiveCampaignEnabled
    ),
    inactiveDaysThreshold: envNumber(
      "INACTIVE_DAYS_THRESHOLD",
      settings.inactiveDaysThreshold || 7
    ),
    newsletterEnabled: envBoolean(
      "NEWSLETTER_CAMPAIGN_ENABLED",
      settings.newsletterEnabled
    ),
    newsletterIntervalDays: envNumber(
      "NEWSLETTER_INTERVAL_DAYS",
      settings.newsletterIntervalDays || 14
    ),
    maxEmailsPerRun: envNumber(
      "MAX_EMAILS_PER_RUN",
      settings.maxEmailsPerRun || 50
    ),
    delayBetweenEmailsMs: envNumber(
      "DELAY_BETWEEN_EMAILS_MS",
      settings.delayBetweenEmailsMs || 3000
    ),

    textAiProvider:
      (envString("TEXT_AI_PROVIDER") as IAppSettings["textAiProvider"]) ||
      settings.textAiProvider ||
      "claude",

    claudeApiKey: envString("CLAUDE_API_KEY") || settings.claudeApiKey,
    claudeModel:
      envString("CLAUDE_MODEL") ||
      settings.claudeModel ||
      "claude-3-5-sonnet-20241022",

    openAiApiKey: envString("OPENAI_API_KEY") || settings.openAiApiKey,
    openAiModel: envString("OPENAI_MODEL") || settings.openAiModel,

    geminiApiKey: envString("GEMINI_API_KEY") || settings.geminiApiKey,
    geminiModel: envString("GEMINI_MODEL") || settings.geminiModel,

    falKey: envString("FAL_KEY") || settings.falKey,
    falTextModel: envString("FAL_TEXT_MODEL") || settings.falTextModel,
    falImageModel: envString("FAL_IMAGE_MODEL") || settings.falImageModel,
    falGraphicsEnabled: envBoolean(
      "FAL_NEWSLETTER_GRAPHICS_ENABLED",
      settings.falGraphicsEnabled
    ),

    aiAutoGenerationEnabled: envBoolean(
      "AI_AUTO_GENERATION_ENABLED",
      settings.aiAutoGenerationEnabled
    ),
    aiGenerateIntervalDays: envNumber(
      "AI_GENERATE_INTERVAL_DAYS",
      settings.aiGenerateIntervalDays || 2
    ),
    aiEmailDraftsPerRun: envNumber(
      "AI_EMAIL_DRAFTS_PER_RUN",
      settings.aiEmailDraftsPerRun || 2
    ),
    aiNewsletterDraftsPerRun: envNumber(
      "AI_NEWSLETTER_DRAFTS_PER_RUN",
      settings.aiNewsletterDraftsPerRun || 1
    ),

    discountCode: envString("DISCOUNT_CODE") || settings.discountCode,
    discountText: envString("DISCOUNT_TEXT") || settings.discountText,
    discountUrl: envString("DISCOUNT_URL") || settings.discountUrl,
    discountExpiryDate:
      envString("DISCOUNT_EXPIRY_DATE") || settings.discountExpiryDate,

    companyWebsiteUrl:
      envString("COMPANY_WEBSITE_URL") || settings.companyWebsiteUrl,
    brandLogoUrl: envString("BRAND_LOGO_URL") || settings.brandLogoUrl,
    newsletterPrimaryColor:
      envString("NEWSLETTER_PRIMARY_COLOR") ||
      settings.newsletterPrimaryColor ||
      "#0B88D5",
    newsletterAccentColor:
      envString("NEWSLETTER_ACCENT_COLOR") ||
      settings.newsletterAccentColor ||
      "#48A5DF",
    newsletterHeaderImageUrl:
      envString("NEWSLETTER_HEADER_IMAGE_URL") ||
      envString("BRAND_LOGO_URL") ||
      settings.newsletterHeaderImageUrl,
    newsletterFooterText:
      envString("NEWSLETTER_FOOTER_TEXT") || settings.newsletterFooterText,
  };

  Object.assign(settings, overrides);

  return settings;
}

export async function getSettings(): Promise<IAppSettings> {
  let settings = await AppSettings.findOne();

  if (!settings) {
    settings = await AppSettings.create({
      mongoUri: envString("MONGO_URI") || "",
      databaseName: envString("MONGO_DB_NAME") || envString("MONGODB_DB") || "test",
      usersCollection: envString("USERS_COLLECTION") || "users",

      emailProvider: envString("EMAIL_PROVIDER") || "gmail",
      gmailUser: envString("EMAIL_USER") || "",
      gmailPassword: envString("EMAIL_APP_PASSWORD") || "",
      senderName: envString("SENDER_NAME") || "QuickApply Pro",
      senderEmail: envString("SENDER_EMAIL") || "",
      replyToEmail: envString("REPLY_TO_EMAIL") || "",
      ctaUrl: envString("CTA_URL") || "https://quickapplypro.com/pricing",
      adminEmail: envString("ADMIN_EMAIL") || "",

      inactiveCampaignEnabled: envBoolean("INACTIVE_CAMPAIGN_ENABLED", true),
      inactiveDaysThreshold: envNumber("INACTIVE_DAYS_THRESHOLD", 7),
      newsletterEnabled: envBoolean("NEWSLETTER_CAMPAIGN_ENABLED", true),
      newsletterIntervalDays: envNumber("NEWSLETTER_INTERVAL_DAYS", 14),
      maxEmailsPerRun: envNumber("MAX_EMAILS_PER_RUN", 50),
      delayBetweenEmailsMs: envNumber("DELAY_BETWEEN_EMAILS_MS", 3000),

      textAiProvider:
        (envString("TEXT_AI_PROVIDER") as IAppSettings["textAiProvider"]) ||
        "claude",
      claudeApiKey: envString("CLAUDE_API_KEY") || "",
      claudeModel: envString("CLAUDE_MODEL") || "claude-3-5-sonnet-20241022",

      openAiApiKey: envString("OPENAI_API_KEY") || "",
      openAiModel: envString("OPENAI_MODEL") || "gpt-4o-mini",

      geminiApiKey: envString("GEMINI_API_KEY") || "",
      geminiModel: envString("GEMINI_MODEL") || "gemini-1.5-pro",

      falKey: envString("FAL_KEY") || "",
      falTextModel: envString("FAL_TEXT_MODEL") || "anthropic/claude-3.5-sonnet",
      falImageModel: envString("FAL_IMAGE_MODEL") || "fal-ai/flux/schnell",
      falGraphicsEnabled: envBoolean("FAL_NEWSLETTER_GRAPHICS_ENABLED", true),

      aiAutoGenerationEnabled: envBoolean("AI_AUTO_GENERATION_ENABLED", true),
      aiGenerateIntervalDays: envNumber("AI_GENERATE_INTERVAL_DAYS", 2),
      aiEmailDraftsPerRun: envNumber("AI_EMAIL_DRAFTS_PER_RUN", 2),
      aiNewsletterDraftsPerRun: envNumber("AI_NEWSLETTER_DRAFTS_PER_RUN", 1),

      discountCode: envString("DISCOUNT_CODE") || "QAP20",
      discountText: envString("DISCOUNT_TEXT") || "20% off your next upgrade",
      discountUrl: envString("DISCOUNT_URL") || "https://quickapplypro.com/pricing",
      discountExpiryDate: envString("DISCOUNT_EXPIRY_DATE") || "",

      companyWebsiteUrl: envString("COMPANY_WEBSITE_URL") || "https://quickapplypro.com",
      brandLogoUrl: envString("BRAND_LOGO_URL") || "https://quickapplypro.com/logo.png",
      newsletterPrimaryColor: envString("NEWSLETTER_PRIMARY_COLOR") || "#0B88D5",
      newsletterAccentColor: envString("NEWSLETTER_ACCENT_COLOR") || "#48A5DF",
      newsletterHeaderImageUrl:
        envString("NEWSLETTER_HEADER_IMAGE_URL") ||
        envString("BRAND_LOGO_URL") ||
        "https://quickapplypro.com/logo.png",
      newsletterFooterText:
        envString("NEWSLETTER_FOOTER_TEXT") ||
        "You are receiving this because you signed up for QuickApply Pro.",
      brandNotes: "",
    });
  }

  return applyRuntimeEnvOverrides(settings);
}