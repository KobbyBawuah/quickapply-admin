import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { AiContentDraft } from "../models/AiContentDraft.js";
import { ApprovedContentTemplate } from "../models/ApprovedContentTemplate.js";
import { AiGenerationRun } from "../models/AiGenerationRun.js";
import { getSettings } from "../models/Settings.js";
import {
  generateInactiveEmailDrafts,
  generateNewsletterDrafts,
  generateBoth,
  isTextAiConfigured,
} from "../lib/claudeService.js";
import { buildBrandGenerationContext } from "../lib/brandContextService.js";
import {
  sendEmail,
  buildTemplateVars,
  renderEmailContent,
} from "../lib/emailService.js";
import { logger } from "../lib/logger.js";
import {
  sanitizeDraftForNoDashes,
  sanitizeHtmlWithoutDashes,
  sanitizeTextWithoutDashes,
} from "../lib/contentSanitizer.js";

const router = Router();

function toId(doc: any) {
  return { ...doc, _id: doc._id.toString() };
}

function getBrandLogoUrl(settings: any, brandContext?: any) {
  return (
    brandContext?.brandLogoUrl ||
    settings?.brandLogoUrl ||
    settings?.newsletterHeaderImageUrl ||
    process.env.BRAND_LOGO_URL ||
    process.env.NEWSLETTER_HEADER_IMAGE_URL ||
    "https://quickapplypro.com/logo.png"
  );
}

function getBrandPrimaryColor(settings: any, brandContext?: any) {
  return (
    brandContext?.brandPrimaryColor ||
    settings?.newsletterPrimaryColor ||
    process.env.NEWSLETTER_PRIMARY_COLOR ||
    "#0B88D5"
  );
}

function getBrandAccentColor(settings: any, brandContext?: any) {
  return (
    brandContext?.brandAccentColor ||
    settings?.newsletterAccentColor ||
    process.env.NEWSLETTER_ACCENT_COLOR ||
    "#48A5DF"
  );
}

function buildDraftMetadata(d: any, brandContext: any, settings?: any) {
  return {
    ...(d.metadata || {}),
    usedWebsiteResearch: brandContext.usedWebsiteResearch,
    websiteResearchUrl: brandContext.websiteResearchUrl,
    coveredTopicsCount: brandContext.coveredTopicsCount,
    brandLogoUrl: getBrandLogoUrl(settings, brandContext),
    brandPrimaryColor: getBrandPrimaryColor(settings, brandContext),
    brandAccentColor: getBrandAccentColor(settings, brandContext),
    brandApplied: true,
  };
}

async function createAiDraft({
  contentType,
  draft,
  generationSource,
  provider,
  model,
  promptUsed,
  targetAudience,
  angle,
  settings,
  brandContext,
}: {
  contentType: "inactive_email" | "newsletter";
  draft: any;
  generationSource: "manual" | "scheduled";
  provider: any;
  model: string;
  promptUsed?: string;
  targetAudience?: string;
  angle?: string;
  settings: any;
  brandContext: any;
}) {
  const cleanDraft = sanitizeDraftForNoDashes(draft || {});

  return AiContentDraft.create({
    contentType,
    title: cleanDraft.title || "",
    subject: cleanDraft.subject || "",
    preheader: cleanDraft.preheader || "",
    htmlBody: cleanDraft.htmlBody || "",
    textBody: cleanDraft.textBody || "",
    status: "pending_approval",
    generationSource,
    aiProvider: provider || "ai",
    aiModel: model,
    promptUsed,
    targetAudience,
    angle: cleanDraft.angle || sanitizeTextWithoutDashes(angle || ""),
    discountCode: sanitizeTextWithoutDashes(settings.discountCode || ""),
    discountText: sanitizeTextWithoutDashes(settings.discountText || ""),
    discountUrl: settings.discountUrl,
    ctaUrl: settings.ctaUrl,
    metadata: buildDraftMetadata(cleanDraft, brandContext, settings),
  });
}

