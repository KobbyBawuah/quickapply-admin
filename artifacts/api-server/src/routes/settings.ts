import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getSettings, AppSettings } from "../models/Settings.js";
import { testMongoConnection } from "../lib/mongodb.js";
import { sendEmail } from "../lib/emailService.js";
import { EmailLog } from "../models/EmailLog.js";

const router = Router();

function stripSensitiveFields(obj: any) {
  const result = { ...obj };

  // Remove sensitive fields
  delete result.gmailPassword;
  delete result.claudeApiKey;
  delete result.openAiApiKey;
  delete result.geminiApiKey;
  delete result.falKey;
  delete result.resendApiKey;

  // Boolean flags for frontend
  result.claudeApiKeySet = !!obj.claudeApiKey;
  result.openAiApiKeySet = !!obj.openAiApiKey;
  result.geminiApiKeySet = !!obj.geminiApiKey;
  result.falKeySet = !!obj.falKey;

  return result;
}

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();

    const obj = settings.toObject();

    res.json(stripSensitiveFields(obj));
  } catch (err: any) {
    req.log.error({ err }, "Failed to get settings");

    res.status(500).json({
      error: err.message || "Failed to get settings",
    });
  }
});

router.put("/settings", requireAuth, async (req, res) => {
  try {
    let settings = await AppSettings.findOne();

    if (!settings) {
      settings = await getSettings();
    }

    const body = { ...req.body };

    // Remove frontend-only computed fields
    delete body.claudeApiKeySet;
    delete body.openAiApiKeySet;
    delete body.geminiApiKeySet;
    delete body.falKeySet;

    // Remove empty/null/undefined values
    Object.keys(body).forEach((key) => {
      const value = body[key];

      if (
        value === "" ||
        value === null ||
        value === undefined
      ) {
        delete body[key];
      }
    });

    // Preserve old sensitive values if blank
    const sensitiveFields = [
      "gmailPassword",
      "gmailUser",
      "resendApiKey",
      "claudeApiKey",
      "openAiApiKey",
      "geminiApiKey",
      "falKey",
    ];

    sensitiveFields.forEach((field) => {
      if (!body[field]) {
        delete body[field];
      }
    });

    // Validate AI provider enum
    const validProviders = [
      "claude",
      "openai",
      "gemini",
      "fal",
      "local",
    ];

    if (
      body.textAiProvider &&
      !validProviders.includes(body.textAiProvider)
    ) {
      delete body.textAiProvider;
    }

    // Trim strings
    Object.keys(body).forEach((key) => {
      if (typeof body[key] === "string") {
        body[key] = body[key].trim();
      }
    });

    Object.assign(settings, body);

    await settings.save();

    const updated = settings.toObject();

    res.json(stripSensitiveFields(updated));
  } catch (err: any) {
    req.log.error({ err }, "Failed to update settings");

    res.status(500).json({
      error: err.message || "Failed to update settings",
    });
  }
});

router.post("/settings/test-mongodb", requireAuth, async (req, res) => {
  try {
    const {
      mongoUri,
      databaseName,
      usersCollection,
    } = req.body;

    if (!mongoUri) {
      res.status(400).json({
        success: false,
        message: "MongoDB URI is required",
      });

      return;
    }

    const result = await testMongoConnection(
      mongoUri,
      databaseName,
      usersCollection
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post("/settings/test-email", requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();

    const adminEmail = (
      settings.adminEmail ||
      process.env.ADMIN_EMAIL ||
      ""
    ).trim();

    if (!adminEmail) {
      res.status(400).json({
        success: false,
        message:
          "No Admin Email configured. Set it in Settings first.",
      });

      return;
    }

    const result = await sendEmail({
      to: adminEmail,
      subject: "QuickApply Pro — Email Test",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>QuickApply Pro</h2>
          <p>Email sending is configured correctly.</p>
          <p>
            Sent to:
            <strong>${adminEmail}</strong>
          </p>
        </div>
      `,
      text: `QuickApply Pro test email sent to ${adminEmail}`,
    });

    await EmailLog.create({
      recipientEmail: adminEmail,
      recipientName: "Admin",
      campaignType: "test_email",
      subject: "QuickApply Pro — Email Test",
      htmlBody: `<p>Test email sent to ${adminEmail}</p>`,
      status: result.success ? "sent" : "failed",
      provider: "gmail",
      providerMessageId: result.messageId,
      errorMessage: result.error,
      sentAt: new Date(),
    }).catch(() => {});

    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent to ${adminEmail}`,
        recipient: adminEmail,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || "Failed to send test email",
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;