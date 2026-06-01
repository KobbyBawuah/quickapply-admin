const DASH_CHARS_REGEX = /[—–−﹘﹣－]/g;

export interface BrandStyle {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  darkColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  ctaTextColor: string;
  footerText: string;
  websiteUrl: string;
  ctaUrl: string;
}

function cleanHex(value: any, fallback: string): string {
  const raw = String(value || "").trim();

  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return raw.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3");
  }

  return fallback;
}

function cleanUrl(value: any, fallback: string): string {
  const raw = String(value || "").trim();

  if (!raw) return fallback;

  try {
    const url = new URL(raw);

    if (!["http:", "https:"].includes(url.protocol)) return fallback;

    return url.toString();
  } catch {
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtmlDocumentShell(html: string): string {
  const value = String(html || "").trim();

  const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  if (bodyMatch?.[1]) {
    return bodyMatch[1].trim();
  }

  return value
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "")
    .trim();
}

function stripRandomColorStyles(html: string): string {
  return String(html || "")
    .replace(/background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,8}\s*;?/gi, "")
    .replace(/background(?:-color)?\s*:\s*rgb[a]?\([^)]+\)\s*;?/gi, "")
    .replace(/color\s*:\s*#[0-9a-fA-F]{3,8}\s*;?/gi, "")
    .replace(/color\s*:\s*rgb[a]?\([^)]+\)\s*;?/gi, "")
    .replace(/border-color\s*:\s*#[0-9a-fA-F]{3,8}\s*;?/gi, "")
    .replace(/border-color\s*:\s*rgb[a]?\([^)]+\)\s*;?/gi, "");
}

