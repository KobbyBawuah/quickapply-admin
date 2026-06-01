import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Eye, X, RefreshCw, Send, Archive, BookCheck, Star, Ban, Check, Loader2,
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
    if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
    return data;
  });
}

interface Template {
  _id: string;
  contentType: string;
  title: string;
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
  status: string;
  angle?: string;
  approvedAt?: string;
  usageCount: number;
  lastUsedAt?: string;
  isDefault: boolean;
  createdAt: string;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${type === "newsletter" ? "text-violet-700 bg-violet-50 border-violet-200" : "text-blue-700 bg-blue-50 border-blue-200"}`}>
      {type === "newsletter" ? "Newsletter" : "Email"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "text-emerald-700 bg-emerald-50 border-emerald-200",
    inactive: "text-gray-600 bg-gray-50 border-gray-200",
    archived: "text-red-600 bg-red-50 border-red-200",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${map[status] || "text-gray-600 bg-gray-50"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const [tab, setTab] = useState<"html" | "text">("html");
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TypeBadge type={template.contentType} />
              <StatusBadge status={template.status} />
              {template.isDefault && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Default</span>
              )}
            </div>
            <h3 className="font-semibold text-sm">{template.title}</h3>
            <p className="text-xs text-muted-foreground">Subject: {template.subject}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2 px-5 pt-3 flex-shrink-0">
          {["html", "text"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`text-xs px-3 py-1 rounded-md font-medium ${tab === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {t === "html" ? "HTML Preview" : "Plain Text"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {tab === "html" ? (
            <iframe
              srcDoc={template.htmlBody}
              sandbox="allow-same-origin"
              className="w-full h-[500px] border border-border rounded-lg bg-white"
              title="Template preview"
            />
          ) : (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg h-[500px] overflow-auto">
              {template.textBody || "(no plain text version)"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApprovedTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      let query = `?limit=100`;
      if (contentTypeFilter !== "all") query += `&contentType=${contentTypeFilter}`;
      if (statusFilter !== "all") query += `&status=${statusFilter}`;
      const data = await apiCall(`/approved-templates${query}`);
      setTemplates(data.templates || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [contentTypeFilter, statusFilter]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
  });

  async function action(id: string, endpoint: string, label: string) {
    setActioning(id);
    try {
      await apiCall(`/approved-templates/${id}/${endpoint}`, { method: "POST" });
      toast.success(label);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActioning(null);
    }
  }

  async function handleTest(id: string) {
    setActioning(id);
    try {
      const data = await apiCall(`/approved-templates/${id}/send-test`, { method: "POST" });
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
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BookCheck className="w-5 h-5 text-emerald-500" />
              Approved Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-approved content available for campaigns. Active templates are used by campaign runs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTemplates} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative">
            <Input
              placeholder="Search title or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 h-8 text-xs pl-3"
            />
          </div>
          <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="inactive_email">Inactive Email</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active Email Templates", value: templates.filter((t) => t.contentType === "inactive_email" && t.status === "active").length, color: "text-blue-700" },
            { label: "Active Newsletter Templates", value: templates.filter((t) => t.contentType === "newsletter" && t.status === "active").length, color: "text-violet-700" },
            { label: "Total Usage", value: templates.reduce((s, t) => s + (t.usageCount || 0), 0), color: "text-emerald-700" },
            { label: "Total Templates", value: templates.length, color: "text-foreground" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Template grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-3 animate-pulse">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
            <BookCheck className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No approved templates yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Generate and approve content in the AI Generator to populate this library</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => (
              <div key={template._id} className={`bg-card border rounded-lg p-4 space-y-3 ${template.isDefault ? "border-amber-400 ring-1 ring-amber-400/30" : "border-border"}`}>
                <div className="flex items-start gap-2 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <TypeBadge type={template.contentType} />
                      <StatusBadge status={template.status} />
                      {template.isDefault && (
                        <span className="text-[10px] font-semibold text-amber-700">★ Default</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground truncate">{template.title}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">Subject: {template.subject}</p>
                    {template.angle && <p className="text-xs text-muted-foreground/70 truncate">Angle: {template.angle}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                  <span>Used {template.usageCount || 0}×</span>
                  {template.lastUsedAt && <span>· Last: {new Date(template.lastUsedAt).toLocaleDateString()}</span>}
                  {template.approvedAt && !template.lastUsedAt && <span>· Approved {new Date(template.approvedAt).toLocaleDateString()}</span>}
                </div>

                <div className="flex gap-1.5 flex-wrap pt-1 border-t border-border/50">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPreviewTemplate(template)}>
                    <Eye className="w-3 h-3" /> Preview
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleTest(template._id)} disabled={actioning === template._id}>
                    <Send className="w-3 h-3" /> Test
                  </Button>
                  {!template.isDefault && template.status === "active" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => action(template._id, "set-default", "Set as default")} disabled={actioning === template._id}>
                      <Star className="w-3 h-3" /> Default
                    </Button>
                  )}
                  {template.status === "active" ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-amber-700" onClick={() => action(template._id, "deactivate", "Template deactivated")} disabled={actioning === template._id}>
                      <Ban className="w-3 h-3" /> Deactivate
                    </Button>
                  ) : template.status === "inactive" ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-700" onClick={() => action(template._id, "activate", "Template activated")} disabled={actioning === template._id}>
                      <Check className="w-3 h-3" /> Activate
                    </Button>
                  ) : null}
                  {template.status !== "archived" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => action(template._id, "archive", "Template archived")} disabled={actioning === template._id}>
                      <Archive className="w-3 h-3" /> Archive
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewTemplate && <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />}
    </Layout>
  );
}
