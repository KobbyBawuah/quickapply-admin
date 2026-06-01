import { AiContentDraft } from "../models/AiContentDraft.js";
import { logger } from "./logger.js";
import { buildBrandStylePrompt, getBrandStyle } from "./contentSanitizer.js";

function stripHtml(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(baseUrl: string, path: string) {
  try {
    const base = new URL(baseUrl);
    return new URL(path, base.origin).toString();
  } catch {
    return "";
  }
}

async function fetchPageText(url: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "QuickApplyPro-AdminBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn({ url, status: res.status }, "Brand research page fetch failed");
      return "";
    }

    const html = await res.text();

    return stripHtml(html).slice(0, 9000);
  } catch (err) {
    logger.warn({ err, url }, "Brand research page fetch error");
    return "";
  }
}

export async function getWebsiteResearchBrief(companyWebsiteUrl?: string) {
  const websiteUrl = companyWebsiteUrl || "https://quickapplypro.com";

  const urls = [
    websiteUrl,
    normalizeUrl(websiteUrl, "/about-us"),
    normalizeUrl(websiteUrl, "/pricing"),
  ].filter(Boolean);

  const pages = await Promise.all(
    urls.map(async (url) => ({
      url,
      text: await fetchPageText(url),
    }))
  );

  const joined = pages
    .filter((p) => p.text)
    .map((p) => `SOURCE: ${p.url}\n${p.text}`)
    .join("\n\n---\n\n");

  if (!joined.trim()) {
    return {
      usedWebsiteResearch: false,
      websiteResearchUrl: websiteUrl,
      websiteResearchSummary: "",
    };
  }

  return {
    usedWebsiteResearch: true,
    websiteResearchUrl: websiteUrl,
    websiteResearchSummary: joined.slice(0, 18000),
  };
}

export async function getCoveredTopics(limit = 80) {
  const drafts = await AiContentDraft.find({
    status: { $in: ["pending_approval", "approved", "rejected", "archived"] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("contentType title subject preheader angle metadata createdAt")
    .lean();

  return drafts.map((d: any) => {
    const parts = [
      d.contentType,
      d.title,
      d.subject,
      d.preheader,
      d.angle,
      d.metadata?.featureUsed,
      d.metadata?.painPoint,
      d.metadata?.coreIdea,
    ].filter(Boolean);

    return parts.join(" | ");
  });
}

export async function buildBrandGenerationContext(settings: any) {
  const research = await getWebsiteResearchBrief(settings.companyWebsiteUrl);
  const coveredTopics = await getCoveredTopics(100);
  const brand = getBrandStyle(settings);

  const brandNotes = settings.brandNotes || "";

  const systemText = `
QUICKAPPLY PRO BRAND CONTEXT

You are a senior content strategist and creative director for QuickApply Pro, an AI powered job application copilot used by students, graduates, job seekers, and working professionals who feel overwhelmed by today's job market.

Core product:
• Generates tailored resumes and cover letters in under 60 seconds.
• Extracts job requirements automatically.
• Writes clean, intentional answers to company application questions.
• Uses a Chrome extension to autofill long career site forms.
• Saves users hours by reducing repetitive typing and tailoring.
• Helps people apply to dozens of high quality roles per week.
• Prepares users for interviews with AI powered prep tools.
• Supports international job seekers facing unique challenges.
• Includes resume grading, Quick Fix resume improvement, LinkedIn tools, follow up emails, job recommendations, job fraud detection, and interview simulator.

Audience:
• Stressed, burned out, overwhelmed job seekers.
• People getting ghosted or rejected.
• New grads, internationals, and people who feel behind.
• People juggling school, work, and the job search.
• Working professionals making selective career moves.

Voice:
• Raw, human, emotionally grounded.
• Clear, direct, precise.
• No corporate buzzwords.
• No fake urgency.
• No "dream job", "game changer", "transform", "supercharge", "cutting edge", or generic AI hype.
• Never imply QuickApply Pro fabricates credentials. It strengthens what is real.

Current strategic focus:
• Speed and quality together.
• Chrome extension plus web app as one product.
• Trust and fraud detection.
• Social proof and real outcomes.
• Accessibility, free tier, affordable weekly plan, student support.

Brand notes from settings:
${brandNotes || "(none)"}

Visual brand:
Logo URL: ${brand.logoUrl}
Primary color: ${brand.primaryColor}
Accent color: ${brand.accentColor}
Dark color: ${brand.darkColor}
Background color: ${brand.backgroundColor}
CTA URL: ${brand.ctaUrl}

${buildBrandStylePrompt(settings)}

Live website research:
${research.websiteResearchSummary || "(website research unavailable, use stored brand context only)"}

Already covered topics:
${coveredTopics.length ? coveredTopics.map((t, i) => `${i + 1}. ${t}`).join("\n") : "(none found)"}

Strict generation rules:
1. Use the live website research when available.
2. Prioritize real QuickApply Pro features.
3. Do not repeat or closely resemble already covered topics.
4. Avoid duplicate angles, metaphors, and emotional framing.
5. Focus on real job seeker pain, friction, or outcome.
6. Avoid generic AI saves time messaging unless reframed specifically.
7. Keep content production ready and on brand.
8. Every email and newsletter HTML must include the logo URL.
9. Every email and newsletter HTML must use only the approved QuickApply Pro color palette.
10. Never use random color palettes.
`;

  return {
    systemText,
    usedWebsiteResearch: research.usedWebsiteResearch,
    websiteResearchUrl: research.websiteResearchUrl,
    websiteResearchSummary: research.websiteResearchSummary,
    coveredTopicsCount: coveredTopics.length,
    brandLogoUrl: brand.logoUrl,
    brandPrimaryColor: brand.primaryColor,
    brandAccentColor: brand.accentColor,
  };
}