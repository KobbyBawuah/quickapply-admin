import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getSettings } from "../models/Settings.js";
import { getUserCollection } from "../lib/userQuery.js";
import { EmailLog } from "../models/EmailLog.js";
import { CampaignRun } from "../models/CampaignRun.js";
import { EmailTemplate } from "../models/EmailTemplate.js";
import { AiContentDraft } from "../models/AiContentDraft.js";
import { ApprovedContentTemplate } from "../models/ApprovedContentTemplate.js";
import { AiGenerationRun } from "../models/AiGenerationRun.js";
import { getInactiveUsers, getNewsletterUsers } from "../lib/campaignService.js";
import { getActiveAiProvider, isFalConfigured, isTextAiConfigured } from "../lib/claudeService.js";
import mongoose from "mongoose";

const router = Router();

router.get("/debug/status", requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();
    const col = await getUserCollection();
    const [
      userCount, logCount, runCount, templateCount,
      pendingDrafts, approvedEmails, approvedNewsletters,
    ] = await Promise.all([
      col.countDocuments({}),
      EmailLog.countDocuments({}),
      CampaignRun.countDocuments({}),
      EmailTemplate.countDocuments({}),
      AiContentDraft.countDocuments({ status: "pending_approval" }),
      ApprovedContentTemplate.countDocuments({ contentType: "inactive_email", status: "active" }),
      ApprovedContentTemplate.countDocuments({ contentType: "newsletter", status: "active" }),
    ]);

    const activeAi = await getActiveAiProvider();
    const textAiConfigured = await isTextAiConfigured();
    const falConfigured = await isFalConfigured();

    res.json({
      mongodbStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      mongodbReadyState: mongoose.connection.readyState,
      databaseName: settings.databaseName || "qap_demo",
      usersCollection: settings.usersCollection || "users",
      totalUsers: userCount,
      adminEmail: settings.adminEmail || "(not set)",
      senderEmail: settings.senderEmail || "(not set)",
      replyToEmail: settings.replyToEmail || "(not set)",
      senderName: settings.senderName || "QuickApply Pro",
      ctaUrl: settings.ctaUrl || "(not set)",
      gmailConfigured: !!(settings.gmailUser || process.env.EMAIL_USER),
      emailProvider: settings.emailProvider || "gmail",
      timezone: process.env.CRON_TIMEZONE || "America/New_York",
      campaignSettings: {
        inactiveCampaignEnabled: settings.inactiveCampaignEnabled,
        inactiveDaysThreshold: settings.inactiveDaysThreshold,
        newsletterEnabled: settings.newsletterEnabled,
        newsletterIntervalDays: settings.newsletterIntervalDays,
        maxEmailsPerRun: settings.maxEmailsPerRun,
        delayBetweenEmailsMs: settings.delayBetweenEmailsMs,
      },
      aiSettings: {
        textAiProvider: activeAi.provider,
        textAiConfigured,
        activeTextModel: activeAi.model,
        falConfigured,
        falGraphicsEnabled: settings.falGraphicsEnabled,
        falTextModel: settings.falTextModel || "(not set)",
        falImageModel: settings.falImageModel || "fal-ai/flux/schnell",
        claudeConfigured: !!(settings.claudeApiKey || process.env.CLAUDE_API_KEY),
        claudeModel: settings.claudeModel || "claude-3-5-sonnet-latest",
        openAiConfigured: !!(settings.openAiApiKey || process.env.OPENAI_API_KEY),
        geminiConfigured: !!(settings.geminiApiKey || process.env.GEMINI_API_KEY),
        aiAutoGenerationEnabled: settings.aiAutoGenerationEnabled,
        aiGenerateIntervalDays: settings.aiGenerateIntervalDays,
        pendingAiDrafts: pendingDrafts,
        approvedInactiveEmailTemplates: approvedEmails,
        approvedNewsletterTemplates: approvedNewsletters,
        discountCode: settings.discountCode || "(not set)",
        discountUrl: settings.discountUrl || "(not set)",
        newsletterPrimaryColor: settings.newsletterPrimaryColor || "#2563eb",
        newsletterAccentColor: settings.newsletterAccentColor || "#f97316",
      },
      collectionCounts: {
        email_logs: logCount,
        campaign_runs: runCount,
        email_templates: templateCount,
        ai_content_drafts: pendingDrafts,
        approved_content_templates: approvedEmails + approvedNewsletters,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/debug/test-all", requireAuth, async (req, res) => {
  const results: Array<{ check: string; status: "pass" | "fail"; detail: string }> = [];

  async function check(name: string, fn: () => Promise<string>) {
    try {
      const detail = await fn();
      results.push({ check: name, status: "pass", detail });
    } catch (err: any) {
      results.push({ check: name, status: "fail", detail: err.message });
    }
  }

  await check("Settings load", async () => {
    const s = await getSettings();
    return `Loaded. adminEmail=${s.adminEmail || "(not set)"}, db=${s.databaseName}`;
  });

  await check("MongoDB connection", async () => {
    const state = mongoose.connection.readyState;
    if (state !== 1) throw new Error(`readyState=${state}`);
    return "Connected";
  });

  await check("Users collection access", async () => {
    const col = await getUserCollection();
    const count = await col.countDocuments({});
    return `${count} users found`;
  });

  await check("Inactive eligible users", async () => {
    const users = await getInactiveUsers();
    return `${users.length} eligible for inactive campaign`;
  });

  await check("Newsletter eligible users", async () => {
    const users = await getNewsletterUsers();
    return `${users.length} eligible for newsletter`;
  });

  await check("Legacy email templates", async () => {
    const count = await EmailTemplate.countDocuments({});
    const active = await EmailTemplate.countDocuments({ isActive: true });
    return `${count} total, ${active} active`;
  });

  await check("AI: text provider configured", async () => {
    const active = await getActiveAiProvider();
    if (!active.configured) throw new Error(`Selected text provider ${active.provider} is not configured`);
    return `${active.provider} configured. Model: ${active.model || "(not set)"}`;
  });

  await check("AI: fal graphics config", async () => {
    const s = await getSettings();
    const configured = await isFalConfigured();
    if (s.falGraphicsEnabled && !configured) throw new Error("fal graphics enabled but FAL_KEY is not configured");
    return `falConfigured=${configured}, graphicsEnabled=${!!s.falGraphicsEnabled}, imageModel=${s.falImageModel || "fal-ai/flux/schnell"}`;
  });

  await check("AI: drafts collection", async () => {
    const total = await AiContentDraft.countDocuments({});
    const pending = await AiContentDraft.countDocuments({ status: "pending_approval" });
    const approved = await AiContentDraft.countDocuments({ status: "approved" });
    return `${total} total drafts — ${pending} pending, ${approved} approved`;
  });

  await check("AI: approved templates collection", async () => {
    const emailTpls = await ApprovedContentTemplate.countDocuments({ contentType: "inactive_email", status: "active" });
    const nlTpls = await ApprovedContentTemplate.countDocuments({ contentType: "newsletter", status: "active" });
    return `${emailTpls} active email templates, ${nlTpls} active newsletter templates`;
  });

  await check("AI: generation runs collection", async () => {
    const count = await AiGenerationRun.countDocuments({});
    return `${count} generation run(s) recorded`;
  });

  await check("Campaign: inactive email template enforcement", async () => {
    const count = await ApprovedContentTemplate.countDocuments({ contentType: "inactive_email", status: "active" });
    if (count === 0) throw new Error("No approved inactive_email templates — campaign will fail until you approve one");
    return `${count} approved inactive email template(s) ready`;
  });

  await check("Campaign: newsletter template enforcement", async () => {
    const count = await ApprovedContentTemplate.countDocuments({ contentType: "newsletter", status: "active" });
    if (count === 0) throw new Error("No approved newsletter templates — newsletter campaign will fail until you approve one");
    return `${count} approved newsletter template(s) ready`;
  });

  await check("Email config presence", async () => {
    const s = await getSettings();
    const gmailUser = s.gmailUser || process.env.EMAIL_USER || "";
    const gmailPass = s.gmailPassword || process.env.EMAIL_APP_PASSWORD || "";
    if (!gmailUser) throw new Error("No Gmail user configured");
    if (!gmailPass) throw new Error("No Gmail app password configured");
    return `Gmail: ${gmailUser}`;
  });

  await check("email_logs collection accessible", async () => {
    const count = await EmailLog.countDocuments({});
    return `${count} log entries`;
  });

  await check("campaign_runs collection accessible", async () => {
    const count = await CampaignRun.countDocuments({});
    return `${count} campaign runs`;
  });

  await check("Admin email set", async () => {
    const s = await getSettings();
    const adminEmail = (s.adminEmail || process.env.ADMIN_EMAIL || "").trim();
    if (!adminEmail) throw new Error("Admin email is not set in Settings");
    return `Admin email: ${adminEmail}`;
  });

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  res.json({ summary: `${passed} passed, ${failed} failed`, passed, failed, results });
});

export default router;