function cleanPlainText(value: string): string {
  if (!value) return "";

  return value
    .replace(DASH_CHARS_REGEX, ", ")
    .replace(/(^|\n)\s*-\s+/g, "$1• ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s*-{2,}\s*/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s+/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function sanitizeTextWithoutDashes(value: string): string {
  return cleanPlainText(value || "");
}

export function sanitizeHtmlWithoutDashes(html: string): string {
  if (!html) return "";

  const cleanedHtml = html
    .replace(/<\/?(s|strike|del|u)\b[^>]*>/gi, "")
    .replace(/text-decoration\s*:\s*[^;"']+;?/gi, "")
    .replace(/text-decoration-line\s*:\s*[^;"']+;?/gi, "")
    .replace(/text-decoration-color\s*:\s*[^;"']+;?/gi, "")
    .replace(/border-bottom\s*:\s*[^;"']+;?/gi, "")
    .replace(/box-shadow\s*:\s*[^;"']+;?/gi, "");

  return cleanedHtml
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) return part;
      return cleanPlainText(part);
    })
    .join("");
}

export function getBrandStyle(settings: any): BrandStyle {
  const websiteUrl = cleanUrl(
    settings?.companyWebsiteUrl || process.env.COMPANY_WEBSITE_URL,
    "https://quickapplypro.com"
  );

  return {
    logoUrl: cleanUrl(
      settings?.brandLogoUrl ||
        settings?.newsletterHeaderImageUrl ||
        process.env.BRAND_LOGO_URL ||
        process.env.NEWSLETTER_HEADER_IMAGE_URL,
      "https://quickapplypro.com/logo.png"
    ),
    primaryColor: cleanHex(
      settings?.newsletterPrimaryColor || process.env.NEWSLETTER_PRIMARY_COLOR,
      "#0B88D5"
    ),
    accentColor: cleanHex(
      settings?.newsletterAccentColor || process.env.NEWSLETTER_ACCENT_COLOR,
      "#48A5DF"
    ),
    darkColor: cleanHex(settings?.brandDarkColor || process.env.BRAND_DARK_COLOR, "#08253A"),
    backgroundColor: cleanHex(
      settings?.newsletterBackgroundColor || process.env.NEWSLETTER_BACKGROUND_COLOR,
      "#F4FAFE"
    ),
    cardColor: "#FFFFFF",
    textColor: "#0F172A",
    mutedTextColor: "#475569",
    borderColor: "#D8ECF8",
    ctaTextColor: "#FFFFFF",
    footerText:
      settings?.newsletterFooterText ||
      process.env.NEWSLETTER_FOOTER_TEXT ||
      "You are receiving this because you signed up for QuickApply Pro.",
    websiteUrl,
    ctaUrl: cleanUrl(settings?.ctaUrl || process.env.CTA_URL, `${websiteUrl}/pricing`),
  };
}

export function buildBrandStylePrompt(settings: any): string {
  const brand = getBrandStyle(settings);

  return `
QUICKAPPLY PRO VISUAL BRAND SYSTEM

Use this exact visual style for every generated htmlBody.

Allowed colors only:
Primary: ${brand.primaryColor}
Accent: ${brand.accentColor}
Dark: ${brand.darkColor}
Background: ${brand.backgroundColor}
Card: ${brand.cardColor}
Text: ${brand.textColor}
Muted text: ${brand.mutedTextColor}
Border: ${brand.borderColor}
CTA text: ${brand.ctaTextColor}

Rules:
1. Do not include the QuickApply Pro logo manually.
2. Do not include an email header manually.
3. Do not include an email footer manually.
4. Do not include unsubscribe text, company address, or signature blocks manually.
5. Do not create a full email document with html, head, body, or outer wrapper tables.
6. Generate only the inner email content: heading, paragraphs, CTA, and short supporting sections.
7. Do not invent random colors.
8. Do not use green, purple, orange, red, gradient, or unrelated palettes unless one of those exact colors is listed above.
9. Use inline CSS only because this is for email.
10. CTA buttons must use the primary color.
11. The system will add the official logo, branded wrapper, CTA button, and footer automatically.
`;
}

function removeLogoImages(html: string): string {
  return String(html || "")
    .replace(/<img\b[^>]*(quickapply|quick-apply|logo)[^>]*>/gi, "")
    .replace(/<img\b(?=[^>]*alt=["'][^"']*(quickapply|quick apply|logo)[^"']*["'])[^>]*>/gi, "");
}

function removeFooterLikeBlocks(html: string): string {
  let cleaned = String(html || "");

  cleaned = cleaned.replace(
    /<p\b[^>]*>[\s\S]*?You are receiving this because[\s\S]*?<\/p>/gi,
    ""
  );

  cleaned = cleaned.replace(
    /<div\b[^>]*>[\s\S]*?You are receiving this because[\s\S]*?<\/div>/gi,
    ""
  );

  cleaned = cleaned.replace(
    /<p\b[^>]*>[\s\S]*?unsubscribe[\s\S]*?<\/p>/gi,
    ""
  );

  cleaned = cleaned.replace(
    /<div\b[^>]*>[\s\S]*?unsubscribe[\s\S]*?<\/div>/gi,
    ""
  );

  cleaned = cleaned.replace(
    /<p\b[^>]*>[\s\S]*?QuickApply Pro by[\s\S]*?<\/p>/gi,
    ""
  );

  cleaned = cleaned.replace(
    /<div\b[^>]*>[\s\S]*?QuickApply Pro by[\s\S]*?<\/div>/gi,
    ""
  );

  cleaned = cleaned.replace(
    /<p\b[^>]*>[\s\S]*?Lightleaps Innovations[\s\S]*?<\/p>/gi,
    ""
  );

  cleaned = cleaned.replace(
    /<div\b[^>]*>[\s\S]*?Lightleaps Innovations[\s\S]*?<\/div>/gi,
    ""
  );

  return cleaned;
}

function removeOuterEmailWrapperTables(html: string): string {
  let cleaned = String(html || "").trim();

  cleaned = cleaned.replace(/<\/?tbody[^>]*>/gi, "");

  const tdMatches = [...cleaned.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];

  if (tdMatches.length >= 2) {
    const scored = tdMatches
      .map((match) => {
        const content = match[1] || "";
        const score =
          content.replace(/<[^>]+>/g, " ").trim().length +
          (/<h1|<h2|<p|<a\b|<ul|<li/i.test(content) ? 500 : 0) -
          (/You are receiving this because|unsubscribe|Lightleaps Innovations/i.test(content) ? 400 : 0) -
          (/<img\b/i.test(content) ? 100 : 0);

        return { content, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scored[0]?.content && scored[0].score > 500) {
      cleaned = scored[0].content;
    }
  }

  cleaned = cleaned
    .replace(/<\/?table\b[^>]*>/gi, "")
    .replace(/<\/?tr\b[^>]*>/gi, "")
    .replace(/<\/?td\b[^>]*>/gi, "");

  return cleaned.trim();
}

function stripGeneratedEmailWrapper(html: string): string {
  let cleaned = stripHtmlDocumentShell(html || "");

  cleaned = removeLogoImages(cleaned);
  cleaned = removeFooterLikeBlocks(cleaned);
  cleaned = removeOuterEmailWrapperTables(cleaned);

  cleaned = cleaned
    .replace(/<div\b[^>]*>\s*<\/div>/gi, "")
    .replace(/<p\b[^>]*>\s*<\/p>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

export function ensureBrandEmailHtml(html: string, settings: any): string {
  const brand = getBrandStyle(settings);
  const sanitizedHtml = sanitizeHtmlWithoutDashes(html || "");
  const inner = stripRandomColorStyles(stripGeneratedEmailWrapper(sanitizedHtml));

  const safeFooter = escapeHtml(brand.footerText);
  const safeWebsiteUrl = escapeHtml(brand.websiteUrl);
  const safeLogoUrl = escapeHtml(brand.logoUrl);
  const safeCtaUrl = escapeHtml(brand.ctaUrl);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuickApply Pro</title>
</head>
<body style="margin:0;padding:0;background:${brand.backgroundColor};font-family:Arial,Helvetica,sans-serif;color:${brand.textColor};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${brand.backgroundColor};margin:0;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:${brand.cardColor};border:1px solid ${brand.borderColor};border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:${brand.cardColor};border-bottom:1px solid ${brand.borderColor};">
              <a href="${safeWebsiteUrl}" target="_blank" style="text-decoration:none;border:0;">
                <img src="${safeLogoUrl}" width="168" alt="QuickApply Pro" style="display:block;width:168px;max-width:168px;height:auto;border:0;outline:none;text-decoration:none;" />
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 28px 26px 28px;color:${brand.textColor};font-size:16px;line-height:1.65;">
              <div style="color:${brand.textColor};font-size:16px;line-height:1.65;">
                ${inner}
              </div>

              <div style="margin-top:28px;">
                <a href="${safeCtaUrl}" target="_blank" style="display:inline-block;background:${brand.primaryColor};color:${brand.ctaTextColor};font-weight:700;font-size:15px;line-height:1;text-decoration:none;padding:15px 22px;border-radius:12px;">
                  Open QuickApply Pro
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px;background:${brand.darkColor};color:#ffffff;">
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#ffffff;">
                ${safeFooter}
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#CDEBFC;">
                QuickApply Pro helps you apply faster with tailored resumes, cover letters, application answers, fraud checks, and interview prep.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ensureBrandTextBody(text: string, settings: any): string {
  const brand = getBrandStyle(settings);
  const clean = sanitizeTextWithoutDashes(text || "");

  const footer = [
    "",
    "QuickApply Pro",
    brand.websiteUrl,
    brand.footerText,
  ]
    .map((line) => sanitizeTextWithoutDashes(line))
    .join("\n");

  if (clean.includes("QuickApply Pro") && clean.includes(brand.websiteUrl)) {
    return clean;
  }

  return `${clean}${footer}`.trim();
}

export function sanitizeDraftForNoDashes<T extends Record<string, any>>(draft: T): T {
  return {
    ...draft,
    title: typeof draft.title === "string" ? sanitizeTextWithoutDashes(draft.title) : draft.title,
    subject: typeof draft.subject === "string" ? sanitizeTextWithoutDashes(draft.subject) : draft.subject,
    preheader: typeof draft.preheader === "string" ? sanitizeTextWithoutDashes(draft.preheader) : draft.preheader,
    angle: typeof draft.angle === "string" ? sanitizeTextWithoutDashes(draft.angle) : draft.angle,
    htmlBody: typeof draft.htmlBody === "string" ? sanitizeHtmlWithoutDashes(draft.htmlBody) : draft.htmlBody,
    textBody: typeof draft.textBody === "string" ? sanitizeTextWithoutDashes(draft.textBody) : draft.textBody,
  };
}

export function applyBrandToDraft<T extends Record<string, any>>(
  draft: T,
  settings: any,
  contentType?: string
): T {
  const cleanDraft = sanitizeDraftForNoDashes(draft || ({} as T));
  const brand = getBrandStyle(settings);

  return {
    ...cleanDraft,
    htmlBody:
      typeof cleanDraft.htmlBody === "string"
        ? ensureBrandEmailHtml(cleanDraft.htmlBody, settings)
        : cleanDraft.htmlBody,
    textBody:
      typeof cleanDraft.textBody === "string"
        ? ensureBrandTextBody(cleanDraft.textBody, settings)
        : cleanDraft.textBody,
    metadata: {
      ...(cleanDraft.metadata || {}),
      contentType: cleanDraft.metadata?.contentType || contentType,
      brandLogoUrl: brand.logoUrl,
      brandPrimaryColor: brand.primaryColor,
      brandAccentColor: brand.accentColor,
      brandApplied: true,
    },
  };
}

export function sanitizeDraftsForNoDashes<T extends Record<string, any>>(drafts: T[]): T[] {
  return (drafts || []).map((draft) => sanitizeDraftForNoDashes(draft));
}