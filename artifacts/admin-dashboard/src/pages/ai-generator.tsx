import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Loader2, Eye, Check, X, Send, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

function getApiBaseUrl() {
  const configuredBase = String(import.meta.env.VITE_API_URL || "").trim();

  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }

  throw new Error(
    "VITE_API_URL is missing. Add it to the admin-dashboard Railway variables and redeploy."
  );
}

async function apiCall(path: string, options?: RequestInit) {
  const token = localStorage.getItem("qap_admin_token");
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  const response = await fetch(`${base}/api${cleanPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  const rawText = await response.text();

  let data: any = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {
      error: rawText || `Request failed with status ${response.status}`,
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        data?.details ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function cleanEmailPreviewHtml(html: string) {
  if (!html) return "";

  return html
    .replace(/<\/?(s|strike|del|u)\b[^>]*>/gi, "")
    .replace(/\scontenteditable="[^"]*"/gi, "")
    .replace(/\sspellcheck="[^"]*"/gi, "")
    .replace(/\sdata-gramm="[^"]*"/gi, "")
    .replace(/\sdata-gramm_editor="[^"]*"/gi, "")
    .replace(/\sdata-enable-grammarly="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*(?:gramm|gr_)[^"]*"/gi, "")
    .replace(/text-decoration\s*:\s*[^;"']+;?/gi, "")
    .replace(/text-decoration-line\s*:\s*[^;"']+;?/gi, "")
    .replace(/text-decoration-color\s*:\s*[^;"']+;?/gi, "")
    .replace(/border-bottom\s*:\s*[^;"']+;?/gi, "")
    .replace(/box-shadow\s*:\s*[^;"']+;?/gi, "")
    .replace(/outline\s*:\s*[^;"']+;?/gi, "");
}

function buildEmailPreviewSrcDoc(html: string) {
  const cleanedHtml = cleanEmailPreviewHtml(html || "");

  const previewCss = `
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        color: #111827;
        -webkit-text-size-adjust: 100%;
      }

      body,
      body * {
        text-decoration: none !important;
        text-decoration-line: none !important;
        text-decoration-color: transparent !important;
        border-bottom: none !important;
        box-shadow: none !important;
        outline: none !important;
      }

      a,
      a:link,
      a:visited,
      a:hover,
      a:active,
      s,
      strike,
      del,
      u {
        text-decoration: none !important;
        text-decoration-line: none !important;
        border-bottom: none !important;
        box-shadow: none !important;
      }

      .grammarly-extension,
      grammarly-desktop-integration,
      gr-main,
      gr-top-zero,
      gr-extension,
      [data-gramm],
      [data-gramm_editor],
      [data-enable-grammarly] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    </style>
  `;

  if (/<html[\s>]/i.test(cleanedHtml)) {
    if (/<head[\s>]/i.test(cleanedHtml)) {
      return cleanedHtml.replace(/<head([^>]*)>/i, `<head$1>${previewCss}`);
    }

    return cleanedHtml.replace(/<html([^>]*)>/i, `<html$1><head>${previewCss}</head>`);
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  ${previewCss}
</head>
<body spellcheck="false" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false">
  ${cleanedHtml}
</body>
</html>`;
}

const AUDIENCES = [
  { value: "inactive_users", label: "Inactive users (7+ days)" },
  { value: "free_users", label: "Free users" },
  { value: "trial_users", label: "Trial users" },
  { value: "expired_users", label: "Expired subscribers" },
  { value: "all_users", label: "All users" },
  { value: "international", label: "International job seekers" },
  { value: "working_professionals", label: "Working professionals" },
  { value: "recent_graduates", label: "Recent graduates" },
];

