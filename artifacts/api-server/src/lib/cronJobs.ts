import cron from "node-cron";
import { runInactiveCampaign, runNewsletterCampaign } from "./campaignService.js";
import { getSettings } from "../models/Settings.js";
import { AiContentDraft } from "../models/AiContentDraft.js";
import { AiGenerationRun } from "../models/AiGenerationRun.js";
import {
  generateInactiveEmailDrafts,
  generateNewsletterDrafts,
  isTextAiConfigured,
} from "./claudeService.js";
import { buildBrandGenerationContext } from "./brandContextService.js";
import { logger } from "./logger.js";

async function runAiGenerationCron(): Promise<void> {
  const settings = await getSettings();

  if (!settings.aiAutoGenerationEnabled) {
    logger.info("AI auto-generation cron skipped (disabled in settings)");
    return;
  }

  const configured = await isTextAiConfigured();
  if (!configured) {
    logger.warn("AI auto-generation cron skipped: AI text provider is not configured");
    return;
  }

  const brandContext = await buildBrandGenerationContext(settings);

  logger.info("Running scheduled AI content generation...");

  const genRun = await AiGenerationRun.create({
    runType: "scheduled",
    contentType: "both",
    startedAt: new Date(),
    status: "running",
    usedWebsiteResearch: brandContext.usedWebsiteResearch,
    websiteResearchUrl: brandContext.websiteResearchUrl,
    websiteResearchSummary: brandContext.websiteResearchSummary.slice(0, 12000),
    coveredTopicsCount: brandContext.coveredTopicsCount,
  });

  let emailCount = 0;
  let newsletterCount = 0;
  let usedModel = "";
  let usedProvider = "";
  let errorMsg = "";

  const scheduledInstructions = [
    "This is scheduled auto-generation. Generate fresh, non-overlapping drafts for the approval queue.",
    brandContext.systemText,
  ].join("\n\n");

  try {
    const emailOpts = {
      contentType: "inactive_email" as const,
      count: settings.aiEmailDraftsPerRun || 2,
      customInstructions: scheduledInstructions,
      includeDiscount: true,
    };

    const emailResult = await generateInactiveEmailDrafts(emailOpts);
    usedModel = emailResult.model;
    usedProvider = emailResult.provider;

    for (const d of emailResult.drafts) {
      await AiContentDraft.create({
        contentType: "inactive_email",
        title: d.title,
        subject: d.subject,
        preheader: d.preheader || "",
        htmlBody: d.htmlBody,
        textBody: d.textBody || "",
        status: "pending_approval",
        generationSource: "scheduled",
        aiProvider: emailResult.provider || "ai",
        aiModel: usedModel,
        promptUsed: emailResult.promptUsed,
        angle: d.angle,
        discountCode: settings.discountCode,
        discountText: settings.discountText,
        discountUrl: settings.discountUrl,
        ctaUrl: settings.ctaUrl,
        metadata: {
          ...(d.metadata || {}),
          usedWebsiteResearch: brandContext.usedWebsiteResearch,
          websiteResearchUrl: brandContext.websiteResearchUrl,
          coveredTopicsCount: brandContext.coveredTopicsCount,
        },
      });

      emailCount++;
    }
  } catch (err: any) {
    logger.error({ err }, "AI cron: failed to generate inactive email drafts");
    errorMsg += `Email drafts failed: ${err.message}. `;
  }

  try {
    const nlOpts = {
      contentType: "newsletter" as const,
      count: settings.aiNewsletterDraftsPerRun || 1,
      customInstructions: scheduledInstructions,
      includeDiscount: true,
    };

    const nlResult = await generateNewsletterDrafts(nlOpts);

    if (!usedModel) usedModel = nlResult.model;
    if (!usedProvider) usedProvider = nlResult.provider;

    for (const d of nlResult.drafts) {
      await AiContentDraft.create({
        contentType: "newsletter",
        title: d.title,
        subject: d.subject,
        preheader: d.preheader || "",
        htmlBody: d.htmlBody,
        textBody: d.textBody || "",
        status: "pending_approval",
        generationSource: "scheduled",
        aiProvider: nlResult.provider || "ai",
        aiModel: nlResult.model || usedModel,
        promptUsed: nlResult.promptUsed,
        angle: d.angle,
        discountCode: settings.discountCode,
        discountText: settings.discountText,
        discountUrl: settings.discountUrl,
        ctaUrl: settings.ctaUrl,
        metadata: {
          ...(d.metadata || {}),
          usedWebsiteResearch: brandContext.usedWebsiteResearch,
          websiteResearchUrl: brandContext.websiteResearchUrl,
          coveredTopicsCount: brandContext.coveredTopicsCount,
        },
      });

      newsletterCount++;
    }
  } catch (err: any) {
    logger.error({ err }, "AI cron: failed to generate newsletter drafts");
    errorMsg += `Newsletter drafts failed: ${err.message}.`;
  }

  const status =
    errorMsg && emailCount === 0 && newsletterCount === 0
      ? "failed"
      : "completed";

  await AiGenerationRun.updateOne(
    { _id: genRun._id },
    {
      $set: {
        status,
        finishedAt: new Date(),
        generatedEmailDrafts: emailCount,
        generatedNewsletterDrafts: newsletterCount,
        generatedPostConcepts: 0,
        aiModel: usedModel,
        aiProvider: usedProvider,
        errorMessage: errorMsg || undefined,
        usedWebsiteResearch: brandContext.usedWebsiteResearch,
        websiteResearchUrl: brandContext.websiteResearchUrl,
        websiteResearchSummary: brandContext.websiteResearchSummary.slice(0, 12000),
        coveredTopicsCount: brandContext.coveredTopicsCount,
      },
    }
  );

  logger.info(
    { emailCount, newsletterCount, status, usedWebsiteResearch: brandContext.usedWebsiteResearch },
    "Scheduled AI generation complete — all drafts pending approval"
  );
}

