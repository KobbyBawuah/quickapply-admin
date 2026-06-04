import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { formatDateTime } from "@/lib/utils";
import { apiCall } from "../lib/api";
import {
  Users,
  UserCheck,
  UserX,
  Mail,
  Send,
  AlertCircle,
  Calendar,
  Clock,
  Ban,
  TrendingUp,
} from "lucide-react";

type DashboardStats = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  doNotContactCount: number;
  emailsSentThisWeek: number;
  newsletterEmailsSent: number;
  failedEmails: number;
  campaignRuns?: number;
  lastMondayCampaignStatus?: string;
  nextScheduledCampaign?: string;
  timezone?: string;
};

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color = "blue",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "gray";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-red-50 text-red-600 border-red-100",
    yellow: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-violet-50 text-violet-600 border-violet-100",
    gray: "bg-gray-50 text-gray-600 border-gray-100",
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-4 min-w-0">
      <div
        className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${colors[color]}`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>

        <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>

        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiCall<DashboardStats>("/dashboard/stats"),
    retry: 1,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg p-4 h-24 animate-pulse"
              >
                <div className="h-3 bg-muted rounded w-24 mb-3" />
                <div className="h-7 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-4 sm:p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            Failed to load dashboard:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        </div>
      </Layout>
    );
  }

  const s = stats;

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Campaign & user overview
          </p>
        </div>

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Users
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="Total Users"
              value={s?.totalUsers ?? 0}
              icon={Users}
              color="blue"
            />

            <StatCard
              label="Active Users"
              value={s?.activeUsers ?? 0}
              icon={UserCheck}
              color="green"
              sub="recent activity"
            />

            <StatCard
              label="Inactive Users"
              value={s?.inactiveUsers ?? 0}
              icon={UserX}
              color="yellow"
              sub="7+ days inactive"
            />

            <StatCard
              label="Do Not Contact"
              value={s?.doNotContactCount ?? 0}
              icon={Ban}
              color="gray"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Email Activity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="Sent This Week"
              value={s?.emailsSentThisWeek ?? 0}
              icon={Mail}
              color="blue"
            />

            <StatCard
              label="Newsletter Sent"
              value={s?.newsletterEmailsSent ?? 0}
              icon={Send}
              color="purple"
              sub="all time"
            />

            <StatCard
              label="Failed Emails"
              value={s?.failedEmails ?? 0}
              icon={AlertCircle}
              color="red"
            />

            <StatCard
              label="Campaigns Run"
              value={s?.campaignRuns ?? 0}
              icon={TrendingUp}
              color="green"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Schedule
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Last Monday Campaign
                </p>

                <p className="text-sm font-semibold text-foreground mt-0.5 capitalize">
                  {s?.lastMondayCampaignStatus ?? "No data"}
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Next Scheduled
                </p>

                <p className="text-sm font-semibold text-foreground mt-0.5 break-words">
                  {s?.nextScheduledCampaign
                    ? formatDateTime(s.nextScheduledCampaign)
                    : "See campaign settings"}
                </p>

                <p className="text-xs text-muted-foreground">
                  {s?.timezone ?? "America/New_York"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}