const ANGLES = [
  { value: "sunday_anxiety", label: "Sunday night application anxiety" },
  { value: "bored_professional", label: "Working professional bored in current role" },
  { value: "hearing_nothing", label: "Applying to many jobs and hearing nothing" },
  { value: "resume_60s", label: "Resume tailoring in under 60 seconds" },
  { value: "chrome_extension", label: "Chrome extension autofill" },
  { value: "interview_prep", label: "Interview prep" },
  { value: "job_fraud", label: "Job fraud/scam detection" },
  { value: "affordable", label: "Affordable vs competitors" },
  { value: "international", label: "International job seekers" },
  { value: "fast_market", label: "Job market is moving fast" },
  { value: "quality_vs_mass", label: "Resume quality vs mass applying" },
];

const CONTENT_TYPES = [
  { value: "inactive_email", label: "Inactive-user re-engagement email" },
  { value: "newsletter", label: "Newsletter" },
  { value: "both", label: "Both (email + newsletter)" },
];

interface Draft {
  _id: string;
  contentType: string;
  title: string;
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
  angle: string;
  status: string;
}

function PreviewModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [tab, setTab] = useState<"html" | "text">("html");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h3 className="font-semibold text-sm">{draft.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Subject: {draft.subject}</p>
          </div>

          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-3">
          <button
            onClick={() => setTab("html")}
            className={`text-xs px-3 py-1 rounded-md font-medium ${
              tab === "html" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            HTML Preview
          </button>

          <button
            onClick={() => setTab("text")}
            className={`text-xs px-3 py-1 rounded-md font-medium ${
              tab === "text" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Plain Text
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {tab === "html" ? (
            <iframe
              srcDoc={buildEmailPreviewSrcDoc(draft.htmlBody || "")}
              sandbox="allow-same-origin"
              className="w-full h-[500px] border border-border rounded-lg bg-white"
              title="Email preview"
            />
          ) : (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg">
              {draft.textBody || "(no plain text version)"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  onApprove,
  onReject,
  onPreview,
  onTest,
}: {
  draft: Draft;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPreview: (draft: Draft) => void;
  onTest: (id: string) => void;
}) {
  const typeColor =
    draft.contentType === "newsletter"
      ? "text-violet-700 bg-violet-50 border-violet-200"
      : "text-amber-700 bg-amber-50 border-amber-200";

  const typeLabel = draft.contentType === "newsletter" ? "Newsletter" : "Email";

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeColor}`}>
              {typeLabel}
            </span>

            {draft.angle && (
              <span className="text-[10px] text-muted-foreground truncate">{draft.angle}</span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-foreground truncate">{draft.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">Subject: {draft.subject}</p>

          {draft.preheader && (
            <p className="text-xs text-muted-foreground/70 truncate">Preview: {draft.preheader}</p>
          )}
        </div>

        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
          Pending
        </span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onPreview(draft)}>
          <Eye className="w-3 h-3" /> Preview
        </Button>

        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onTest(draft._id)}>
          <Send className="w-3 h-3" /> Test
        </Button>

        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => onApprove(draft._id)}
        >
          <Check className="w-3 h-3" /> Approve
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={() => onReject(draft._id)}
        >
          <X className="w-3 h-3" /> Reject
        </Button>
      </div>
    </div>
  );
}

export default function AiGeneratorPage() {
  const [, navigate] = useLocation();

  const [contentType, setContentType] = useState("both");
  const [count, setCount] = useState("2");
  const [audience, setAudience] = useState("inactive_users");
  const [angle, setAngle] = useState("sunday_anxiety");
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeDiscount, setIncludeDiscount] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ emailDrafts: number; newsletterDrafts: number; aiModel: string } | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<Draft[]>([]);
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    setRecentDrafts([]);

    try {
      const data = await apiCall("/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          contentType,
          count: parseInt(count, 10),
          audience: AUDIENCES.find((a) => a.value === audience)?.label || audience,
          angle: ANGLES.find((a) => a.value === angle)?.label || angle,
          customInstructions,
          includeDiscount,
        }),
      });

      setResult({
        emailDrafts: data.emailDrafts || 0,
        newsletterDrafts: data.newsletterDrafts || 0,
        aiModel: data.aiModel || data.aiProvider || "AI",
      });

      toast.success(data.message || "Generation complete");

      const draftsData = await apiCall("/ai/drafts?status=pending_approval&limit=20");
      setRecentDrafts(draftsData.drafts || []);
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setApproving(id);

    try {
      await apiCall(`/ai/drafts/${id}/approve`, { method: "POST" });
      toast.success("Draft approved and added to Approved Templates");
      setRecentDrafts((d) => d.filter((x) => x._id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    } finally {
      setApproving(null);
    }
  }

  async function handleReject(id: string) {
    try {
      await apiCall(`/ai/drafts/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected from generator" }),
      });

      toast.success("Draft rejected");
      setRecentDrafts((d) => d.filter((x) => x._id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    }
  }

  async function handleTest(id: string) {
    setTesting(id);

    try {
      const data = await apiCall(`/ai/drafts/${id}/send-test`, { method: "POST" });
      toast[data.success ? "success" : "error"](data.message || "Test request completed");
    } catch (err: any) {
      toast.error(err.message || "Test send failed");
    } finally {
      setTesting(null);
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              AI Generator
            </h1>

            <p className="text-sm text-muted-foreground mt-0.5">
              Generate email and newsletter drafts using your selected AI provider. Newsletter drafts can include fal.ai-generated graphics. All drafts go to the Approval Queue before use.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate("/ai/queue")} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            View Approval Queue
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Generation Options</h2>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Number of Drafts</Label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "4", "5"].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n} draft{n !== "1" ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email Angle / Concept</Label>
                <Select value={angle} onValueChange={setAngle}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANGLES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Custom Instructions (optional)</Label>
                <Textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Any specific tone, focus area, or requirements..."
                  className="h-20 text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-foreground">Include Discount Code</p>
                  <p className="text-xs text-muted-foreground">From Settings discount fields</p>
                </div>

                <Switch checked={includeDiscount} onCheckedChange={setIncludeDiscount} />
              </div>

              <Button className="w-full gap-2" onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate Now
                  </>
                )}
              </Button>
            </div>

            {result && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                <p className="text-sm font-semibold text-emerald-800">Generation complete</p>
                <p className="text-xs text-emerald-700">
                  {result.emailDrafts} email draft(s) + {result.newsletterDrafts} newsletter draft(s) created
                </p>
                <p className="text-xs text-emerald-600/70">Model: {result.aiModel}</p>
                <p className="text-xs text-emerald-700 mt-1">
                  All drafts are <strong>pending approval</strong> — review them below or in the Approval Queue.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {loading
                  ? "Generating..."
                  : recentDrafts.length > 0
                    ? `Generated Drafts (${recentDrafts.length})`
                    : "Generated drafts will appear here"}
              </h2>
            </div>

            {loading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2 animate-pulse">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!loading && recentDrafts.length === 0 && result === null && (
              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select options and click Generate Now</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  The selected text AI provider will generate drafts based on your settings. Newsletter graphics use fal.ai when enabled. Generation can take 15–60 seconds.
                </p>
              </div>
            )}

            {!loading && recentDrafts.length === 0 && result !== null && (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All drafts approved or rejected</p>
                <Button size="sm" className="mt-3" onClick={() => navigate("/ai/queue")}>
                  Go to Approval Queue
                </Button>
              </div>
            )}

            {recentDrafts.map((draft) => (
              <DraftCard
                key={draft._id}
                draft={draft}
                onApprove={handleApprove}
                onReject={handleReject}
                onPreview={setPreviewDraft}
                onTest={handleTest}
              />
            ))}
          </div>
        </div>
      </div>

      {previewDraft && <PreviewModal draft={previewDraft} onClose={() => setPreviewDraft(null)} />}
    </Layout>
  );
}