// GET /api/ai/drafts
router.get("/ai/drafts", requireAuth, async (req, res) => {
  try {
    const {
      status,
      contentType,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const query: any = {};

    if (status && status !== "all") query.status = status;
    if (contentType && contentType !== "all") query.contentType = contentType;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [drafts, total] = await Promise.all([
      AiContentDraft.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AiContentDraft.countDocuments(query),
    ]);

    res.json({
      drafts: drafts.map((d: any) => toId(sanitizeDraftForNoDashes(d))),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get AI drafts");
    res.status(500).json({ error: "Failed to get drafts" });
  }
});

// POST /api/ai/generate
router.post("/ai/generate", requireAuth, async (req, res) => {
  try {
    const configured = await isTextAiConfigured();

    if (!configured) {
      res.status(400).json({
        error:
          "AI text provider is not configured. Add a valid Claude, OpenAI, Gemini, or fal.ai key in Settings → AI Generation Settings.",
      });
      return;
    }

    const {
      contentType = "both",
      count = 2,
      audience,
      angle,
      customInstructions,
      includeDiscount = true,
    } = req.body;

    if (!["inactive_email", "newsletter", "both"].includes(contentType)) {
      res.status(400).json({
        error: "Invalid contentType. Use inactive_email, newsletter, or both.",
      });
      return;
    }

    const settings = await getSettings();
    const brandContext = await buildBrandGenerationContext(settings);

    const genRun = await AiGenerationRun.create({
      runType: "manual",
      contentType,
      startedAt: new Date(),
      status: "running",
      usedWebsiteResearch: brandContext.usedWebsiteResearch,
      websiteResearchUrl: brandContext.websiteResearchUrl,
      websiteResearchSummary: brandContext.websiteResearchSummary.slice(0, 12000),
      coveredTopicsCount: brandContext.coveredTopicsCount,
    });

    let emailDrafts: any[] = [];
    let newsletterDrafts: any[] = [];
    let usedModel = "";
    let usedProvider = "";

    try {
      const enhancedCustomInstructions = [
        customInstructions || "",
        brandContext.systemText,
      ]
        .filter(Boolean)
        .join("\n\n");

      const opts = {
        contentType,
        count: parseInt(String(count), 10),
        audience,
        angle,
        customInstructions: enhancedCustomInstructions,
        includeDiscount,
      };

      if (contentType === "inactive_email") {
        const result = await generateInactiveEmailDrafts(opts as any);

        emailDrafts = result.drafts || [];
        usedModel = result.model;
        usedProvider = result.provider;

        for (const d of emailDrafts) {
          await createAiDraft({
            contentType: "inactive_email",
            draft: d,
            generationSource: "manual",
            provider: result.provider,
            model: usedModel,
            promptUsed: result.promptUsed,
            targetAudience: audience,
            angle,
            settings,
            brandContext,
          });
        }
      } else if (contentType === "newsletter") {
        const result = await generateNewsletterDrafts(opts as any);

        newsletterDrafts = result.drafts || [];
        usedModel = result.model;
        usedProvider = result.provider;

        for (const d of newsletterDrafts) {
          await createAiDraft({
            contentType: "newsletter",
            draft: d,
            generationSource: "manual",
            provider: result.provider,
            model: usedModel,
            promptUsed: result.promptUsed,
            targetAudience: audience,
            angle,
            settings,
            brandContext,
          });
        }
      } else {
        const result = await generateBoth(opts as any);

        emailDrafts = result.emailDrafts || [];
        newsletterDrafts = result.newsletterDrafts || [];
        usedModel = result.model;
        usedProvider = result.provider;

        for (const d of emailDrafts) {
          await createAiDraft({
            contentType: "inactive_email",
            draft: d,
            generationSource: "manual",
            provider: result.provider,
            model: usedModel,
            targetAudience: audience,
            angle,
            settings,
            brandContext,
          });
        }

        for (const d of newsletterDrafts) {
          await createAiDraft({
            contentType: "newsletter",
            draft: d,
            generationSource: "manual",
            provider: result.provider,
            model: usedModel,
            targetAudience: audience,
            angle,
            settings,
            brandContext,
          });
        }
      }

      await AiGenerationRun.updateOne(
        { _id: genRun._id },
        {
          $set: {
            status: "completed",
            finishedAt: new Date(),
            generatedEmailDrafts: emailDrafts.length,
            generatedNewsletterDrafts: newsletterDrafts.length,
            generatedPostConcepts: 0,
            aiModel: usedModel,
            aiProvider: usedProvider,
            usedWebsiteResearch: brandContext.usedWebsiteResearch,
            websiteResearchUrl: brandContext.websiteResearchUrl,
            websiteResearchSummary: brandContext.websiteResearchSummary.slice(0, 12000),
            coveredTopicsCount: brandContext.coveredTopicsCount,
          },
        }
      );

      res.json({
        success: true,
        generationRunId: genRun._id.toString(),
        emailDrafts: emailDrafts.length,
        newsletterDrafts: newsletterDrafts.length,
        aiModel: usedModel,
        aiProvider: usedProvider,
        usedWebsiteResearch: brandContext.usedWebsiteResearch,
        websiteResearchUrl: brandContext.websiteResearchUrl,
        coveredTopicsCount: brandContext.coveredTopicsCount,
        brandLogoUrl: getBrandLogoUrl(settings, brandContext),
        brandPrimaryColor: getBrandPrimaryColor(settings, brandContext),
        brandAccentColor: getBrandAccentColor(settings, brandContext),
        message: `Generated ${emailDrafts.length} email draft(s) and ${newsletterDrafts.length} newsletter draft(s). All pending approval.`,
      });
    } catch (genErr: any) {
      logger.error({ err: genErr }, "AI generation failed");

      await AiGenerationRun.updateOne(
        { _id: genRun._id },
        {
          $set: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage: genErr.message,
            usedWebsiteResearch: brandContext.usedWebsiteResearch,
            websiteResearchUrl: brandContext.websiteResearchUrl,
            coveredTopicsCount: brandContext.coveredTopicsCount,
          },
        }
      );

      res.status(500).json({
        error: genErr.message || "AI generation failed",
      });
    }
  } catch (err: any) {
    req.log.error({ err }, "Failed to run AI generation");
    res.status(500).json({
      error: err.message || "Failed to generate",
    });
  }
});

// GET /api/ai/drafts/:id
router.get("/ai/drafts/:id", requireAuth, async (req, res) => {
  try {
    const draft = await AiContentDraft.findById(req.params.id).lean();

    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    res.json(toId(sanitizeDraftForNoDashes(draft as any)));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get draft" });
  }
});

// PUT /api/ai/drafts/:id
router.put("/ai/drafts/:id", requireAuth, async (req, res) => {
  try {
    const allowed = [
      "title",
      "subject",
      "preheader",
      "htmlBody",
      "textBody",
      "angle",
      "discountCode",
      "discountText",
      "discountUrl",
      "ctaUrl",
      "metadata",
    ];

    const update: any = {};

    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

    const cleanUpdate = sanitizeDraftForNoDashes(update);

    if (typeof cleanUpdate.discountCode === "string") {
      cleanUpdate.discountCode = sanitizeTextWithoutDashes(cleanUpdate.discountCode);
    }

    if (typeof cleanUpdate.discountText === "string") {
      cleanUpdate.discountText = sanitizeTextWithoutDashes(cleanUpdate.discountText);
    }

    const draft = await AiContentDraft.findByIdAndUpdate(
      req.params.id,
      { $set: cleanUpdate },
      { new: true }
    ).lean();

    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    res.json(toId(sanitizeDraftForNoDashes(draft as any)));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update draft" });
  }
});

// POST /api/ai/drafts/:id/approve
router.post("/ai/drafts/:id/approve", requireAuth, async (req, res) => {
  try {
    const draft = await AiContentDraft.findById(req.params.id);

    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    if (draft.status === "approved") {
      res.status(400).json({ error: "Draft is already approved" });
      return;
    }

    const settings = await getSettings();
    const cleanDraft = sanitizeDraftForNoDashes(draft.toObject());

    const approved = await ApprovedContentTemplate.create({
      contentType: draft.contentType,
      draftId: draft._id.toString(),
      title: cleanDraft.title,
      subject: cleanDraft.subject,
      preheader: cleanDraft.preheader,
      htmlBody: cleanDraft.htmlBody,
      textBody: cleanDraft.textBody,
      status: "active",
      source: "ai_approved",
      angle: cleanDraft.angle,
      discountCode: sanitizeTextWithoutDashes(draft.discountCode || ""),
      discountText: sanitizeTextWithoutDashes(draft.discountText || ""),
      discountUrl: draft.discountUrl,
      ctaUrl: draft.ctaUrl,
      metadata: {
        ...(cleanDraft.metadata || {}),
        brandLogoUrl:
          cleanDraft.metadata?.brandLogoUrl ||
          getBrandLogoUrl(settings),
        brandPrimaryColor:
          cleanDraft.metadata?.brandPrimaryColor ||
          getBrandPrimaryColor(settings),
        brandAccentColor:
          cleanDraft.metadata?.brandAccentColor ||
          getBrandAccentColor(settings),
        brandApplied: true,
      },
      approvedAt: new Date(),
    });

    draft.title = cleanDraft.title;
    draft.subject = cleanDraft.subject;
    draft.preheader = cleanDraft.preheader;
    draft.htmlBody = cleanDraft.htmlBody;
    draft.textBody = cleanDraft.textBody;
    draft.angle = cleanDraft.angle;
    draft.status = "approved";
    draft.approvedAt = new Date();

    draft.metadata = {
      ...(cleanDraft.metadata || {}),
      brandLogoUrl:
        cleanDraft.metadata?.brandLogoUrl ||
        getBrandLogoUrl(settings),
      brandPrimaryColor:
        cleanDraft.metadata?.brandPrimaryColor ||
        getBrandPrimaryColor(settings),
      brandAccentColor:
        cleanDraft.metadata?.brandAccentColor ||
        getBrandAccentColor(settings),
      brandApplied: true,
    };

    await draft.save();

    res.json({
      success: true,
      message: "Draft approved and added to Approved Templates",
      approvedTemplateId: approved._id.toString(),
      draft: toId(sanitizeDraftForNoDashes(draft.toObject())),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to approve draft");
    res.status(500).json({ error: "Failed to approve draft" });
  }
});

// POST /api/ai/drafts/:id/reject
router.post("/ai/drafts/:id/reject", requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const draft = await AiContentDraft.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "rejected",
          rejectedAt: new Date(),
          rejectionReason: sanitizeTextWithoutDashes(reason || ""),
        },
      },
      { new: true }
    ).lean();

    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    res.json({
      success: true,
      draft: toId(sanitizeDraftForNoDashes(draft as any)),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to reject draft" });
  }
});

// POST /api/ai/drafts/:id/archive
router.post("/ai/drafts/:id/archive", requireAuth, async (req, res) => {
  try {
    const draft = await AiContentDraft.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "archived" } },
      { new: true }
    ).lean();

    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    res.json({
      success: true,
      draft: toId(sanitizeDraftForNoDashes(draft as any)),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to archive draft" });
  }
});

