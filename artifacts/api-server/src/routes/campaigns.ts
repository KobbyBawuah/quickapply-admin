import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { CampaignRun } from "../models/CampaignRun.js";
import {
  runInactiveCampaign,
  runNewsletterCampaign,
  getInactiveUsers,
  getNewsletterUsers,
  getNextNewsletterTopic,
} from "../lib/campaignService.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/campaigns/runs", requireAuth, async (req, res) => {
  try {
    const { type, page = "1", limit = "20" } = req.query as Record<string, string>;
    const query: any = {};
    if (type && type !== "all") query.campaignType = type;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const [rawRuns, total] = await Promise.all([
      CampaignRun.find(query).sort({ startedAt: -1 }).skip(skip).limit(limitNum).lean(),
      CampaignRun.countDocuments(query),
    ]);
    const runs = rawRuns.map((r: any) => ({ ...r, _id: r._id.toString() }));
    res.json({ runs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get campaign runs");
    res.status(500).json({ error: "Failed to get campaign runs" });
  }
});

router.get("/campaigns/runs/:runId", requireAuth, async (req, res) => {
  try {
    const run = await CampaignRun.findById(req.params.runId).lean();
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json({ ...(run as any), _id: (run as any)._id.toString() });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get campaign run");
    res.status(500).json({ error: "Failed to get campaign run" });
  }
});

router.get("/campaigns/inactive/preview", requireAuth, async (req, res) => {
  try {
    const users = await getInactiveUsers();
    const serialized = users.map((u) => ({
      ...u,
      _id: u._id?.toString(),
      daysInactive: u.lastLoginAt
        ? Math.floor((Date.now() - new Date(u.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
        : -1,
    }));
    res.json({ users: serialized, total: serialized.length });
  } catch (err: any) {
    req.log.error({ err }, "Failed to preview inactive campaign");
    res.status(500).json({ error: "Failed to preview campaign" });
  }
});

router.post("/campaigns/inactive/run", requireAuth, async (req, res) => {
  try {
    // Create the run record immediately and return the runId
    const run = await CampaignRun.create({
      campaignType: "inactive",
      triggerType: "manual",
      startedAt: new Date(),
      status: "running",
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      matchedUsers: 0,
    });
    const runId = run._id.toString();

    // Respond immediately so client can start polling
    res.json({ runId, status: "running", sentCount: 0, failedCount: 0, skippedCount: 0, matchedUsers: 0, message: "Campaign started" });

    // Execute campaign in background
    setImmediate(async () => {
      try {
        await runInactiveCampaign("manual", runId);
      } catch (err: any) {
        logger.error({ err, runId }, "Background inactive campaign failed");
        await CampaignRun.updateOne(
          { _id: run._id },
          { $set: { status: "failed", finishedAt: new Date(), notes: err.message } }
        ).catch(() => {});
      }
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to start inactive campaign");
    res.status(500).json({ error: "Failed to start campaign", message: err.message });
  }
});

router.get("/campaigns/newsletter/preview", requireAuth, async (req, res) => {
  try {
    const users = await getNewsletterUsers();
    const serialized = users.map((u) => ({
      ...u,
      _id: u._id?.toString(),
      daysInactive: u.lastLoginAt
        ? Math.floor((Date.now() - new Date(u.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
        : -1,
    }));
    const nextTopic = getNextNewsletterTopic();
    res.json({ users: serialized, total: serialized.length, nextTopic });
  } catch (err: any) {
    req.log.error({ err }, "Failed to preview newsletter campaign");
    res.status(500).json({ error: "Failed to preview newsletter" });
  }
});

router.post("/campaigns/newsletter/run", requireAuth, async (req, res) => {
  try {
    const { topic, templateId } = req.body || {};

    // Create run record immediately
    const run = await CampaignRun.create({
      campaignType: "newsletter",
      triggerType: "manual",
      startedAt: new Date(),
      status: "running",
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      matchedUsers: 0,
    });
    const runId = run._id.toString();

    // Respond immediately so client can start polling
    res.json({ runId, status: "running", sentCount: 0, failedCount: 0, skippedCount: 0, matchedUsers: 0, message: "Campaign started" });

    // Execute in background
    setImmediate(async () => {
      try {
        await runNewsletterCampaign("manual", topic, templateId, runId);
      } catch (err: any) {
        logger.error({ err, runId }, "Background newsletter campaign failed");
        await CampaignRun.updateOne(
          { _id: run._id },
          { $set: { status: "failed", finishedAt: new Date(), notes: err.message } }
        ).catch(() => {});
      }
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to start newsletter campaign");
    res.status(500).json({ error: "Failed to start newsletter", message: err.message });
  }
});

export default router;
