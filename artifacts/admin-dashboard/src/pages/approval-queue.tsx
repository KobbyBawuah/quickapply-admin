import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Eye,
  Check,
  X,
  RefreshCw,
  Loader2,
  Send,
  RotateCcw,
  Archive,
  Pencil,
  ListChecks,
} from "lucide-react";

function apiCall(path: string, options?: RequestInit) {
  const token = localStorage.getItem("qap_admin_token");
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

  return fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed: ${res.status}`);
    }
    return data;
  });
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
  aiModel: string;
  generationSource: string;
  createdAt: string;
  rejectionReason?: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_approval: "text-amber-700 bg-amber-50 border-amber-200",
    approved: "text-emerald-700 bg-emerald-50 border-emerald-200",
    rejected: "text-red-700 bg-red-50 border-red-200",
    archived: "text-gray-600 bg-gray-50 border-gray-200",
    draft: "text-blue-700 bg-blue-50 border-blue-200",
  };

  const labels: Record<string, string> = {
    pending_approval: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    archived: "Archived",
    draft: "Draft",
  };

  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
        map[status] || "text-gray-600 bg-gray-50 border-gray-200"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
        type === "newsletter"
          ? "text-violet-700 bg-violet-50 border-violet-200"
          : "text-blue-700 bg-blue-50 border-blue-200"
      }`}
    >
      {type === "newsletter" ? "Newsletter" : "Email"}
    </span>
  );
}

function PreviewModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [tab, setTab] = useState<"html" | "text">("html");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <TypeBadge type={draft.contentType} />
              <StatusBadge status={draft.status} />
            </div>

            <h3 className="font-semibold text-sm mt-1">{draft.title}</h3>
            <p className="text-xs text-muted-foreground">Subject: {draft.subject}</p>
          </div>

          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-3 flex-shrink-0">
          {["html", "text"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as "html" | "text")}
              className={`text-xs px-3 py-1 rounded-md font-medium ${
                tab === t
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "html" ? "HTML Preview" : "Plain Text"}
            </button>
          ))}
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
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg h-[500px] overflow-auto">
              {draft.textBody || "(no plain text version)"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function EditModal({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: (d: Draft) => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [preheader, setPreheader] = useState(draft.preheader);
  const [htmlBody, setHtmlBody] = useState(draft.htmlBody);
  const [textBody, setTextBody] = useState(draft.textBody);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    try {
      const updated = await apiCall(`/ai/drafts/${draft._id}`, {
        method: "PUT",
        body: JSON.stringify({
          subject,
          preheader,
          htmlBody,
          textBody,
        }),
      });

      toast.success("Draft saved");
      onSaved(updated);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-sm">Edit Draft — {draft.title}</h3>

          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Preheader / Preview Text</Label>
            <Input
              value={preheader}
              onChange={(e) => setPreheader(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">HTML Body</Label>
            <Textarea
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              className="font-mono text-xs h-48 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Plain Text</Label>
            <Textarea
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              className="font-mono text-xs h-24 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>

          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Draft
          </Button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  draft,
  onClose,
  onRejected,
}: {
  draft: Draft;
  onClose: () => void;
  onRejected: (id: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReject() {
    setLoading(true);

    try {
      await apiCall(`/ai/drafts/${draft._id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });

      toast.success("Draft rejected");
      onRejected(draft._id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold text-sm">Reject Draft</h3>

          <button onClick={onClose}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Rejecting:{" "}
            <span className="font-medium text-foreground">{draft.title}</span>
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Rejection Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., tone not right, subject too generic..."
              className="h-20 text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            Reject Draft
          </Button>
        </div>
      </div>
    </div>
  );
}

type TabId = "pending" | "email" | "newsletter" | "rejected" | "approved";

const TABS: { id: TabId; label: string }[] = [
  { id: "pending", label: "All Pending" },
  { id: "email", label: "Email Drafts" },
  { id: "newsletter", label: "Newsletter Drafts" },
  { id: "rejected", label: "Rejected" },
  { id: "approved", label: "Approved Recently" },
];

