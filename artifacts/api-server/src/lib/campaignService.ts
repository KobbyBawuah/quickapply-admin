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

function inactiveUserQuery(cutoff: Date) {
  return {
    email: { $exists: true, $ne: "" },
    doNotContact: { $ne: true },
    $or: [
      { subscriptionStatus: "free" },
      { subscriptionStatus: "trial" },
      { subscriptionStatus: "expired" },
      { subscriptionStatus: "inactive" },
      { plan: "free" },
      { subscription: false },
      { subscription: "false" },
      { subscription: { $exists: false } },
    ],
    $and: [
      {
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
                $or: [
                  { loginAt: { $exists: false } },
                  { loginAt: null },
                ],
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
      },
    ],
  };
}

export async function getInactiveUsers(): Promise<any[]> {
  const settings = await getSettings();

  const inactiveDays = Number(settings.inactiveDaysThreshold || 7);
  const safeInactiveDays = Number.isFinite(inactiveDays) ? inactiveDays : 7;

  const cutoff = new Date(
    Date.now() - safeInactiveDays * 24 * 60 * 60 * 1000
  );

  const col = await getUserCollection();

  const users = await col
    .find(inactiveUserQuery(cutoff))
    .sort({ lastLoginAt: 1, lastActiveAt: 1, updatedAt: 1, createdAt: 1 })
    .toArray();

  const cooloff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const filtered: any[] = [];

  for (const user of users) {
    const recentLog = await EmailLog.findOne({
      recipientEmail: user.email,
      campaignType: "inactive",
      sentAt: { $gte: cooloff },
      status: "sent",
    });

    if (!recentLog) filtered.push(user);
  }

  return filtered;
}

export async function getNewsletterUsers(): Promise<any[]> {
  const settings = await getSettings();

  const intervalDays = Number(settings.newsletterIntervalDays || 14);
  const safeIntervalDays = Number.isFinite(intervalDays) ? intervalDays : 14;

  const cooloff = new Date(
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
      sentAt: { $gte: cooloff },
      status: "sent",
    });

    if (!recentLog) filtered.push(user);
  }

  return filtered;
}

async function incrementRun(
  runId: mongoose.Types.ObjectId,
  fields: {
    sentCount?: number;
    failedCount?: number;
    matchedUsers?: number;
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
): Promise<{
  runId: string;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  matchedUsers: number;
  status: string;
  message: string;
}> {
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

  const usersToProcess = users.slice(0, maxEmails);
  skippedCount += users.length - usersToProcess.length;

  await incrementRun(run._id, { matchedUsers: users.length });

  for (let i = 0; i < usersToProcess.length; i++) {
    const user = usersToProcess[i];
    const template = templates[i % templates.length];
    const vars = buildTemplateVars(user, settings);

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

    await incrementRun(run._id, { sentCount, failedCount });

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
): Promise<{
  runId: string;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  matchedUsers: number;
  status: string;
  message: string;
}> {
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
  const delay = Number(settings.delayBetweenEmailsMs ?? 1000);
  const topic = customTopic || getNextNewsletterTopic();

  let templates;

  if (overrideTemplateId && overrideTemplateId !== "auto") {
    const specific = await ApprovedContentTemplate.findOne({
      _id: overrideTemplateId,
      contentType: "newsletter",
      status: "active",
    });

    if (!specific) {
      const msg = "Selected template is not an active approved newsletter template.";

      run.status = "failed";
      run.notes = msg;
      run.finishedAt = new Date();
      run.matchedUsers = users.length;

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

  const usersToProcess = users.slice(0, maxEmails);
  skippedCount += users.length - usersToProcess.length;

  await incrementRun(run._id, { matchedUsers: users.length });

  for (let i = 0; i < usersToProcess.length; i++) {
    const user = usersToProcess[i];
    const template = templates[0];
    const vars = { ...buildTemplateVars(user, settings), topic };

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

    await incrementRun(run._id, { sentCount, failedCount });

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