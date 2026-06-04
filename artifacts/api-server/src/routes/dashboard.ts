import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getUserCollection } from "../lib/userQuery.js";
import { EmailLog } from "../models/EmailLog.js";
import { CampaignRun } from "../models/CampaignRun.js";
import { getSettings } from "../models/Settings.js";

const router = Router();

function activeQuery(cutoff: Date) {
  return {
    $or: [
      { lastLoginAt: { $gte: cutoff } },
      { lastActiveAt: { $gte: cutoff } },
      { loginAt: { $gte: cutoff } },
      { updatedAt: { $gte: cutoff } },
      { createdAt: { $gte: cutoff } },
    ],
  };
}

function inactiveQuery(cutoff: Date) {
  return {
    email: { $exists: true, $ne: "" },
    $or: [
      { lastLoginAt: { $lt: cutoff, $exists: true, $ne: null } },
      { lastActiveAt: { $lt: cutoff, $exists: true, $ne: null } },
      { loginAt: { $lt: cutoff, $exists: true, $ne: null } },
      {
        $and: [
          {
            $or: [
              { lastLoginAt: { $exists: false } },
              { lastLoginAt: null },
            ],
          },
          {
            $or: [
              { lastActiveAt: { $exists: false } },
              { lastActiveAt: null },
            ],
          },
          {
            $or: [{ loginAt: { $exists: false } }, { loginAt: null }],
          },
          {
            $or: [
              { updatedAt: { $lt: cutoff, $exists: true } },
              { createdAt: { $lt: cutoff, $exists: true } },
            ],
          },
        ],
      },
    ],
  };
}

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const col = await getUserCollection();
    const settings = await getSettings();

    const now = new Date();
    const inactiveDays = Number(settings.inactiveDaysThreshold || 7);
    const safeInactiveDays = Number.isFinite(inactiveDays) ? inactiveDays : 7;

    const activityCutoff = new Date(
      now.getTime() - safeInactiveDays * 24 * 60 * 60 * 1000
    );

    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      doNotContactCount,
      emailsSentThisWeek,
      newsletterEmailsSent,
      failedEmails,
      campaignRuns,
    ] = await Promise.all([
      col.countDocuments({}),
      col.countDocuments(activeQuery(activityCutoff)),
      col.countDocuments(inactiveQuery(activityCutoff)),
      col.countDocuments({ doNotContact: true }),
      EmailLog.countDocuments({
        status: "sent",
        sentAt: { $gte: weekStart },
      }),
      EmailLog.countDocuments({
        campaignType: "newsletter",
        status: "sent",
      }),
      EmailLog.countDocuments({ status: "failed" }),
      CampaignRun.countDocuments({}),
    ]);

    const lastRun = await CampaignRun.findOne({
      campaignType: "inactive",
    }).sort({ startedAt: -1 });

    const timezone = process.env.CRON_TIMEZONE || "America/New_York";

    const nextMonday = new Date(now);
    const dayOfWeek = nextMonday.getDay();
    const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;

    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      doNotContactCount,
      emailsSentThisWeek,
      newsletterEmailsSent,
      failedEmails,
      campaignRuns,
      lastMondayCampaignStatus: lastRun ? lastRun.status : "never_run",
      nextScheduledCampaign: nextMonday.toISOString(),
      timezone,
      databaseName:
        process.env.MONGO_DB_NAME ||
        process.env.MONGODB_DB ||
        settings.databaseName ||
        "test",
      usersCollection:
        process.env.USERS_COLLECTION ||
        settings.usersCollection ||
        "users",
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get dashboard stats");

    res.status(500).json({
      error: "Failed to get dashboard stats",
      message: err.message,
    });
  }
});

export default router;