export default function ApprovalQueuePage() {
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [rejectDraft, setRejectDraft] = useState<Draft | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);

    try {
      let query = "";

      if (activeTab === "pending") {
        query = "?status=pending_approval&limit=50";
      } else if (activeTab === "email") {
        query = "?status=pending_approval&contentType=inactive_email&limit=50";
      } else if (activeTab === "newsletter") {
        query = "?status=pending_approval&contentType=newsletter&limit=50";
      } else if (activeTab === "rejected") {
        query = "?status=rejected&limit=50";
      } else if (activeTab === "approved") {
        query = "?status=approved&limit=50";
      }

      const data = await apiCall(`/ai/drafts${query}`);
      setDrafts(data.drafts || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  async function handleApprove(id: string) {
    setActioning(id);

    try {
      await apiCall(`/ai/drafts/${id}/approve`, { method: "POST" });
      toast.success("Draft approved and added to Approved Templates");
      setDrafts((d) => d.filter((x) => x._id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    } finally {
      setActioning(null);
    }
  }

  async function handleArchive(id: string) {
    setActioning(id);

    try {
      await apiCall(`/ai/drafts/${id}/archive`, { method: "POST" });
      toast.success("Draft archived");
      setDrafts((d) => d.filter((x) => x._id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to archive");
    } finally {
      setActioning(null);
    }
  }

  async function handleRegenerate(id: string) {
    setActioning(id);

    try {
      await apiCall(`/ai/drafts/${id}/regenerate-similar`, {
        method: "POST",
      });

      toast.success("Regenerated a similar draft — pending approval");
      fetchDrafts();
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setActioning(null);
    }
  }

  async function handleTest(id: string) {
    setActioning(id);

    try {
      const data = await apiCall(`/ai/drafts/${id}/send-test`, {
        method: "POST",
      });

      toast[data.success ? "success" : "error"](data.message);
    } catch (err: any) {
      toast.error(err.message || "Test send failed");
    } finally {
      setActioning(null);
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-amber-500" />
              Approval Queue
            </h1>

            <p className="text-sm text-muted-foreground mt-0.5">
              Review AI-generated content before it becomes available for campaigns.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDrafts}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium rounded-t-md transition-colors -mb-px border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg p-4 space-y-3 animate-pulse"
              >
                <div className="h-3 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />

                <div className="flex gap-2 mt-2">
                  <div className="h-7 bg-muted rounded w-16" />
                  <div className="h-7 bg-muted rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
            <ListChecks className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No drafts in this category</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Generate new drafts using the AI Generator
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drafts.map((draft) => (
              <div
                key={draft._id}
                className="bg-card border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <TypeBadge type={draft.contentType} />
                      <StatusBadge status={draft.status} />

                      <span className="text-[10px] text-muted-foreground">
                        {draft.generationSource === "scheduled"
                          ? "⏰ Scheduled"
                          : "✋ Manual"}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {draft.title}
                    </h3>

                    <p className="text-xs text-muted-foreground truncate">
                      Subject: {draft.subject}
                    </p>

                    {draft.angle && (
                      <p className="text-xs text-muted-foreground/70 truncate">
                        Angle: {draft.angle}
                      </p>
                    )}

                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {new Date(draft.createdAt).toLocaleDateString()} ·{" "}
                      {draft.aiModel}
                    </p>

                    {draft.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">
                        Reason: {draft.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setPreviewDraft(draft)}
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </Button>

                  {draft.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setEditDraft(draft)}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleTest(draft._id)}
                    disabled={actioning === draft._id}
                  >
                    <Send className="w-3 h-3" /> Test
                  </Button>

                  {draft.status === "pending_approval" && (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleApprove(draft._id)}
                        disabled={actioning === draft._id}
                      >
                        {actioning === draft._id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => setRejectDraft(draft)}
                        disabled={actioning === draft._id}
                      >
                        <X className="w-3 h-3" /> Reject
                      </Button>
                    </>
                  )}

                  {draft.status === "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleRegenerate(draft._id)}
                      disabled={actioning === draft._id}
                    >
                      {actioning === draft._id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Regenerate
                    </Button>
                  )}

                  {draft.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() => handleArchive(draft._id)}
                      disabled={actioning === draft._id}
                    >
                      <Archive className="w-3 h-3" /> Archive
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewDraft && (
        <PreviewModal
          draft={previewDraft}
          onClose={() => setPreviewDraft(null)}
        />
      )}

      {editDraft && (
        <EditModal
          draft={editDraft}
          onClose={() => setEditDraft(null)}
          onSaved={(updated) =>
            setDrafts((d) =>
              d.map((x) => (x._id === updated._id ? updated : x))
            )
          }
        />
      )}

      {rejectDraft && (
        <RejectModal
          draft={rejectDraft}
          onClose={() => setRejectDraft(null)}
          onRejected={(id) =>
            setDrafts((d) => d.filter((x) => x._id !== id))
          }
        />
      )}
    </Layout>
  );
}