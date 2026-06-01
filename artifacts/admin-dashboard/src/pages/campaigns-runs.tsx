import { useState } from "react";
import {
  useGetCampaignRuns,
  getGetCampaignRunsQueryKey,
  type GetCampaignRunsType,
  GetCampaignRunsType as RunTypeEnum,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CampaignRunsPage() {
  const [typeFilter, setTypeFilter] = useState<GetCampaignRunsType | "all">("all");
  const [page, setPage] = useState(1);

  const params = {
    type: typeFilter === "all" ? undefined : typeFilter,
    page,
    limit: 25,
  };
  const { data, isLoading } = useGetCampaignRuns(params, {
    query: { queryKey: getGetCampaignRunsQueryKey(params) },
  });

  const runs = data?.runs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Campaign Run History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total.toLocaleString()} total runs</p>
          </div>
          <Select
            value={typeFilter}
            onValueChange={(v) => { setTypeFilter(v as typeof typeFilter); setPage(1); }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              <SelectItem value={RunTypeEnum.inactive}>Inactive</SelectItem>
              <SelectItem value={RunTypeEnum.newsletter}>Newsletter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Started</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Finished</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matched</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sent</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Failed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Skipped</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && runs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      No campaign runs yet
                    </td>
                  </tr>
                )}
                {runs.map((r) => (
                  <tr key={r._id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(r.startedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.finishedAt ? formatDateTime(r.finishedAt) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-foreground font-medium">{r.campaignType}</span>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{r.triggerType}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{r.matchedUsers ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">{r.sentCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 font-semibold">{r.failedCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">{r.skippedCount}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
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
