import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { ApprovedContentTemplate } from "../models/ApprovedContentTemplate.js";
import { getSettings } from "../models/Settings.js";
import { sendEmail, buildTemplateVars, renderEmailContent } from "../lib/emailService.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/approved-templates
router.get("/approved-templates", requireAuth, async (req, res) => {
  try {
    const { contentType, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const query: any = {};
    if (contentType && contentType !== "all") query.contentType = contentType;
    if (status && status !== "all") query.status = status;
    else query.status = { $ne: "archived" };
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;
    const [templates, total] = await Promise.all([
      ApprovedContentTemplate.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      ApprovedContentTemplate.countDocuments(query),
    ]);
    res.json({
      templates: templates.map((t: any) => ({ ...t, _id: t._id.toString() })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get approved templates" });
  }
});

// GET /api/approved-templates/:id
router.get("/approved-templates/:id", requireAuth, async (req, res) => {
  try {
    const t = await ApprovedContentTemplate.findById(req.params.id).lean();
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }
    res.json({ ...(t as any), _id: (t as any)._id.toString() });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get template" });
  }
});

// PUT /api/approved-templates/:id
router.put("/approved-templates/:id", requireAuth, async (req, res) => {
  try {
    const allowed = ["title", "subject", "preheader", "htmlBody", "textBody", "discountCode", "discountText", "discountUrl", "ctaUrl"];
    const update: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
    const t = await ApprovedContentTemplate.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }
    res.json({ ...(t as any), _id: (t as any)._id.toString() });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update template" });
  }
});

// POST /api/approved-templates/:id/set-default
router.post("/approved-templates/:id/set-default", requireAuth, async (req, res) => {
  try {
    const t = await ApprovedContentTemplate.findById(req.params.id);
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }
    // Clear default from same type
    await ApprovedContentTemplate.updateMany({ contentType: t.contentType }, { $set: { isDefault: false } });
    t.isDefault = true;
    await t.save();
    res.json({ success: true, message: "Set as default template" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to set default" });
  }
});

// POST /api/approved-templates/:id/deactivate
router.post("/approved-templates/:id/deactivate", requireAuth, async (req, res) => {
  try {
    const t = await ApprovedContentTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "inactive" } },
      { new: true }
    ).lean();
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to deactivate template" });
  }
});

// POST /api/approved-templates/:id/activate
router.post("/approved-templates/:id/activate", requireAuth, async (req, res) => {
  try {
    const t = await ApprovedContentTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "active" } },
      { new: true }
    ).lean();
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to activate template" });
  }
});

// POST /api/approved-templates/:id/archive
router.post("/approved-templates/:id/archive", requireAuth, async (req, res) => {
  try {
    const t = await ApprovedContentTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "archived" } },
      { new: true }
    ).lean();
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to archive template" });
  }
});

// POST /api/approved-templates/:id/send-test
router.post("/approved-templates/:id/send-test", requireAuth, async (req, res) => {
  try {
    const t = await ApprovedContentTemplate.findById(req.params.id).lean() as any;
    if (!t) { res.status(404).json({ error: "Template not found" }); return; }

    const settings = await getSettings();
    const adminEmail = (settings.adminEmail || process.env.ADMIN_EMAIL || "").trim();
    if (!adminEmail) { res.status(400).json({ error: "No admin email configured in Settings" }); return; }

    const vars = buildTemplateVars({ firstName: "Admin", name: "Admin User", email: adminEmail }, settings);
    const rendered = renderEmailContent(t.subject, t.htmlBody, t.textBody, vars);

    const result = await sendEmail({
      to: adminEmail,
      toName: "Admin",
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });

    if (result.success) {
      await ApprovedContentTemplate.updateOne({ _id: t._id }, { $set: { lastUsedAt: new Date() } });
    }

    res.json({ success: result.success, message: result.success ? `Test email sent to ${adminEmail}` : result.error });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