export function startCronJobs(): void {
  const inactiveCron = process.env.INACTIVE_CAMPAIGN_CRON || "0 9 * * 1";
  const newsletterCron = process.env.NEWSLETTER_CAMPAIGN_CRON || "0 10 */14 * *";
  const aiGenerationCron = process.env.AI_GENERATION_CRON || "0 8 */2 * *";
  const timezone = process.env.CRON_TIMEZONE || "America/New_York";

  cron.schedule(
    inactiveCron,
    async () => {
      try {
        const settings = await getSettings();

        if (!settings.inactiveCampaignEnabled) {
          logger.info("Inactive campaign cron skipped (disabled in settings)");
          return;
        }

        logger.info("Running scheduled inactive campaign...");
        const result = await runInactiveCampaign("scheduled");
        logger.info({ result }, "Scheduled inactive campaign complete");
      } catch (err) {
        logger.error({ err }, "Scheduled inactive campaign failed");
      }
    },
    { timezone }
  );

  cron.schedule(
    newsletterCron,
    async () => {
      try {
        const settings = await getSettings();

        if (!settings.newsletterEnabled) {
          logger.info("Newsletter cron skipped (disabled in settings)");
          return;
        }

        logger.info("Running scheduled newsletter campaign...");
        const result = await runNewsletterCampaign("scheduled");
        logger.info({ result }, "Scheduled newsletter complete");
      } catch (err) {
        logger.error({ err }, "Scheduled newsletter campaign failed");
      }
    },
    { timezone }
  );

  cron.schedule(
    aiGenerationCron,
    async () => {
      try {
        await runAiGenerationCron();
      } catch (err) {
        logger.error({ err }, "AI generation cron failed");
      }
    },
    { timezone }
  );

  logger.info(
    { inactiveCron, newsletterCron, aiGenerationCron, timezone },
    "Cron jobs registered"
  );
}