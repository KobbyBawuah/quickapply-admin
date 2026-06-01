import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { EmailLog } from "../models/EmailLog.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/email-logs", requireAuth, async (req, res) => {
  try {
    const {
      campaignType,
      status,
      startDate,
      endDate,
      search,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const query: any = {};
    if (campaignType) query.campaignType = campaignType;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) query.sentAt.$gte = new Date(startDate);
      if (endDate) query.sentAt.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { recipientEmail: { $regex: search, $options: "i" } },
        { recipientName: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [rawLogs, total] = await Promise.all([
      EmailLog.find(query).sort({ sentAt: -1 }).skip(skip).limit(limitNum).lean(),
      EmailLog.countDocuments(query),
    ]);

    const logs = rawLogs.map((l: any) => ({ ...l, _id: l._id.toString() }));
    res.json({ logs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get email logs");
    res.status(500).json({ error: "Failed to get email logs" });
  }
});

router.get("/email-logs/export", requireAuth, async (req, res) => {
  try {
    const logs = await EmailLog.find().sort({ sentAt: -1 }).limit(5000).lean();
    const headers = [
      "recipientEmail",
      "recipientName",
      "campaignType",
      "subject",
      "status",
      "sentAt",
      "errorMessage",
      "providerMessageId",
    ];
    const csvRows = [
      headers.join(","),
      ...logs.map((log: any) =>
        headers
          .map((h) => {
            const val = log[h] ?? "";
            const str = val instanceof Date ? val.toISOString() : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=email-logs.csv");
    res.send(csvRows.join("\n"));
  } catch (err: any) {
    req.log.error({ err }, "Failed to export email logs");
    res.status(500).json({ error: "Failed to export logs" });
  }
});

export default router;
