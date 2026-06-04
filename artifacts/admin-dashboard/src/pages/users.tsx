import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { StatusBadge, SubscriptionBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, cn } from "@/lib/utils";
import { apiCall } from "../lib/api";
import {
  Search,
  Ban,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type UserFilter =
  | "all"
  | "active"
  | "inactive7"
  | "inactive14"
  | "free"
  | "paid"
  | "trial"
  | "expired"
  | "neverLoggedIn"
  | "alreadyEmailed"
  | "notEmailed"
  | "doNotContact";

type ExtendedUser = {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;

  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  lastActiveAt?: string | null;

  daysInactive?: number;
  lastEmailSent?: string | null;
  emailStatus?: string;
  doNotContact?: boolean;

  loginFrom?: string;
  language?: string;
  country?: string;

  emailVerified?: boolean | string;
  isFirstLogin?: boolean | string;

  subscription?: boolean | string;
  subscriptionPlanName?: string;
  subscriptionStatus?: string;
  plan?: string;

  answerClicksCount?: number;
  resumeClicksCount?: number;
  coverLetterClicksCount?: number;
  improvmentClicksCount?: number;
  improvementClicksCount?: number;
  resumeGradeClicksCount?: number;
  resumeGradeAiFixClicksCount?: number;
  followUpEmailClicksCount?: number;
  connectionRequestClicksCount?: number;
  scrapeJobUrlClicksCount?: number;
  fraudCheckClicksCount?: number;
  jobRecommendationClicksCount?: number;
  interviewPrepClicksCount?: number;
  uploadJobFileClicksCount?: number;

  linkedinProfile?: string;
  linkedInProfile?: string;
  websiteLink?: string;

  textSize?: string;
  fontFamily?: string;
};

type UsersResponse = {
  users: ExtendedUser[];
  total: number;
  page: number;
  totalPages: number;
};

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "All Users" },
  { value: "active", label: "Active" },
  { value: "inactive7", label: "Inactive 7+ days" },
  { value: "inactive14", label: "Inactive 14+ days" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "trial", label: "Trial" },
  { value: "expired", label: "Expired" },
  { value: "neverLoggedIn", label: "Never Logged In" },
  { value: "alreadyEmailed", label: "Already Emailed" },
  { value: "notEmailed", label: "Not Emailed" },
  { value: "doNotContact", label: "Do Not Contact" },
];

function isTrue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function userName(user?: ExtendedUser | null): string {
  if (!user) return "Unknown User";

  return (
    user.name ||
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.email ||
    "Unknown User"
  );
}

