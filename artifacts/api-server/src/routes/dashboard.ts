import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getUserCollection } from "../lib/userQuery.js";
import { EmailLog } from "../models/EmailLog.js";
import { CampaignRun } from "../models/CampaignRun.js";
import { getSettings } from "../models/Settings.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const col = await getUserCollection();
    const settings = await getSettings();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      doNotContactCount,
      emailsSentThisWeek,
      newsletterEmailsSent,
      failedEmails,
    ] = await Promise.all([
      col.countDocuments({}),
      col.countDocuments({ lastLoginAt: { $gte: sevenDaysAgo } }),
      col.countDocuments({ lastLoginAt: { $lt: sevenDaysAgo, $exists: true } }),
      col.countDocuments({ doNotContact: true }),
      EmailLog.countDocuments({ status: "sent", sentAt: { $gte: weekStart } }),
      EmailLog.countDocuments({ campaignType: "newsletter", status: "sent", sentAt: { $gte: weekStart } }),
      EmailLog.countDocuments({ status: "failed" }),
    ]);

    const lastRun = await CampaignRun.findOne({ campaignType: "inactive" }).sort({ startedAt: -1 });
    const lastMondayCampaignStatus = lastRun ? lastRun.status : "never_run";

    // Next Monday at 9:00 AM America/New_York
    const timezone = process.env.CRON_TIMEZONE || "America/New_York";
    const nextMonday = new Date(now);
    const dayOfWeek = nextMonday.getDay(); // 0=Sun, 1=Mon
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
      lastMondayCampaignStatus,
      nextScheduledCampaign: nextMonday.toISOString(),
      timezone,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Failed to get dashboard stats", message: err.message });
  }
});

export default router;
