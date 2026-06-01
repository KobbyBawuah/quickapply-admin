import { useState, useEffect } from "react";
import {
  usePreviewInactiveCampaign,
  useRunInactiveCampaign,
  useGetCampaignRuns,
  getPreviewInactiveCampaignQueryKey,
  getGetCampaignRunsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ConfirmSendModal } from "@/components/ConfirmSendModal";
import { CampaignProgressModal } from "@/components/CampaignProgressModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Play, Clock, Users, RefreshCw, AlertTriangle, Check, BookCheck } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function apiCall(path: string, options?: RequestInit) {
  const token = localStorage.getItem("qap_admin_token");
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return fetch(`${base}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
    return data;
  });
}

export default function InactiveCampaignPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [approvedTemplateCount, setApprovedTemplateCount] = useState<number | null>(null);
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  useEffect(() => {
    apiCall("/approved-templates?contentType=inactive_email&status=active&limit=1")
      .then((d) => setApprovedTemplateCount(d.total ?? d.templates?.length ?? 0))
      .catch(() => setApprovedTemplateCount(0));
  }, []);

  const {
    data: preview,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = usePreviewInactiveCampaign({ query: { queryKey: getPreviewInactiveCampaignQueryKey() } });

  const runsParams = { type: "inactive" as const, limit: 5 };
  const { data: runsData, refetch: refetchRuns } = useGetCampaignRuns(runsParams, {
    query: { queryKey: getGetCampaignRunsQueryKey(runsParams) },
  });

  const run = useRunInactiveCampaign({
    mutation: {
      onSuccess(data) {
        setConfirmOpen(false);
        if (data.runId) setActiveRunId(data.runId);
      },
      onError(e: unknown) {
        toast.error(e instanceof Error ? e.message : "Campaign failed to start");
        setConfirmOpen(false);
      },
    },
  });

  const users = preview?.users ?? [];
  const total = preview?.total ?? 0;
  const lastRun = runsData?.runs?.[0];
  const hasApprovedTemplates = approvedTemplateCount !== null && approvedTemplateCount > 0;
  const templateChecked = approvedTemplateCount !== null;

  function handleProgressComplete(runData: any) {
    if (runData.status === "completed") {
      toast.success(`Campaign complete — sent: ${runData.sentCount}, failed: ${runData.failedCount}, skipped: ${runData.skippedCount}`);
    } else {
      toast.error(`Campaign failed: ${runData.notes || "Unknown error"}`);
    }
    qc.invalidateQueries({ queryKey: getPreviewInactiveCampaignQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCampaignRunsQueryKey(runsParams) });
  }

  function handleProgressDismiss() {
    setActiveRunId(null);
    refetchRuns();
    refetchPreview();
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Inactive User Campaign</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Scheduled every <strong>Monday at 9:00 AM</strong> (America/New_York). Targets users inactive 7+ days.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchPreview()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={run.isPending || !!activeRunId || total === 0 || !hasApprovedTemplates}
              className="gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Run Campaign Now
            </Button>
          </div>
        </div>

        {/* Approved template status */}
        {templateChecked && !hasApprovedTemplates && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">No approved email templates</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Campaign sending requires an approved active inactive-email template. Generate and approve one first.
              </p>
            </div>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 flex-shrink-0 gap-1.5" onClick={() => navigate("/ai/generator")}>
              <BookCheck className="w-3.5 h-3.5" />
              AI Generator
            </Button>
          </div>
        )}

        {templateChecked && hasApprovedTemplates && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5" />
            {approvedTemplateCount} approved email template{approvedTemplateCount !== 1 ? "s" : ""} ready
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Eligible Recipients</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{previewLoading ? "…" : total.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Last Run</p>
              <p className="text-sm font-semibold text-foreground">{lastRun ? formatDateTime(lastRun.startedAt) : "Never"}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Play className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Last Status</p>
              {lastRun ? <StatusBadge status={lastRun.status} className="mt-0.5" /> : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </div>
        </div>

        {/* Preview table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">Preview — Eligible Users</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Showing first {Math.min(users.length, 25)} of {total}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Last Login</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Days Inactive</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Plan</th>
                </tr>
              </thead>
              <tbody>
                {previewLoading && [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))}
                {!previewLoading && users.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No eligible users</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{u.name || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{u.daysInactive ?? "?"}d</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{u.plan || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent runs */}
        {runsData?.runs && runsData.runs.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h2 className="text-sm font-semibold text-foreground">Recent Runs</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Started</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Trigger</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Matched</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Sent</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Failed</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Skipped</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {runsData.runs.map((r) => (
                  <tr key={r._id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(r.startedAt)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{r.triggerType}</td>
                    <td className="px-4 py-3 font-mono">{r.matchedUsers ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-emerald-700">{r.sentCount}</td>
                    <td className="px-4 py-3 font-mono text-red-600">{r.failedCount}</td>
                    <td className="px-4 py-3 font-mono text-amber-700">{r.skippedCount}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmSendModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => run.mutate()}
        recipientCount={total}
        campaignType="Inactive User"
        loading={run.isPending}
      />

      <CampaignProgressModal
        runId={activeRunId}
        campaignType="Inactive User Campaign"
        onComplete={handleProgressComplete}
        onDismiss={handleProgressDismiss}
      />
    </Layout>
  );
}
