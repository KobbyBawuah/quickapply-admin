import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  getUserCollection,
  buildUserQuery,
  computeDaysInactive,
  getUserActivityDate,
  getUserDisplayName,
  getUserPlan,
  getUserSubscriptionStatus,
} from "../lib/userQuery.js";
import { EmailLog } from "../models/EmailLog.js";
import { EmailTemplate } from "../models/EmailTemplate.js";
import {
  sendEmail,
  buildTemplateVars,
  renderEmailContent,
} from "../lib/emailService.js";
import { getSettings } from "../models/Settings.js";
import mongoose from "mongoose";

const router = Router();

function getParamString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

function bool(value: any): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function num(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: any): string | null {
  if (!value) return null;

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeUser(user: any) {
  const activityDate = getUserActivityDate(user);

  return {
    ...user,
    _id: user._id?.toString(),

    name: getUserDisplayName(user),
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",

    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),

    // Real login date, if DB has it.
    lastLoginAt: iso(user.lastLoginAt),

    // Normalized frontend activity date.
    // Uses lastLoginAt first, then createdAt fallback.
    lastActiveAt: activityDate ? activityDate.toISOString() : null,

    // Inactivity should not be based on updatedAt.
    daysInactive: computeDaysInactive(user),

    subscription: bool(user.subscription),
    subscriptionStatus: getUserSubscriptionStatus(user),
    subscriptionPlanName: user.subscriptionPlanName || "",
    plan: getUserPlan(user),

    loginFrom: user.loginFrom || "",
    language: user.language || "",
    country: user.country || "",

    emailVerified: bool(user.emailVerified),
    isFirstLogin: bool(user.isFirstLogin),
    doNotContact: bool(user.doNotContact),

    textSize: user.textSize || "",
    fontFamily: user.fontFamily || "",
    includeCurrentDate: bool(user.includeCurrentDate),

    linkedinProfile: user.linkedinProfile || user.linkedInProfile || "",
    linkedInProfile: user.linkedinProfile || user.linkedInProfile || "",
    websiteLink: user.websiteLink || "",

    answerClicksCount: num(user.answerClicksCount),
    resumeClicksCount: num(user.resumeClicksCount),
    coverLetterClicksCount: num(user.coverLetterClicksCount),

    // DB typo support: improvmentClicksCount
    improvmentClicksCount: num(user.improvmentClicksCount),
    improvementClicksCount: num(
      user.improvementClicksCount || user.improvmentClicksCount
    ),

    resumeGradeClicksCount: num(user.resumeGradeClicksCount),
    resumeGradeAiFixClicksCount: num(user.resumeGradeAiFixClicksCount),
    followUpEmailClicksCount: num(user.followUpEmailClicksCount),
    connectionRequestClicksCount: num(user.connectionRequestClicksCount),
    scrapeJobUrlClicksCount: num(user.scrapeJobUrlClicksCount),
    fraudCheckClicksCount: num(user.fraudCheckClicksCount),
    jobRecommendationClicksCount: num(user.jobRecommendationClicksCount),
    jobRecommendationLoadMoreClicksCount: num(
      user.jobRecommendationLoadMoreClicksCount
    ),
    interviewPrepClicksCount: num(user.interviewPrepClicksCount),
    interviewSimulationClicksCount: num(user.interviewSimulationClicksCount),
    uploadJobFileClicksCount: num(user.uploadJobFileClicksCount),
    jobBookmarkedClicksCount: num(user.jobBookmarkedClicksCount),

    answerClicksCountFree: num(user.answerClicksCountFree),
    resumeClicksCountFree: num(user.resumeClicksCountFree),
    coverLetterClicksCountFree: num(user.coverLetterClicksCountFree),

    improvmentClicksCountFree: num(user.improvmentClicksCountFree),
    improvementClicksCountFree: num(
      user.improvementClicksCountFree || user.improvmentClicksCountFree
    ),

    resumeGradeClicksCountFree: num(user.resumeGradeClicksCountFree),
    resumeGradeAiFixClicksCountFree: num(user.resumeGradeAiFixClicksCountFree),
    followUpEmailClicksCountFree: num(user.followUpEmailClicksCountFree),
    connectionRequestClicksCountFree: num(
      user.connectionRequestClicksCountFree
    ),
    scrapeJobUrlClicksCountFree: num(user.scrapeJobUrlClicksCountFree),
    fraudCheckClicksCountFree: num(user.fraudCheckClicksCountFree),
    uploadJobFileClicksCountFree: num(user.uploadJobFileClicksCountFree),

    defaultResumeTemplate: user.defaultResumeTemplate || "",
    defaultResumeId: user.defaultResumeId || "",
    defaultResumeSource: user.defaultResumeSource || "",
    skipTemplateSelection: bool(user.skipTemplateSelection),

    hasSeenProductTour: bool(user.hasSeenProductTour),
    hasSeenProductTourGenerationModule: bool(
      user.hasSeenProductTourGenerationModule
    ),
    hasSeenResumeProductTour: bool(user.hasSeenResumeProductTour),
    whiteTextJobDescription: bool(user.whiteTextJobDescription),
    useDefaultResumeLayout: bool(user.useDefaultResumeLayout),
    skipFirstGenerationPopup: bool(user.skipFirstGenerationPopup),

    defaultSectionOrder: Array.isArray(user.defaultSectionOrder)
      ? user.defaultSectionOrder
      : [],
    defaultSectionVisibility: user.defaultSectionVisibility || {},
    preferences: user.preferences || null,
    canonicalRoles: Array.isArray(user.canonicalRoles)
      ? user.canonicalRoles
      : [],
  };
}

function toObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : id;
}

async function findUserById(userId: string) {
  const col = await getUserCollection();
  const id = toObjectId(userId);

  if (typeof id === "string") {
    return col.findOne({ _id: id as any });
  }

  return col.findOne({ _id: id });
}

function buildInactiveQuery(cutoff: Date) {
  return {
    email: { $exists: true, $ne: "" },
    doNotContact: { $ne: true },
    $or: [
      {
        lastLoginAt: {
          $lt: cutoff,
          $exists: true,
        },
      },
      {
        $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }],
        createdAt: {
          $lt: cutoff,
          $exists: true,
        },
      },
    ],
  };
}

router.get("/users", requireAuth, async (req, res) => {
  try {
    const {
      search,
      filter,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const col = await getUserCollection();

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(
      200,
      Math.max(1, parseInt(String(limit), 10) || 50)
    );
    const skip = (pageNum - 1) * limitNum;

    const query = buildUserQuery(filter, search);

    if (filter === "alreadyEmailed" || filter === "notEmailed") {
      const emails = await EmailLog.distinct("recipientEmail", {
        status: "sent",
      });

      query.email =
        filter === "alreadyEmailed" ? { $in: emails } : { $nin: emails };
    }

    const [rawUsers, total] = await Promise.all([
      col
        .find(query)
        .sort({ lastLoginAt: -1, createdAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      col.countDocuments(query),
    ]);

    const emails = rawUsers.map((u: any) => u.email).filter(Boolean);

    const logs = await EmailLog.find({
      recipientEmail: { $in: emails },
      status: "sent",
    })
      .sort({ sentAt: -1 })
      .lean();

    const lastEmailMap: Record<string, string> = {};

    for (const log of logs) {
      if (!lastEmailMap[log.recipientEmail]) {
        lastEmailMap[log.recipientEmail] = log.sentAt.toISOString();
      }
    }

    const users = rawUsers.map((u: any) => ({
      ...normalizeUser(u),
      lastEmailSent: lastEmailMap[u.email] || null,
      emailStatus: lastEmailMap[u.email] ? "emailed" : "not_emailed",
    }));

    res.json({
      users,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get users");

    res.status(500).json({
      error: "Failed to get users",
      message: err.message,
    });
  }
});

router.get("/users/inactive", requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();

    const inactiveDays = Number(settings.inactiveDaysThreshold || 7);
    const safeInactiveDays = Number.isFinite(inactiveDays)
      ? inactiveDays
      : 7;

    const cutoff = new Date(
      Date.now() - safeInactiveDays * 24 * 60 * 60 * 1000
    );

    const col = await getUserCollection();

    const rawUsers = await col
      .find(buildInactiveQuery(cutoff))
      .sort({ lastLoginAt: 1, createdAt: 1 })
      .toArray();

    const users = rawUsers.map(normalizeUser);

    res.json({
      users,
      total: users.length,
      page: 1,
      totalPages: 1,
      inactiveDays: safeInactiveDays,
      cutoff: cutoff.toISOString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get inactive users");

    res.status(500).json({
      error: "Failed to get inactive users",
      message: err.message,
    });
  }
});

router.get("/users/:userId/history", requireAuth, async (req, res) => {
  try {
    const userId = getParamString(req.params.userId);
    const user = await findUserById(userId);

    if (!user) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    const logs = await EmailLog.find({
      recipientEmail: user.email,
    })
      .sort({ sentAt: -1 })
      .lean();

    res.json({
      logs: logs.map((l: any) => ({
        ...l,
        _id: l._id.toString(),
      })),
      total: logs.length,
      page: 1,
      totalPages: 1,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to get user history");

    res.status(500).json({
      error: "Failed to get user history",
      message: err.message,
    });
  }
});

router.post("/users/:userId/send-email", requireAuth, async (req, res) => {
  try {
    const { templateId } = req.body;

    const userId = getParamString(req.params.userId);
    const user = await findUserById(userId);

    if (!user) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    const template = await EmailTemplate.findById(templateId);

    if (!template) {
      res.status(404).json({
        error: "Template not found",
      });
      return;
    }

    const settings = await getSettings();
    const normalizedUser = normalizeUser(user);
    const vars = buildTemplateVars(normalizedUser, settings);

    const rendered = renderEmailContent(
      template.subject,
      template.htmlBody,
      template.textBody,
      vars
    );

    const result = await sendEmail({
      to: normalizedUser.email,
      toName: vars.name,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await EmailLog.create({
      recipientEmail: normalizedUser.email,
      recipientName: vars.name,
      userId: normalizedUser._id,
      campaignType: "manual",
      templateId: template._id.toString(),
      subject: rendered.subject,
      htmlBody: rendered.html,
      status: result.success ? "sent" : "failed",
      provider: "gmail",
      providerMessageId: result.messageId,
      errorMessage: result.error,
      sentAt: new Date(),
    });

    if (result.success) {
      res.json({
        message: "Email sent successfully",
        success: true,
      });
    } else {
      res.status(500).json({
        message: result.error || "Failed to send email",
        success: false,
      });
    }
  } catch (err: any) {
    req.log.error({ err }, "Failed to send email to user");

    res.status(500).json({
      error: "Failed to send email",
      message: err.message,
    });
  }
});

router.post("/users/:userId/do-not-contact", requireAuth, async (req, res) => {
  try {
    const col = await getUserCollection();

    const userId = getParamString(req.params.userId);
    const id = toObjectId(userId);

    const result =
      typeof id === "string"
        ? await col.updateOne(
            { _id: id as any },
            { $set: { doNotContact: true } }
          )
        : await col.updateOne(
            { _id: id },
            { $set: { doNotContact: true } }
          );

    if (result.matchedCount === 0) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    res.json({
      message: "User marked as do-not-contact",
      success: true,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to mark user as do-not-contact");

    res.status(500).json({
      error: "Failed to update user",
      message: err.message,
    });
  }
});

export default router;