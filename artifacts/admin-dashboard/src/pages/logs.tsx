import { useState } from "react";
import {
  useGetEmailLogs,
  getGetEmailLogsQueryKey,
  type GetEmailLogsStatus,
  GetEmailLogsStatus as StatusEnum,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [campaignType, setCampaignType] = useState("all");
  const [status, setStatus] = useState<GetEmailLogsStatus | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const params = {
    search: search || undefined,
    campaignType: campaignType === "all" ? undefined : campaignType,
    status: status === "all" ? undefined : status,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 30,
  };

  const { data, isLoading } = useGetEmailLogs(params, {
    query: { queryKey: getGetEmailLogsQueryKey(params) },
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleExport() {
    const token = localStorage.getItem("qap_admin_token");
    const qs = new URLSearchParams();
    if (campaignType !== "all") qs.set("campaignType", campaignType);
    if (status !== "all") qs.set("status", status);
    if (startDate) qs.set("startDate", startDate);
    if (endDate) qs.set("endDate", endDate);
    if (search) qs.set("search", search);
    // Correct export URL
    const url = `/api/email-logs/export?${qs.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Export failed");
        const blob = await r.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `email-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Export downloaded");
      })
      .catch((e) => toast.error(e.message));
  }

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Email Logs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total.toLocaleString()} log entries</p>
          </div>
          <Button variant="outline" onClick={handleExport} className="gap-1.5">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search email or name..."
              className="pl-9"
            />
          </div>
          <Select value={campaignType} onValueChange={(v) => { setCampaignType(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Campaign Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="test_email">Test Email</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={StatusEnum.sent}>Sent</SelectItem>
              <SelectItem value={StatusEnum.failed}>Failed</SelectItem>
              <SelectItem value={StatusEnum.skipped}>Skipped</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="w-40"
            placeholder="Start date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="w-40"
            placeholder="End date"
          />
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sent At</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Error / Reason</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      No email logs found
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log._id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{log.recipientName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{log.recipientEmail}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{log.campaignType || "—"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="text-foreground truncate block">{log.subject || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(log.sentAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-48">
                      {log.errorMessage || log.skipReason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