function metric(value: unknown): string {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

function safeDate(value: unknown): string {
  if (!value) return "—";
  return formatDate(value as string);
}

function boolLabel(value: unknown): string {
  return isTrue(value) ? "Yes" : "No";
}

function getPlan(user: ExtendedUser): string {
  return (
    user.subscriptionPlanName ||
    user.plan ||
    (isTrue(user.subscription) ? "Paid" : "Free")
  );
}

function getSubscriptionStatus(user: ExtendedUser): string {
  return user.subscriptionStatus || (isTrue(user.subscription) ? "active" : "free");
}

function getImproveCount(user: ExtendedUser): number {
  return user.improvmentClicksCount ?? user.improvementClicksCount ?? 0;
}

function getLinkedIn(user: ExtendedUser): string {
  return user.linkedinProfile || user.linkedInProfile || "";
}

function getActivityDate(user: ExtendedUser): string | null | undefined {
  return user.lastLoginAt || user.lastActiveAt || user.updatedAt || user.createdAt;
}

function InactiveBadge({ days }: { days?: number }) {
  if (days == null || days < 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span
      className={cn(
        "font-mono text-xs font-medium",
        days >= 14
          ? "text-red-600"
          : days >= 7
            ? "text-amber-600"
            : "text-muted-foreground"
      )}
    >
      {days}d
    </span>
  );
}

function UserMobileCard({
  user,
  onMarkDNC,
}: {
  user: ExtendedUser;
  onMarkDNC: (userId: string) => void;
}) {
  const linkedin = getLinkedIn(user);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground truncate">{userName(user)}</h3>
          <p className="text-xs text-muted-foreground break-all mt-0.5">
            {user.email || "No email"}
          </p>

          <div className="flex gap-1.5 mt-2 flex-wrap">
            {isTrue(user.emailVerified) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified
              </span>
            )}

            {user.loginFrom && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {user.loginFrom}
              </span>
            )}

            {user.language && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {user.language}
              </span>
            )}

            {user.doNotContact && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                DNC
              </span>
            )}
          </div>
        </div>

        {!user.doNotContact && user._id && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
            onClick={() => onMarkDNC(user._id)}
            title="Mark do-not-contact"
          >
            <Ban className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Active</p>
          <p className="font-medium text-foreground">{safeDate(getActivityDate(user))}</p>
        </div>

        <div>
          <p className="text-muted-foreground">Inactive</p>
          <InactiveBadge days={user.daysInactive} />
        </div>

        <div>
          <p className="text-muted-foreground">Joined</p>
          <p className="font-medium text-foreground">{safeDate(user.createdAt)}</p>
        </div>

        <div>
          <p className="text-muted-foreground">Last Email</p>
          <p className="font-medium text-foreground">{safeDate(user.lastEmailSent)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <SubscriptionBadge status={getSubscriptionStatus(user)} />

        <div className="text-xs text-muted-foreground">
          Plan: <span className="text-foreground">{getPlan(user)}</span> · Paid:{" "}
          <span className="text-foreground">{boolLabel(user.subscription)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>Resume: {metric(user.resumeClicksCount)}</div>
        <div>Answers: {metric(user.answerClicksCount)}</div>
        <div>Cover: {metric(user.coverLetterClicksCount)}</div>
        <div>Improve: {metric(getImproveCount(user))}</div>
        <div>AI Fix: {metric(user.resumeGradeAiFixClicksCount)}</div>
        <div>Fraud: {metric(user.fraudCheckClicksCount)}</div>
      </div>

      {(linkedin || user.websiteLink) && (
        <div className="flex gap-3 flex-wrap text-xs">
          {linkedin && (
            <a
              href={linkedin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              LinkedIn <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {user.websiteLink && (
            <a
              href={user.websiteLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Website <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [page, setPage] = useState(1);

  const qc = useQueryClient();

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (filter) {
      params.set("filter", filter);
    }

    params.set("page", String(page));
    params.set("limit", "25");

    return params.toString();
  }, [search, filter, page]);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<UsersResponse, Error>({
    queryKey: ["users", queryString],
    queryFn: () => apiCall<UsersResponse>(`/users?${queryString}`),
    retry: 1,
  });

  async function handleMarkDNC(userId: string) {
    if (!window.confirm("Mark this user as Do Not Contact?")) return;

    try {
      await apiCall(`/users/${userId}/do-not-contact`, {
        method: "POST",
      });

      toast.success("User marked as do-not-contact");

      await qc.invalidateQueries({
        queryKey: ["users"],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update user";
      toast.error(message);
    }
  }

  const users: ExtendedUser[] = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Users</h1>

            <p className="text-sm text-muted-foreground mt-0.5">
              {total.toLocaleString()} user{total !== 1 ? "s" : ""}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 w-full sm:w-auto"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, login source, language, plan..."
              className="pl-9"
            />
          </div>

          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as UserFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-56">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            Failed to load users: {error.message}
          </div>
        )}

        <div className="block lg:hidden space-y-3">
          {isLoading &&
            [...Array(5)].map((_, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-lg p-4 space-y-3 animate-pulse"
              >
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-10 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded" />
                </div>
              </div>
            ))}

          {!isLoading && users.length === 0 && (
            <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
              No users found
            </div>
          )}

          {!isLoading &&
            users.map((user: ExtendedUser) => (
              <UserMobileCard
                key={user._id}
                user={user}
                onMarkDNC={handleMarkDNC}
              />
            ))}
        </div>

        <div className="hidden lg:block bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Name / Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Activity
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Inactive
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Subscription
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Core Usage
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    More Usage
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Profile
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Last Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {isLoading &&
                  [...Array(10)].map((_, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border/50">
                      {[...Array(10)].map((_, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse w-full max-w-24" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!isLoading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No users found
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  users.map((user: ExtendedUser) => {
                    const linkedin = getLinkedIn(user);

                    return (
                      <tr
                        key={user._id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 min-w-64">
                          <div className="font-medium text-foreground">
                            {userName(user)}
                          </div>

                          <div className="text-xs text-muted-foreground break-all">
                            {user.email || "No email"}
                          </div>

                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {isTrue(user.emailVerified) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Verified
                              </span>
                            )}

                            {user.loginFrom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {user.loginFrom}
                              </span>
                            )}

                            {user.language && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                {user.language}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground min-w-44">
                          <div className="text-xs">
                            Active: {safeDate(getActivityDate(user))}
                          </div>

                          <div className="text-xs">
                            Joined: {safeDate(user.createdAt)}
                          </div>

                          <div className="text-xs">
                            First login: {boolLabel(user.isFirstLogin)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <InactiveBadge days={user.daysInactive} />
                        </td>

                        <td className="px-4 py-3 min-w-40">
                          <div className="space-y-1">
                            <SubscriptionBadge
                              status={getSubscriptionStatus(user)}
                            />

                            <div className="text-xs text-muted-foreground">
                              Plan: {getPlan(user)}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Paid: {boolLabel(user.subscription)}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground min-w-48">
                          <div>Resume: {metric(user.resumeClicksCount)}</div>
                          <div>Answers: {metric(user.answerClicksCount)}</div>
                          <div>Cover: {metric(user.coverLetterClicksCount)}</div>
                          <div>Improve: {metric(getImproveCount(user))}</div>
                          <div>Grade: {metric(user.resumeGradeClicksCount)}</div>
                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground min-w-52">
                          <div>
                            AI Fix: {metric(user.resumeGradeAiFixClicksCount)}
                          </div>
                          <div>
                            Follow-up: {metric(user.followUpEmailClicksCount)}
                          </div>
                          <div>
                            Connect: {metric(user.connectionRequestClicksCount)}
                          </div>
                          <div>
                            Scrape Job: {metric(user.scrapeJobUrlClicksCount)}
                          </div>
                          <div>Fraud: {metric(user.fraudCheckClicksCount)}</div>
                          <div>
                            Interview: {metric(user.interviewPrepClicksCount)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs min-w-52">
                          <div className="text-muted-foreground">
                            Country: {user.country || "—"}
                          </div>

                          <div className="text-muted-foreground">
                            Font: {user.fontFamily || "—"}
                          </div>

                          <div className="text-muted-foreground">
                            Text: {user.textSize || "—"}
                          </div>

                          {linkedin && (
                            <a
                              href={linkedin}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                            >
                              LinkedIn <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          {user.websiteLink && (
                            <a
                              href={user.websiteLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline mt-1 ml-2"
                            >
                              Website <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {safeDate(user.lastEmailSent)}
                        </td>

                        <td className="px-4 py-3">
                          {user.doNotContact ? (
                            <span className="text-xs text-destructive font-medium">
                              DNC
                            </span>
                          ) : user.emailStatus ? (
                            <StatusBadge status={user.emailStatus} />
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {!user.doNotContact && user._id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleMarkDNC(user._id)}
                              title="Mark do-not-contact"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 sm:px-0">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} total
            </span>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                }
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}