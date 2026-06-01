import nodemailer from "nodemailer";
import { getSettings } from "../models/Settings.js";
import { logger } from "./logger.js";
import {
  sanitizeHtmlWithoutDashes,
  sanitizeTextWithoutDashes,
} from "./contentSanitizer.js";

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export function buildTemplateVars(user: any, settings: any): Record<string, string> {
  const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null;

  const daysInactive = lastLogin
    ? Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    firstName: user.firstName || user.name?.split(" ")[0] || "there",
    lastName: user.lastName || "",
    name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "there",
    email: user.email || "",
    lastLoginDate: lastLogin ? lastLogin.toLocaleDateString() : "N/A",
    daysInactive: String(daysInactive),
    plan: user.plan || "free",
    subscriptionStatus: user.subscriptionStatus || "free",
    country: user.country || "",
    ctaUrl: settings?.ctaUrl || process.env.CTA_URL || "https://quickapplypro.com/pricing",
    discountCode: settings?.discountCode || process.env.DISCOUNT_CODE || "QAP20",
    discountText: settings?.discountText || process.env.DISCOUNT_TEXT || "20% off your next upgrade",
    discountUrl: settings?.discountUrl || process.env.DISCOUNT_URL || "https://quickapplypro.com/pricing",
    topic: "",
  };
}

export function renderEmailContent(
  subject: string,
  htmlBody: string,
  textBody: string | undefined,
  vars: Record<string, string>
): { subject: string; html: string; text: string } {
  const renderedSubject = renderTemplate(subject || "", vars);
  const renderedHtml = renderTemplate(htmlBody || "", vars);
  const renderedText = textBody ? renderTemplate(textBody, vars) : "";

  return {
    subject: sanitizeTextWithoutDashes(renderedSubject),
    html: sanitizeHtmlWithoutDashes(renderedHtml),
    text: sanitizeTextWithoutDashes(renderedText),
  };
}

export async function createTransporter() {
  const settings = await getSettings();

  const emailUser = settings.gmailUser || process.env.EMAIL_USER || "";
  const emailPass = settings.gmailPassword || process.env.EMAIL_APP_PASSWORD || "";

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
}

export async function sendEmail(opts: EmailOptions): Promise<EmailResult> {
  const settings = await getSettings();

  const senderName = settings.senderName || process.env.SENDER_NAME || "QuickApply Pro";
  const senderEmail =
    settings.senderEmail || process.env.SENDER_EMAIL || process.env.EMAIL_USER || "";
  const replyTo = settings.replyToEmail || process.env.REPLY_TO_EMAIL || senderEmail;

  try {
    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      replyTo,
      to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
      subject: sanitizeTextWithoutDashes(opts.subject || ""),
      html: sanitizeHtmlWithoutDashes(opts.html || ""),
      text: sanitizeTextWithoutDashes(opts.text || ""),
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    logger.error({ err }, "Failed to send email");

    return {
      success: false,
      error: err.message,
    };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}