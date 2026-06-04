import { EmailLog } from "../models/EmailLog.js";
import { CampaignRun } from "../models/CampaignRun.js";
import { ApprovedContentTemplate } from "../models/ApprovedContentTemplate.js";
import {
  getUserCollection,
  buildUserQuery,
  computeDaysInactive,
  getUserActivityDate,
  getUserDisplayName,
  getUserPlan,
  getUserSubscriptionStatus,
} from "./userQuery.js";
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

export function normalizeCampaignUser(user: any) {
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

    lastLoginAt: iso(user.lastLoginAt),

    // Same as Users page
    lastActiveAt: activityDate ? activityDate.toISOString() : null,
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

    answerClicksCount: num(user.answerClicksCount),
    resumeClicksCount: num(user.resumeClicksCount),
    coverLetterClicksCount: num(user.coverLetterClicksCount),
    improvementClicksCount: num(
      user.improvementClicksCount || user.improvmentClicksCount
    ),
    resumeGradeClicksCount: num(user.resumeGradeClicksCount),
    resumeGradeAiFixClicksCount: num(user.resumeGradeAiFixClicksCount),
    followUpEmailClicksCount: num(user.followUpEmailClicksCount),
    connectionRequestClicksCount: num(user.connectionRequestClicksCount),
    scrapeJobUrlClicksCount: num(user.scrapeJobUrlClicksCount),
    fraudCheckClicksCount: num(user.fraudCheckClicksCount),
    interviewPrepClicksCount: num(user.interviewPrepClicksCount),

    linkedinProfile: user.linkedinProfile || user.linkedInProfile || "",
    linkedInProfile: user.linkedinProfile || user.linkedInProfile || "",
    websiteLink: user.websiteLink || "",
  };
}

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

function getInactiveFilterQuery() {
  // This is the exact same filter path used by Users page when filter = inactive.
  return buildUserQuery("inactive", "");
}

function getNewsletterFilterQuery() {
  return {
    email: { $exists: true, $ne: "" },
    doNotContact: { $ne: true },
  };
}

async function filterRecentlyEmailedUsers(
  users: any[],
  campaignType: "inactive" | "newsletter",
  cooldownDays: number
): Promise<any[]> {
  const safeCooldownDays = Number.isFinite(cooldownDays) ? cooldownDays : 7;

  const cooldownDate = new Date(
    Date.now() - safeCooldownDays * 24 * 60 * 60 * 1000
  );

  const filtered: any[] = [];

  for (const user of users) {
    const recentLog = await EmailLog.findOne({
      recipientEmail: user.email,
      campaignType,
      sentAt: { $gte: cooldownDate },
      status: "sent",
    });

    if (!recentLog) {
      filtered.push(user);
    }
  }

  return filtered;
}

export async function getInactiveUsers(): Promise<any[]> {
  const col = await getUserCollection();

  const rawUsers = await col
    .find(getInactiveFilterQuery())
    // Same practical order as Users page inactive filter.
    .sort({ lastLoginAt: -1, createdAt: -1, updatedAt: -1 })
    .toArray();

  const normalizedUsers = rawUsers
    .map(normalizeCampaignUser)
    .filter((user) => {
      const daysInactive = Number(user.daysInactive);

      return (
        user.email &&
        !user.doNotContact &&
        Number.isFinite(daysInactive) &&
        daysInactive >= 7
      );
    });

  return filterRecentlyEmailedUsers(normalizedUsers, "inactive", 7);
}

export async function getNewsletterUsers(): Promise<any[]> {
  const settings = await getSettings();

  const intervalDays = Number(settings.newsletterIntervalDays || 14);
  const safeIntervalDays = Number.isFinite(intervalDays) ? intervalDays : 14;

  const col = await getUserCollection();

  const rawUsers = await col
    .find(getNewsletterFilterQuery())
    .sort({ lastLoginAt: -1, createdAt: -1, updatedAt: -1 })
    .toArray();

  const normalizedUsers = rawUsers.map(normalizeCampaignUser);

  return filterRecentlyEmailedUsers(
    normalizedUsers,
    "newsletter",
    safeIntervalDays
  );
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
    // Non-fatal
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
  const safeMaxEmails = Number.isFinite(maxEmails) ? maxEmails : 50;
  const delay = Number(settings.delayBetweenEmailsMs ?? 1000);
  const safeDelay = Number.isFinite(delay) ? delay : 1000;

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

    if (safeDelay > 0 && i < usersToProcess.length - 1) {
      await sleep(safeDelay);
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
  const safeMaxEmails = Number.isFinite(maxEmails) ? maxEmails : 50;
  const delay = Number(settings.delayBetweenEmailsMs ?? 1000);
  const safeDelay = Number.isFinite(delay) ? delay : 1000;
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

    if (safeDelay > 0 && i < usersToProcess.length - 1) {
      await sleep(safeDelay);
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