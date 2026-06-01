import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "../models/Settings.js";
import { logger } from "./logger.js";
import {
  applyBrandToDraft,
  buildBrandStylePrompt,
  sanitizeDraftForNoDashes,
  sanitizeTextWithoutDashes,
} from "./contentSanitizer.js";

export type TextAiProvider = "claude" | "openai" | "gemini" | "fal" | "local";

export interface GeneratedDraft {
  title: string;
  subject: string;
  preheader: string;
  angle: string;
  htmlBody: string;
  textBody: string;
  metadata?: Record<string, any>;
}

export interface GenerateOptions {
  contentType: "inactive_email" | "newsletter" | "both";
  count?: number;
  audience?: string;
  angle?: string;
  customInstructions?: string;
  includeDiscount?: boolean;
}

interface ProviderResult {
  drafts: GeneratedDraft[];
  provider: TextAiProvider;
  model: string;
  promptUsed: string;
}

interface RawProviderDraft {
  title?: string;
  subject?: string;
  preheader?: string;
  angle?: string;
  htmlBody?: string;
  textBody?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

function normalizeGeneratedDraft(
  draft: RawProviderDraft,
  settings: any,
  kind: "inactive_email" | "newsletter"
): GeneratedDraft {
  const safeDraft = sanitizeDraftForNoDashes({
    title: String(draft?.title || ""),
    subject: String(draft?.subject || ""),
    preheader: String(draft?.preheader || ""),
    angle: String(draft?.angle || ""),
    htmlBody: String(draft?.htmlBody || ""),
    textBody: String(draft?.textBody || ""),
    metadata: draft?.metadata || {},
  });

  const brandedDraft = applyBrandToDraft(safeDraft, settings, kind);

  return {
    title: String(brandedDraft.title || ""),
    subject: String(brandedDraft.subject || ""),
    preheader: String(brandedDraft.preheader || ""),
    angle: String(brandedDraft.angle || ""),
    htmlBody: String(brandedDraft.htmlBody || ""),
    textBody: String(brandedDraft.textBody || ""),
    metadata: brandedDraft.metadata || {},
  };
}

function normalizeGeneratedDrafts(
  drafts: any[],
  settings: any,
  kind: "inactive_email" | "newsletter"
): GeneratedDraft[] {
  return (drafts || []).map((draft) => normalizeGeneratedDraft(draft, settings, kind));
}

const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

const CLAUDE_MODEL_ALIASES: Record<string, string> = {
  "claude-3-5-sonnet-latest": DEFAULT_CLAUDE_MODEL,
  "claude-3.5-sonnet-latest": DEFAULT_CLAUDE_MODEL,
  "claude-3-5-sonnet-20241022": DEFAULT_CLAUDE_MODEL,
  "claude-3-5-sonnet-20240620": DEFAULT_CLAUDE_MODEL,
  "claude-3-7-sonnet-20250219": DEFAULT_CLAUDE_MODEL,
  "claude-sonnet-4": DEFAULT_CLAUDE_MODEL,
  "claude-sonnet-4-20250514": DEFAULT_CLAUDE_MODEL,
};

const CLAUDE_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "claude-haiku-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
]);

function sanitizeClaudeModel(model?: string) {
  const value = String(model || "").trim();

  if (!value) return DEFAULT_CLAUDE_MODEL;

  if (CLAUDE_MODEL_ALIASES[value]) {
    logger.warn(
      { model: value, replacement: CLAUDE_MODEL_ALIASES[value] },
      "Replaced retired Claude model"
    );

    return CLAUDE_MODEL_ALIASES[value];
  }

  if (
    value.includes("latest") ||
    value.includes("3-5-sonnet") ||
    value.includes("3.5-sonnet")
  ) {
    logger.warn(
      { model: value, replacement: DEFAULT_CLAUDE_MODEL },
      "Blocked invalid Claude model"
    );

    return DEFAULT_CLAUDE_MODEL;
  }

  if (!CLAUDE_MODELS.has(value)) {
    logger.warn(
      { model: value, replacement: DEFAULT_CLAUDE_MODEL },
      "Unknown Claude model"
    );

    return DEFAULT_CLAUDE_MODEL;
  }

  return value;
}

