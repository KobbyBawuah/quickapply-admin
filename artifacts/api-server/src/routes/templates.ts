import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { EmailTemplate } from "../models/EmailTemplate.js";
import { EmailLog } from "../models/EmailLog.js";
import { sendEmail, buildTemplateVars, renderEmailContent } from "../lib/emailService.js";
import { getSettings } from "../models/Settings.js";
import { logger } from "../lib/logger.js";

const router = Router();

const SAMPLE_USER = {
  firstName: "Alex",
  lastName: "Jordan",
  name: "Alex Jordan",
  email: "alex@example.com",
  lastLoginAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  subscriptionStatus: "free",
  plan: "free",
  country: "United States",
};

router.get("/templates", requireAuth, async (req, res) => {
  try {
    const templates = await EmailTemplate.find().sort({ createdAt: -1 }).lean();
    const serialized = templates.map((t: any) => ({ ...t, _id: t._id.toString() }));
    res.json({ templates: serialized });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get templates");
    res.status(500).json({ error: "Failed to get templates" });
  }
});

router.post("/templates", requireAuth, async (req, res) => {
  try {
    const template = await EmailTemplate.create(req.body);
    res.status(201).json({ ...template.toObject(), _id: template._id.toString() });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.put("/templates/:templateId", requireAuth, async (req, res) => {
  try {
    const template = await EmailTemplate.findByIdAndUpdate(req.params.templateId, req.body, { new: true });
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json({ ...template.toObject(), _id: template._id.toString() });
  } catch (err: any) {
    req.log.error({ err }, "Failed to update template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/templates/:templateId", requireAuth, async (req, res) => {
  try {
    const result = await EmailTemplate.findByIdAndDelete(req.params.templateId);
    if (!result) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json({ message: "Template deleted", success: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to delete template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.post("/templates/:templateId/preview", requireAuth, async (req, res) => {
  try {
    const template = await EmailTemplate.findById(req.params.templateId);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const settings = await getSettings();
    const vars = buildTemplateVars(SAMPLE_USER, settings);
    const rendered = renderEmailContent(template.subject, template.htmlBody, template.textBody, vars);
    res.json(rendered);
  } catch (err: any) {
    req.log.error({ err }, "Failed to preview template");
    res.status(500).json({ error: "Failed to preview template" });
  }
});

router.post("/templates/:templateId/send-test", requireAuth, async (req, res) => {
  try {
    const template = await EmailTemplate.findById(req.params.templateId);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const settings = await getSettings();
    // Settings always take priority over env vars
    const adminEmail = (settings.adminEmail || process.env.ADMIN_EMAIL || "").trim();
    if (!adminEmail) {
      res.status(400).json({
        success: false,
        message: "No Admin Email configured. Set it in Settings first.",
      });
      return;
    }
    const vars = buildTemplateVars(SAMPLE_USER, settings);
    const rendered = renderEmailContent(template.subject, template.htmlBody, template.textBody, vars);
    const result = await sendEmail({
      to: adminEmail,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });

    // Log the test send
    await EmailLog.create({
      recipientEmail: adminEmail,
      recipientName: "Admin (Test)",
      campaignType: "test_email",
      templateId: template._id.toString(),
      subject: `[TEST] ${rendered.subject}`,
      htmlBody: rendered.html,
      status: result.success ? "sent" : "failed",
      provider: "gmail",
      providerMessageId: result.messageId,
      errorMessage: result.error,
      sentAt: new Date(),
    }).catch(() => {});

    if (result.success) {
      res.json({ message: `Test email sent to ${adminEmail}`, success: true, recipient: adminEmail });
    } else {
      res.status(500).json({ message: result.error || "Failed to send test", success: false });
    }
  } catch (err: any) {
    req.log.error({ err }, "Failed to send test email");
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
