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
import {
  computeDaysInactive,
  getUserActivityDate,
  getUserDisplayName,
  getUserPlan,
  getUserSubscriptionStatus,
} from "../lib/userQuery.js";
import { logger } from "../lib/logger.js";

const router = Router();

function parsePage(value: unknown): number {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parseLimit(value: unknown, fallback = 25, max = 100): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(max, Math.floor(limit));
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;

  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function getPreviewPage<T>(items: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
}

function serializeCampaignUser(user: any) {
  const activityDate = getUserActivityDate(user);
  const daysInactive = computeDaysInactive(user);

  return {
    ...user,
    _id: user._id?.toString(),

    name: getUserDisplayName(user),
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",

    createdAt: toIsoDate(user.createdAt),
    updatedAt: toIsoDate(user.updatedAt),

    lastLoginAt: toIsoDate(user.lastLoginAt),

    // This is the same normalized activity date style used by the Users page.
    lastActiveAt: activityDate ? activityDate.toISOString() : null,

    // This fixes the -1d bug.
    daysInactive,

    doNotContact: bool(user.doNotContact),

    subscription: bool(user.subscription),
    subscriptionStatus: getUserSubscriptionStatus(user),
    subscriptionPlanName: user.subscriptionPlanName || "",
    plan: getUserPlan(user),

    loginFrom: user.loginFrom || "",
    language: user.language || "",
    country: user.country || "",

    emailVerified: bool(user.emailVerified),
    isFirstLogin: bool(user.isFirstLogin),
  };
}

router.get("/campaigns/runs", requireAuth, async (req, res) => {
  try {
    const { type } = req.query as Record<string, string>;

    const pageNum = parsePage(req.query.page);
    const limitNum = parseLimit(req.query.limit, 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};

    if (type && type !== "all") {
      query.campaignType = type;
    }

    const [rawRuns, total] = await Promise.all([
      CampaignRun.find(query)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CampaignRun.countDocuments(query),
    ]);

    const runs = rawRuns.map((run: any) => ({
      ...run,
      _id: run._id.toString(),
    }));

    res.json({
      runs,
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get campaign runs");

    res.status(500).json({
      error: "Failed to get campaign runs",
      message: err.message,
    });
  }
});

router.get("/campaigns/runs/:runId", requireAuth, async (req, res) => {
  try {
    const run = await CampaignRun.findById(req.params.runId).lean();

    if (!run) {
      res.status(404).json({
        error: "Run not found",
      });
      return;
    }

    res.json({
      ...(run as any),
      _id: (run as any)._id.toString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get campaign run");

    res.status(500).json({
      error: "Failed to get campaign run",
      message: err.message,
    });
  }
});

router.get("/campaigns/inactive/preview", requireAuth, async (req, res) => {
  try {
    const pageNum = parsePage(req.query.page);
    const limitNum = parseLimit(req.query.limit, 25, 100);

    const users = await getInactiveUsers();

    const serialized = users.map(serializeCampaignUser);

    const pagedUsers = getPreviewPage(serialized, pageNum, limitNum);

    res.json({
      users: pagedUsers,
      total: serialized.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(serialized.length / limitNum)),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to preview inactive campaign");

    res.status(500).json({
      error: "Failed to preview campaign",
      message: err.message,
    });
  }
});

router.post("/campaigns/inactive/run", requireAuth, async (req, res) => {
  try {
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

    res.json({
      runId,
      status: "running",
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      matchedUsers: 0,
      message: "Campaign started",
    });

    setImmediate(async () => {
      try {
        await runInactiveCampaign("manual", runId);
      } catch (err: any) {
        logger.error({ err, runId }, "Background inactive campaign failed");

        await CampaignRun.updateOne(
          { _id: run._id },
          {
            $set: {
              status: "failed",
              finishedAt: new Date(),
              notes: err.message,
            },
          }
        ).catch(() => {});
      }
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to start inactive campaign");

    res.status(500).json({
      error: "Failed to start campaign",
      message: err.message,
    });
  }
});

router.get("/campaigns/newsletter/preview", requireAuth, async (req, res) => {
  try {
    const pageNum = parsePage(req.query.page);
    const limitNum = parseLimit(req.query.limit, 25, 100);

    const users = await getNewsletterUsers();

    const serialized = users.map(serializeCampaignUser);

    const pagedUsers = getPreviewPage(serialized, pageNum, limitNum);

    const nextTopic = getNextNewsletterTopic();

    res.json({
      users: pagedUsers,
      total: serialized.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(serialized.length / limitNum)),
      nextTopic,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to preview newsletter campaign");

    res.status(500).json({
      error: "Failed to preview newsletter",
      message: err.message,
    });
  }
});

router.post("/campaigns/newsletter/run", requireAuth, async (req, res) => {
  try {
    const { topic, templateId } = req.body || {};

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

    res.json({
      runId,
      status: "running",
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      matchedUsers: 0,
      message: "Campaign started",
    });

    setImmediate(async () => {
      try {
        await runNewsletterCampaign("manual", topic, templateId, runId);
      } catch (err: any) {
        logger.error({ err, runId }, "Background newsletter campaign failed");

        await CampaignRun.updateOne(
          { _id: run._id },
          {
            $set: {
              status: "failed",
              finishedAt: new Date(),
              notes: err.message,
            },
          }
        ).catch(() => {});
      }
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to start newsletter campaign");

    res.status(500).json({
      error: "Failed to start newsletter",
      message: err.message,
    });
  }
});

export default router;