function getTextProvider(settings: any): TextAiProvider {
  const configured = String(
    settings.textAiProvider || process.env.TEXT_AI_PROVIDER || "fal"
  ).toLowerCase() as TextAiProvider;

  const claudeKey = String(
    settings.claudeApiKey || process.env.CLAUDE_API_KEY || ""
  ).trim();

  const falKey = String(settings.falKey || process.env.FAL_KEY || "").trim();

  const looksLikeClaudeKey = claudeKey.startsWith("sk-ant-");

  if (configured === "claude" && (!claudeKey || !looksLikeClaudeKey)) {
    if (falKey) {
      logger.warn(
        "Claude selected but Claude API key is missing or invalid, falling back to fal"
      );

      return "fal";
    }

    logger.warn(
      "Claude selected but Claude API key is missing or invalid, falling back to local"
    );

    return "local";
  }

  if (!["claude", "openai", "gemini", "fal", "local"].includes(configured)) {
    logger.warn({ configured }, "Unknown text AI provider, falling back to fal");

    return falKey ? "fal" : "local";
  }

  return configured;
}

function getTextModel(settings: any, provider: TextAiProvider): string {
  if (provider === "claude") {
    const rawModel =
      settings.claudeModel || process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;

    return sanitizeClaudeModel(rawModel);
  }

  if (provider === "openai") {
    return settings.openAiModel || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  if (provider === "gemini") {
    return settings.geminiModel || process.env.GEMINI_MODEL || "gemini-1.5-pro";
  }

  if (provider === "fal") {
    return (
      settings.falTextModel ||
      process.env.FAL_TEXT_MODEL ||
      "anthropic/claude-sonnet-4"
    );
  }

  return "local-template-generator";
}

function getProviderApiKey(settings: any, provider: TextAiProvider): string {
  if (provider === "claude") {
    return settings.claudeApiKey || process.env.CLAUDE_API_KEY || "";
  }

  if (provider === "openai") {
    return settings.openAiApiKey || process.env.OPENAI_API_KEY || "";
  }

  if (provider === "gemini") {
    return settings.geminiApiKey || process.env.GEMINI_API_KEY || "";
  }

  if (provider === "fal") {
    return settings.falKey || process.env.FAL_KEY || "";
  }

  return "local";
}

function parseJsonResponse(raw: string) {
  const cleaned = String(raw || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("AI response was not valid JSON");
  }
}

const NO_DASH_RULE = `
STRICT DASH RULE:
Do not use em dashes, en dashes, dash separators, unicode minus signs, or hyphen bullets anywhere.
Never use this character: —
Never use this character: –
Never use this character: −
Do not write phrases like "Here is the thing — text".
Do not use markdown bullet lines starting with "-".
For sentence breaks, use commas, periods, colons, or semicolons.
For bullet lists in htmlBody, use <ul><li>...</li></ul>.
For bullet lists in textBody, use the bullet character "•".
Do not use dashed section dividers.
`;

function buildPrompt(
  kind: "inactive_email" | "newsletter",
  options: GenerateOptions,
  settings: any
) {
  const count = options.count || 1;

  return `
You are writing marketing content for QuickApply Pro, a job application automation and resume tailoring platform.

Generate ${count} ${
    kind === "newsletter"
      ? "newsletter draft(s)"
      : "inactive user reengagement email draft(s)"
  }.

Audience:
${options.audience || "Job seekers"}

Angle or concept:
${options.angle || "Help users apply faster and with better resumes"}

Custom instructions:
${options.customInstructions || "Use a helpful, practical, conversion focused tone."}

Discount:
${
  options.includeDiscount
    ? "Include the configured discount offer naturally."
    : "Do not include any discount offer."
}

${NO_DASH_RULE}

${buildBrandStylePrompt(settings)}

Return the drafts using the structured return_drafts tool only.

The tool input must match this shape:
{
  "drafts": [
    {
      "title": "Internal draft title",
      "subject": "Email subject line",
      "preheader": "Short inbox preview text",
      "angle": "The angle used",
      "htmlBody": "<html email body>",
      "textBody": "Plain text version",
      "metadata": {
        "contentType": "${kind}"
      }
    }
  ]
}

HTML rules:
1. htmlBody must be usable as an email body.
2. htmlBody must include the QuickApply Pro logo at the top.
3. htmlBody must use the approved QuickApply Pro brand colors only.
4. Do not create random green, purple, orange, red, or gradient palettes.
5. Use inline CSS only.
6. textBody must contain the same message in plain text.
7. Each draft must be meaningfully different.
8. Do not use forbidden dash characters in title, subject, preheader, angle, htmlBody, or textBody.
`;
}

async function callClaude(
  model: string,
  apiKey: string,
  prompt: string,
  settings: any,
  kind: "inactive_email" | "newsletter"
) {
  const safeModel = sanitizeClaudeModel(model);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: safeModel,
    max_tokens: 8192,
    temperature: 0.7,
    tools: [
      {
        name: "return_drafts",
        description: "Return generated email or newsletter drafts as structured data.",
        input_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            drafts: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
                properties: {
                  title: { type: "string" },
                  subject: { type: "string" },
                  preheader: { type: "string" },
                  angle: { type: "string" },
                  htmlBody: { type: "string" },
                  textBody: { type: "string" },
                  metadata: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
                required: [
                  "title",
                  "subject",
                  "preheader",
                  "angle",
                  "htmlBody",
                  "textBody",
                ],
              },
            },
          },
          required: ["drafts"],
        },
      },
    ],
    tool_choice: {
      type: "tool",
      name: "return_drafts",
    },
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  } as any);

  const toolUse = response.content.find(
    (block: any) => block.type === "tool_use" && block.name === "return_drafts"
  ) as any;

  if (!toolUse?.input) {
    throw new Error("Claude did not return structured drafts");
  }

  const parsed = toolUse.input;

  if (!Array.isArray(parsed?.drafts)) {
    throw new Error("Invalid Claude response: missing drafts array");
  }

  return {
    drafts: normalizeGeneratedDrafts(parsed.drafts, settings, kind),
  };
}

