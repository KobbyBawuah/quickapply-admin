import { EmailLog } from "../models/EmailLog.js";
import { CampaignRun } from "../models/CampaignRun.js";
import { ApprovedContentTemplate } from "../models/ApprovedContentTemplate.js";
import { getUserCollection } from "./userQuery.js";
import { getSettings } from "../models/Settings.js";
import {
  sendEmail,
  buildTemplateVars,
  renderEmailContent,
  sleep,
} from "./emailService.js";
import mongoose from "mongoose";

type CampaignResult = {
  runId: string;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  matchedUsers: number;
  status: string;
  message: string;
};

function getUserName(user: any): string {
  return (
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.email ||
    "there"
  );
}

function buildSafeTemplateVars(
  user: any,
  settings: any,
  extra?: Record<string, any>
) {
  const baseVars = buildTemplateVars(user, settings) as Record<string, any>;

  return {
    ...baseVars,
    ...(extra || {}),
    name: baseVars.name || getUserName(user),
  } as Record<string, any> & { name: string };
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isPaidUser(user: any): boolean {
  const subscription = isTruthy(user?.subscription);
  const plan = String(user?.plan || user?.subscriptionPlanName || "").toLowerCase();
  const status = String(user?.subscriptionStatus || "").toLowerCase();

  return (
    subscription ||
    status === "active" ||
    status === "paid" ||
    plan.includes("monthly") ||
    plan.includes("yearly") ||
    plan.includes("premium") ||
    plan.includes("pro")
  );
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

function getUserActivityDate(user: any): Date | null {
  return (
    parseDate(user?.lastLoginAt) ||
    parseDate(user?.lastActiveAt) ||
    parseDate(user?.loginAt) ||
    parseDate(user?.createdAt)
  );
}

function getDaysInactive(user: any, now = new Date()): number | null {
  const activityDate = getUserActivityDate(user);

  if (!activityDate) return null;

  const diffMs = now.getTime() - activityDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}

function isEligibleForInactiveCampaign(
  user: any,
  thresholdDays: number,
  now = new Date()
): boolean {
  if (!user?.email || typeof user.email !== "string") return false;
  if (user.doNotContact === true) return false;
  if (isPaidUser(user)) return false;

  const daysInactive = getDaysInactive(user, now);

  if (daysInactive === null) return false;

  return daysInactive >= thresholdDays;
}

function serializeCampaignUser(user: any) {
  const activityDate = getUserActivityDate(user);
  const daysInactive = getDaysInactive(user);

  return {
    ...user,
    name: getUserName(user),
    activityDate,
    daysInactive,
    lastLoginAt: user?.lastLoginAt || null,
  };
}

export async function getInactiveUsers(): Promise<any[]> {
  const settings = await getSettings();

  const inactiveDays = Number(settings.inactiveDaysThreshold || 7);
  const safeInactiveDays = Number.isFinite(inactiveDays) ? inactiveDays : 7;

  const cooldown = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const col = await getUserCollection();

  const users = await col
    .find({
      email: { $exists: true, $ne: "" },
      doNotContact: { $ne: true },
    })
    .toArray();

  const filtered: any[] = [];

  for (const user of users) {
    if (!isEligibleForInactiveCampaign(user, safeInactiveDays)) {
      continue;
    }

    const recentLog = await EmailLog.findOne({
      recipientEmail: user.email,
      campaignType: "inactive",
      sentAt: { $gte: cooldown },
      status: "sent",
    });

    if (recentLog) continue;

    filtered.push(serializeCampaignUser(user));
  }

  filtered.sort((a, b) => {
    const aDate = getUserActivityDate(a)?.getTime() ?? 0;
    const bDate = getUserActivityDate(b)?.getTime() ?? 0;

    return aDate - bDate;
  });

  return filtered;
}

export async function getNewsletterUsers(): Promise<any[]> {
  const settings = await getSettings();

  const intervalDays = Number(settings.newsletterIntervalDays || 14);
  const safeIntervalDays = Number.isFinite(intervalDays) ? intervalDays : 14;

  const cooldown = new Date(
    Date.now() - safeIntervalDays * 24 * 60 * 60 * 1000
  );

  const col = await getUserCollection();

  const users = await col
    .find({
      email: { $exists: true, $ne: "" },
      doNotContact: { $ne: true },
    })
    .toArray();

  const filtered: any[] = [];

  for (const user of users) {
    const recentLog = await EmailLog.findOne({
      recipientEmail: user.email,
      campaignType: "newsletter",
      sentAt: { $gte: cooldown },
      status: "sent",
    });

    if (!recentLog) {
      filtered.push(serializeCampaignUser(user));
    }
  }

  filtered.sort((a, b) => {
    const aDate = getUserActivityDate(a)?.getTime() ?? 0;
    const bDate = getUserActivityDate(b)?.getTime() ?? 0;

    return bDate - aDate;
  });

  return filtered;
}

async function incrementRun(
  runId: mongoose.Types.ObjectId,
  fields: {
    sentCount?: number;
    failedCount?: number;
    matchedUsers?: number;
    skippedCount?: number;
  }
) {
  try {
    await CampaignRun.updateOne({ _id: runId }, { $set: fields });
  } catch {
    // non-fatal
  }
}

export async function runInactiveCampaign(
  triggerType: "manual" | "scheduled" = "manual",
  existingRunId?: string
): Promise<CampaignResult> {
  let run: any;

  if (existingRunId) {
    run = await CampaignRun.findById(existingRunId);

    if (!run) {
      throw new Error(`CampaignRun ${existingRunId} not found`);
    }
  } else {
    run = await CampaignRun.create({
      campaignType: "inactive",
      triggerType,
      startedAt: new Date(),
      status: "running",
    });
  }

  const settings = await getSettings();
  const users = await getInactiveUsers();
  const maxEmails = Number(settings.maxEmailsPerRun || 50);
  const safeMaxEmails = Number.isFinite(maxEmails) && maxEmails > 0 ? maxEmails : 50;
  const delay = Number(settings.delayBetweenEmailsMs ?? 1000);

  const templates = await ApprovedContentTemplate.find({
    contentType: "inactive_email",
    status: "active",
  });

  if (templates.length === 0) {
    const msg =
      "No approved template available. Approve a template first in AI Content → Approved Templates.";

    run.status = "failed";
    run.notes = msg;
    run.finishedAt = new Date();
    run.matchedUsers = users.length;
    run.skippedCount = users.length;

    await run.save();

    return {
      runId: run._id.toString(),
      sentCount: 0,
      failedCount: 0,
      skippedCount: users.length,
      matchedUsers: users.length,
      status: "failed",
      message: msg,
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const usersToProcess = users.slice(0, safeMaxEmails);
  skippedCount += users.length - usersToProcess.length;

  await incrementRun(run._id, {
    matchedUsers: users.length,
    skippedCount,
  });

  for (let i = 0; i < usersToProcess.length; i++) {
    const user = usersToProcess[i];
    const template = templates[i % templates.length];
    const vars = buildSafeTemplateVars(user, settings);

    const rendered = renderEmailContent(
      template.subject,
      template.htmlBody,
      template.textBody,
      vars
    );

    const result = await sendEmail({
      to: user.email,
      toName: vars.name,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await EmailLog.create({
      recipientEmail: user.email,
      recipientName: vars.name,
      userId: user._id?.toString() || "",
      campaignType: "inactive",
      campaignRunId: run._id.toString(),
      templateId: template._id.toString(),
      subject: rendered.subject,
      htmlBody: rendered.html,
      textBody: rendered.text,
      status: result.success ? "sent" : "failed",
      provider: "gmail",
      providerMessageId: result.messageId,
      errorMessage: result.error,
      sentAt: new Date(),
    });

    if (result.success) {
      sentCount++;

      await ApprovedContentTemplate.updateOne(
        { _id: template._id },
        {
          $inc: { usageCount: 1 },
          $set: { lastUsedAt: new Date() },
        }
      );
    } else {
      failedCount++;
    }

    await incrementRun(run._id, {
      sentCount,
      failedCount,
      skippedCount,
    });

    if (delay > 0 && i < usersToProcess.length - 1) {
      await sleep(delay);
    }
  }

  run.sentCount = sentCount;
  run.failedCount = failedCount;
  run.skippedCount = skippedCount;
  run.matchedUsers = users.length;
  run.status = "completed";
  run.finishedAt = new Date();

  await run.save();

  return {
    runId: run._id.toString(),
    sentCount,
    failedCount,
    skippedCount,
    matchedUsers: users.length,
    status: "completed",
    message: `Campaign complete. Sent: ${sentCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`,
  };
}

const NEWSLETTER_TOPICS = [
  "Why job applications feel harder in 2026",
  "Why tailored resumes beat mass applying",
  "How scam job posts waste serious candidates' time",
  "Why working professionals should keep an application kit ready",
  "Why applying to 50 jobs with one resume does not work",
  "How international job seekers can improve application quality",
  "Why working professionals should not wait until they are desperate to update their resume",
  "Why job fraud detection matters before applying",
];

export function getNextNewsletterTopic(): string {
  const index =
    Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 14)) %
    NEWSLETTER_TOPICS.length;

  return NEWSLETTER_TOPICS[index];
}

export async function runNewsletterCampaign(
  triggerType: "manual" | "scheduled" = "manual",
  customTopic?: string,
  overrideTemplateId?: string,
  existingRunId?: string
): Promise<CampaignResult> {
  let run: any;

  if (existingRunId) {
    run = await CampaignRun.findById(existingRunId);

    if (!run) {
      throw new Error(`CampaignRun ${existingRunId} not found`);
    }
  } else {
    run = await CampaignRun.create({
      campaignType: "newsletter",
      triggerType,
      startedAt: new Date(),
      status: "running",
    });
  }

  const settings = await getSettings();
  const users = await getNewsletterUsers();
  const maxEmails = Number(settings.maxEmailsPerRun || 50);
  const safeMaxEmails = Number.isFinite(maxEmails) && maxEmails > 0 ? maxEmails : 50;
  const delay = Number(settings.delayBetweenEmailsMs ?? 1000);
  const topic = customTopic || getNextNewsletterTopic();

  let templates: any[];

  if (overrideTemplateId && overrideTemplateId !== "auto") {
    const specific = await ApprovedContentTemplate.findOne({
      _id: overrideTemplateId,
      contentType: "newsletter",
      status: "active",
    });

    if (!specific) {
      const msg =
        "Selected template is not an active approved newsletter template.";

      run.status = "failed";
      run.notes = msg;
      run.finishedAt = new Date();
      run.matchedUsers = users.length;
      run.skippedCount = users.length;

      await run.save();

      return {
        runId: run._id.toString(),
        sentCount: 0,
        failedCount: 0,
        skippedCount: users.length,
        matchedUsers: users.length,
        status: "failed",
        message: msg,
      };
    }

    templates = [specific];
  } else {
    templates = await ApprovedContentTemplate.find({
      contentType: "newsletter",
      status: "active",
    });
  }

  if (templates.length === 0) {
    const msg =
      "No approved template available. Approve a newsletter template first in AI Content → Approved Templates.";

    run.status = "failed";
    run.notes = msg;
    run.finishedAt = new Date();
    run.matchedUsers = users.length;
    run.skippedCount = users.length;

    await run.save();

    return {
      runId: run._id.toString(),
      sentCount: 0,
      failedCount: 0,
      skippedCount: users.length,
      matchedUsers: users.length,
      status: "failed",
      message: msg,
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const usersToProcess = users.slice(0, safeMaxEmails);
  skippedCount += users.length - usersToProcess.length;

  await incrementRun(run._id, {
    matchedUsers: users.length,
    skippedCount,
  });

  for (let i = 0; i < usersToProcess.length; i++) {
    const user = usersToProcess[i];
    const template = templates[0];
    const vars = buildSafeTemplateVars(user, settings, { topic });

    const rendered = renderEmailContent(
      template.subject,
      template.htmlBody,
      template.textBody,
      vars
    );

    const result = await sendEmail({
      to: user.email,
      toName: vars.name,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await EmailLog.create({
      recipientEmail: user.email,
      recipientName: vars.name,
      userId: user._id?.toString() || "",
      campaignType: "newsletter",
      campaignRunId: run._id.toString(),
      templateId: template._id.toString(),
      subject: rendered.subject,
      htmlBody: rendered.html,
      textBody: rendered.text,
      status: result.success ? "sent" : "failed",
      provider: "gmail",
      providerMessageId: result.messageId,
      errorMessage: result.error,
      sentAt: new Date(),
    });

    if (result.success) {
      sentCount++;

      await ApprovedContentTemplate.updateOne(
        { _id: template._id },
        {
          $inc: { usageCount: 1 },
          $set: { lastUsedAt: new Date() },
        }
      );
    } else {
      failedCount++;
    }

    await incrementRun(run._id, {
      sentCount,
      failedCount,
      skippedCount,
    });

    if (delay > 0 && i < usersToProcess.length - 1) {
      await sleep(delay);
    }
  }

  run.sentCount = sentCount;
  run.failedCount = failedCount;
  run.skippedCount = skippedCount;
  run.matchedUsers = users.length;
  run.status = "completed";
  run.finishedAt = new Date();

  await run.save();

  return {
    runId: run._id.toString(),
    sentCount,
    failedCount,
    skippedCount,
    matchedUsers: users.length,
    status: "completed",
    message: `Newsletter complete. Sent: ${sentCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`,
  };
}