// POST /api/ai/drafts/:id/regenerate-similar
router.post("/ai/drafts/:id/regenerate-similar", requireAuth, async (req, res) => {
  try {
    const configured = await isTextAiConfigured();

    if (!configured) {
      res.status(400).json({
        error: "AI text provider is not configured. Add your AI key in Settings → AI Generation Settings.",
      });
      return;
    }

    const original = (await AiContentDraft.findById(req.params.id).lean()) as any;

    if (!original) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const settings = await getSettings();
    const brandContext = await buildBrandGenerationContext(settings);

    const customInstructions = [
      "Generate a fresh variation of this concept. Do not reuse the same subject, emotional frame, metaphor, or structure.",
      `Original title: ${sanitizeTextWithoutDashes(original.title || "")}`,
      `Original subject: ${sanitizeTextWithoutDashes(original.subject || "")}`,
      `Original angle: ${sanitizeTextWithoutDashes(original.angle || "")}`,
      brandContext.systemText,
    ].join("\n\n");

    const opts = {
      contentType: original.contentType as any,
      count: 1,
      audience: original.targetAudience,
      angle: sanitizeTextWithoutDashes(original.angle || ""),
      customInstructions,
      includeDiscount: true,
    };

    let resultDrafts: any[] = [];
    let usedModel = "";
    let usedProvider = "ai";
    let promptUsed = "";

    if (original.contentType === "newsletter") {
      const r = await generateNewsletterDrafts(opts);
      resultDrafts = r.drafts || [];
      usedModel = r.model;
      usedProvider = r.provider || "ai";
      promptUsed = r.promptUsed;
    } else {
      const r = await generateInactiveEmailDrafts(opts);
      resultDrafts = r.drafts || [];
      usedModel = r.model;
      usedProvider = r.provider || "ai";
      promptUsed = r.promptUsed;
    }

    const created = [];

    for (const d of resultDrafts) {
      const doc = await createAiDraft({
        contentType: original.contentType,
        draft: d,
        generationSource: "manual",
        provider: usedProvider,
        model: usedModel,
        promptUsed,
        targetAudience: original.targetAudience,
        angle: original.angle,
        settings,
        brandContext,
      });

      created.push(toId(sanitizeDraftForNoDashes(doc.toObject())));
    }

    res.json({
      success: true,
      drafts: created,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to regenerate draft");
    res.status(500).json({
      error: err.message || "Failed to regenerate",
    });
  }
});

// POST /api/ai/drafts/:id/send-test
router.post("/ai/drafts/:id/send-test", requireAuth, async (req, res) => {
  try {
    const draft = (await AiContentDraft.findById(req.params.id).lean()) as any;

    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const settings = await getSettings();
    const adminEmail = (settings.adminEmail || process.env.ADMIN_EMAIL || "").trim();

    if (!adminEmail) {
      res.status(400).json({
        error: "No admin email configured in Settings",
      });
      return;
    }

    const cleanDraft = sanitizeDraftForNoDashes(draft);

    const vars = buildTemplateVars(
      {
        firstName: "Admin",
        name: "Admin User",
        email: adminEmail,
      },
      settings
    );

    const rendered = renderEmailContent(
      cleanDraft.subject,
      cleanDraft.htmlBody,
      cleanDraft.textBody,
      vars
    );

    const result = await sendEmail({
      to: adminEmail,
      toName: "Admin",
      subject: sanitizeTextWithoutDashes(`[TEST] ${rendered.subject}`),
      html: sanitizeHtmlWithoutDashes(rendered.html),
      text: sanitizeTextWithoutDashes(rendered.text),
    });

    res.json({
      success: result.success,
      message: result.success
        ? `Test email sent to ${adminEmail}`
        : result.error,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// GET /api/ai/generation-runs
router.get("/ai/generation-runs", requireAuth, async (req, res) => {
  try {
    const runs = await AiGenerationRun.find({})
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    res.json({
      runs: runs.map((r: any) => toId(r)),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get generation runs" });
  }
});

export default router;