async function callOpenAI(
  model: string,
  apiKey: string,
  prompt: string,
  settings: any,
  kind: "inactive_email" | "newsletter"
) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || "OpenAI failed");
  }

  const parsed = parseJsonResponse(data?.choices?.[0]?.message?.content || "");

  if (!Array.isArray(parsed?.drafts)) {
    throw new Error("Invalid OpenAI response: missing drafts array");
  }

  return {
    drafts: normalizeGeneratedDrafts(parsed.drafts, settings, kind),
  };
}

async function callGemini(
  model: string,
  apiKey: string,
  prompt: string,
  settings: any,
  kind: "inactive_email" | "newsletter"
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || "Gemini failed");
  }

  const raw =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
    "";

  const parsed = parseJsonResponse(raw);

  if (!Array.isArray(parsed?.drafts)) {
    throw new Error("Invalid Gemini response: missing drafts array");
  }

  return {
    drafts: normalizeGeneratedDrafts(parsed.drafts, settings, kind),
  };
}

async function callFalText(
  model: string,
  apiKey: string,
  prompt: string,
  settings: any,
  kind: "inactive_email" | "newsletter"
) {
  const resp = await fetch("https://queue.fal.run/fal-ai/any-llm", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(
      data?.detail || data?.message || "fal.ai text generation failed"
    );
  }

  const raw =
    data?.output ||
    data?.text ||
    data?.response ||
    data?.content ||
    data?.data?.output ||
    "";

  if (typeof raw === "string" && raw.trim()) {
    const parsed = parseJsonResponse(raw);

    if (!Array.isArray(parsed?.drafts)) {
      throw new Error("Invalid fal response: missing drafts array");
    }

    return {
      drafts: normalizeGeneratedDrafts(parsed.drafts, settings, kind),
    };
  }

  if (Array.isArray(data?.drafts)) {
    return {
      drafts: normalizeGeneratedDrafts(data.drafts, settings, kind),
    };
  }

  throw new Error("Invalid fal response");
}

