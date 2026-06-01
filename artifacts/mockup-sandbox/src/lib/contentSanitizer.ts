const DASH_CHARS_REGEX = /[—–−﹘﹣－]/g;

function cleanDashTextPart(value: string): string {
  if (!value) return "";

  return value
    // Convert em dash / en dash / unicode minus to comma.
    .replace(DASH_CHARS_REGEX, ", ")

    // Convert bullet lines that start with dash into real bullet.
    .replace(/(^|\n)\s*-\s+/g, "$1• ")

    // Convert spaced normal dash into comma.
    // Example: "text - text" => "text, text"
    .replace(/\s+-\s+/g, ", ")

    // Remove repeated dash separators.
    .replace(/\s*-{2,}\s*/g, " ")

    // Clean spacing around commas.
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s+/g, ", ")

    // Clean extra spaces but preserve new lines.
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function sanitizeTextWithoutDashes(value: string): string {
  return cleanDashTextPart(value || "");
}

export function sanitizeHtmlWithoutDashes(html: string): string {
  if (!html) return "";

  const withoutStrikeTags = html
    .replace(/<\/?(s|strike|del|u)\b[^>]*>/gi, "")
    .replace(/text-decoration\s*:\s*[^;"']+;?/gi, "")
    .replace(/text-decoration-line\s*:\s*[^;"']+;?/gi, "")
    .replace(/text-decoration-color\s*:\s*[^;"']+;?/gi, "");

  // Only clean text nodes, not HTML tags/attributes.
  return withoutStrikeTags
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) return part;
      return cleanDashTextPart(part);
    })
    .join("");
}

export function sanitizeDraftForNoDashes<T extends Record<string, any>>(draft: T): T {
  return {
    ...draft,
    title: typeof draft.title === "string" ? sanitizeTextWithoutDashes(draft.title) : draft.title,
    subject: typeof draft.subject === "string" ? sanitizeTextWithoutDashes(draft.subject) : draft.subject,
    preheader: typeof draft.preheader === "string" ? sanitizeTextWithoutDashes(draft.preheader) : draft.preheader,
    textBody: typeof draft.textBody === "string" ? sanitizeTextWithoutDashes(draft.textBody) : draft.textBody,
    htmlBody: typeof draft.htmlBody === "string" ? sanitizeHtmlWithoutDashes(draft.htmlBody) : draft.htmlBody,
    angle: typeof draft.angle === "string" ? sanitizeTextWithoutDashes(draft.angle) : draft.angle,
  };
}