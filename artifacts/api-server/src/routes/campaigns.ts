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

function parsePage(value: unknown): number {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parseLimit(value: unknown): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) return 25;
  return Math.min(100, Math.floor(limit));
}

function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  const end = start + limit;

  return {
    items: items.slice(start, end),
    total,
    page: safePage,
    limit,
    totalPages,
  };
}

router.get("/campaigns/runs", requireAuth, async (req, res) => {
  try {
    const { type, page = "1", limit = "20" } = req.query as Record<
      string,
      string
    >;

    const query: any = {};

    if (type && type !== "all") {
      query.campaignType = type;
    }

    const pageNum = parsePage(page);
    const limitNum = parseLimit(limit);
    const skip = (pageNum - 1) * limitNum;

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
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
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
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    const users = await getInactiveUsers();
    const paginated = paginate(users, page, limit);

    res.json({
      users: paginated.items,
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      totalPages: paginated.totalPages,
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
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    const users = await getNewsletterUsers();
    const paginated = paginate(users, page, limit);
    const nextTopic = getNextNewsletterTopic();

    res.json({
      users: paginated.items,
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      totalPages: paginated.totalPages,
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