function callLocalGenerator(
  kind: "inactive_email" | "newsletter",
  options: GenerateOptions,
  settings: any
) {
  const count = options.count || 1;
  const drafts: GeneratedDraft[] = [];

  for (let i = 1; i <= count; i++) {
    const isNewsletter = kind === "newsletter";

    const title = isNewsletter
      ? `QuickApply Pro Newsletter Draft ${i}`
      : `Inactive User Reengagement Draft ${i}`;

    const subject = isNewsletter
      ? "This week: apply smarter, not harder"
      : "Still job hunting? QuickApply Pro can help";

    const preheader = isNewsletter
      ? "Practical tips to speed up your job search this week."
      : "Your next application can be faster and easier.";

    const safeAngle = sanitizeTextWithoutDashes(options.angle || "");

    const htmlBody = `
      <div>
        <h1>${subject}</h1>
        <p>Hi there,</p>
        <p>${
          isNewsletter
            ? "This week, focus on improving the quality of each application while reducing repetitive work."
            : "We noticed you have not been active recently. QuickApply Pro can help you tailor resumes and apply faster."
        }</p>
        <p>${
          safeAngle
            ? `Focus: ${safeAngle}`
            : "QuickApply Pro helps job seekers move faster with less stress."
        }</p>
        ${
          options.includeDiscount
            ? "<p>Use your available discount to upgrade and save more time.</p>"
            : ""
        }
      </div>
    `.trim();

    const textBody = `
${subject}

Hi there,

${
  isNewsletter
    ? "This week, focus on improving the quality of each application while reducing repetitive work."
    : "We noticed you have not been active recently. QuickApply Pro can help you tailor resumes and apply faster."
}

${
  safeAngle
    ? `Focus: ${safeAngle}`
    : "QuickApply Pro helps job seekers move faster with less stress."
}

${options.includeDiscount ? "Use your available discount to upgrade and save more time." : ""}
`.trim();

    drafts.push(
      normalizeGeneratedDraft(
        {
          title,
          subject,
          preheader,
          angle: safeAngle,
          htmlBody,
          textBody,
          metadata: {
            contentType: kind,
            localFallback: true,
          },
        },
        settings,
        kind
      )
    );
  }

  return {
    drafts,
  };
}

async function callTextProvider(
  provider: TextAiProvider,
  model: string,
  apiKey: string,
  prompt: string,
  kind: "inactive_email" | "newsletter",
  options: GenerateOptions,
  settings: any
): Promise<{ drafts: GeneratedDraft[] }> {
  if (!apiKey && provider !== "local") {
    throw new Error(`${provider} API key missing`);
  }

  if (provider === "claude") return callClaude(model, apiKey, prompt, settings, kind);
  if (provider === "openai") return callOpenAI(model, apiKey, prompt, settings, kind);
  if (provider === "gemini") return callGemini(model, apiKey, prompt, settings, kind);
  if (provider === "fal") return callFalText(model, apiKey, prompt, settings, kind);

  return callLocalGenerator(kind, options, settings);
}

async function generateWithProvider(
  kind: "inactive_email" | "newsletter",
  options: GenerateOptions
): Promise<ProviderResult> {
  const settings = await getSettings();

  const provider = getTextProvider(settings);
  const model = getTextModel(settings, provider);
  const apiKey = getProviderApiKey(settings, provider);
  const prompt = buildPrompt(kind, options, settings);

  const result = await callTextProvider(
    provider,
    model,
    apiKey,
    prompt,
    kind,
    options,
    settings
  );

  return {
    drafts: normalizeGeneratedDrafts(result.drafts || [], settings, kind),
    provider,
    model,
    promptUsed: prompt,
  };
}

export async function generateInactiveEmailDrafts(options: GenerateOptions) {
  return generateWithProvider("inactive_email", options);
}

export async function generateNewsletterDrafts(options: GenerateOptions) {
  return generateWithProvider("newsletter", options);
}

export async function generateBoth(options: GenerateOptions) {
  const [email, newsletter] = await Promise.all([
    generateInactiveEmailDrafts(options),
    generateNewsletterDrafts(options),
  ]);

  return {
    emailDrafts: email.drafts,
    newsletterDrafts: newsletter.drafts,
    provider: email.provider,
    model: email.model,
  };
}

export async function isTextAiConfigured() {
  const settings = await getSettings();

  const provider = getTextProvider(settings);
  const key = getProviderApiKey(settings, provider);

  if (provider === "local") return true;

  return !!key;
}

export async function isFalConfigured() {
  const settings = await getSettings();

  const falKey = String(settings.falKey || process.env.FAL_KEY || "").trim();

  return !!falKey;
}

export async function getActiveAiProvider() {
  const settings = await getSettings();

  const provider = getTextProvider(settings);
  const model = getTextModel(settings, provider);
  const apiKey = getProviderApiKey(settings, provider);

  return {
    provider,
    model,
    configured: provider === "local" ? true : !!apiKey,
    textAiProvider: provider,
    textModel: model,
    falConfigured: await isFalConfigured(),
    textAiConfigured: await isTextAiConfigured(),
  };
}