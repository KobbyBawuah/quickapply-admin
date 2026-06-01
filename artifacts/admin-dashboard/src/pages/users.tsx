import { useState, useCallback } from "react";
import {
  useGetUsers,
  useGetTemplates,
  useSendEmailToUser,
  useGetUserEmailHistory,
  getGetUsersQueryKey,
  getGetTemplatesQueryKey,
  getGetUserEmailHistoryQueryKey,
  type GetUsersFilter,
  GetUsersFilter as FilterEnum,
  type User,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import {
  Search,
  Mail,
  Ban,
  ChevronLeft,
  ChevronRight,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const FILTERS: { value: GetUsersFilter; label: string }[] = [
  { value: FilterEnum.all, label: "All Users" },
  { value: FilterEnum.active, label: "Active" },
  { value: FilterEnum.inactive7, label: "Inactive 7+ days" },
  { value: FilterEnum.inactive14, label: "Inactive 14+ days" },
  { value: FilterEnum.free, label: "Free" },
  { value: FilterEnum.paid, label: "Paid" },
  { value: FilterEnum.trial, label: "Trial" },
  { value: FilterEnum.expired, label: "Expired" },
  { value: FilterEnum.neverLoggedIn, label: "Never Logged In" },
  { value: FilterEnum.alreadyEmailed, label: "Already Emailed" },
  { value: FilterEnum.notEmailed, label: "Not Emailed" },
  { value: FilterEnum.doNotContact, label: "Do Not Contact" },
];

type ExtendedUser = User & {
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
  emailVerified?: boolean | string;
  isFirstLogin?: boolean;
  subscription?: boolean | string;
  subscriptionPlanName?: string;
  subscriptionStatus?: string;
  plan?: string;
  country?: string;

  answerClicksCount?: number;
  resumeClicksCount?: number;
  coverLetterClicksCount?: number;

  // Your DB has this typo: improvmentClicksCount
  improvmentClicksCount?: number;
  improvementClicksCount?: number;

  resumeGradeClicksCount?: number;
  resumeGradeAiFixClicksCount?: number;
  followUpEmailClicksCount?: number;
  connectionRequestClicksCount?: number;
  scrapeJobUrlClicksCount?: number;
  fraudCheckClicksCount?: number;
  jobRecommendationClicksCount?: number;
  jobRecommendationLoadMoreClicksCount?: number;
  interviewPrepClicksCount?: number;
  interviewSimulationClicksCount?: number;
  uploadJobFileClicksCount?: number;
  jobBookmarkedClicksCount?: number;

  answerClicksCountFree?: number;
  resumeClicksCountFree?: number;
  coverLetterClicksCountFree?: number;
  improvmentClicksCountFree?: number;
  improvementClicksCountFree?: number;
  resumeGradeClicksCountFree?: number;
  resumeGradeAiFixClicksCountFree?: number;
  followUpEmailClicksCountFree?: number;
  connectionRequestClicksCountFree?: number;
  scrapeJobUrlClicksCountFree?: number;
  fraudCheckClicksCountFree?: number;
  uploadJobFileClicksCountFree?: number;

  linkedinProfile?: string;
  linkedInProfile?: string;
  websiteLink?: string;

  textSize?: string;
  fontFamily?: string;
  includeCurrentDate?: boolean;

  defaultResumeTemplate?: string;
  defaultResumeId?: string;
  defaultResumeSource?: string;
  skipTemplateSelection?: boolean;

  hasSeenProductTour?: boolean;
  hasSeenProductTourGenerationModule?: boolean;
  hasSeenResumeProductTour?: boolean;
};

function userName(user?: ExtendedUser | null) {
  if (!user) return "";

  return (
    user.name ||
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.email ||
    "Unknown User"
  );
}

function metric(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

function safeDate(value: unknown) {
  if (!value) return "—";
  return formatDate(value as string);
}

function boolLabel(value: unknown) {
  return value === true || value === "true" ? "Yes" : "No";
}

function getPlan(user: ExtendedUser) {
  return (
    user.subscriptionPlanName ||
    user.plan ||
    (user.subscription === true || user.subscription === "true"
      ? "Paid"
      : "Free")
  );
}

function getSubscriptionStatus(user: ExtendedUser) {
  return (
    user.subscriptionStatus ||
    (user.subscription === true || user.subscription === "true"
      ? "active"
      : "free")
  );
}

function getImproveCount(user: ExtendedUser) {
  return user.improvmentClicksCount ?? user.improvementClicksCount ?? 0;
}

function getLinkedIn(user: ExtendedUser) {
  return user.linkedinProfile || user.linkedInProfile || "";
}

function SendEmailModal({
  user,
  open,
  onClose,
}: {
  user: ExtendedUser | null;
  open: boolean;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState("");

  const { data: templatesData } = useGetTemplates({
    query: {
      enabled: open,
      queryKey: getGetTemplatesQueryKey(),
    },
  });

  const qc = useQueryClient();

  const send = useSendEmailToUser({
    mutation: {
      onSuccess() {
        toast.success(`Email sent to ${user?.email}`);
        qc.invalidateQueries({
          queryKey: getGetUsersQueryKey({}),
        });
        onClose();
        setTemplateId("");
      },
      onError(e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to send");
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Email to {userName(user)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            Recipient:{" "}
            <strong className="text-foreground">{user?.email}</strong>
          </div>

          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a template..." />
            </SelectTrigger>

            <SelectContent>
              {templatesData?.templates.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name} ({t.campaignType})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={!templateId || !user?._id || send.isPending}
              onClick={() =>
                user?._id &&
                send.mutate({
                  userId: user._id,
                  data: { templateId },
                })
              }
            >
              {send.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailHistorySheet({
  user,
  open,
  onClose,
}: {
  user: ExtendedUser | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useGetUserEmailHistory(user?._id ?? "", {
    query: {
      enabled: open && !!user?._id,
      queryKey: getGetUserEmailHistoryQueryKey(user?._id ?? ""),
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Email History, {userName(user)}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          )}

          {!isLoading && (!data?.logs || data.logs.length === 0) && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No emails sent yet
            </div>
          )}

          {data?.logs.map((log) => (
            <div
              key={log._id}
              className="border border-border rounded-lg p-3 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">
                  {log.subject}
                </span>

                <StatusBadge status={log.status} />
              </div>

              <div className="text-xs text-muted-foreground">
                {log.campaignType} · {formatDateTime(log.sentAt)}
              </div>

              {log.errorMessage && (
                <div className="text-xs text-destructive mt-1">
                  {log.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GetUsersFilter>(FilterEnum.all);
  const [page, setPage] = useState(1);
  const [sendUser, setSendUser] = useState<ExtendedUser | null>(null);
  const [historyUser, setHistoryUser] = useState<ExtendedUser | null>(null);

  const qc = useQueryClient();

  const params = {
    search: search || undefined,
    filter,
    page,
    limit: 25,
  };

  const { data, isLoading } = useGetUsers(params, {
    query: {
      queryKey: getGetUsersQueryKey(params),
    },
  });

  const handleMarkDNC = useCallback(
    (userId: string) => {
      if (!confirm("Mark this user as Do Not Contact?")) return;

      fetch(`/api/users/${userId}/do-not-contact`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("qap_admin_token")}`,
        },
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text());

          toast.success("User marked as do-not-contact");

          qc.invalidateQueries({
            queryKey: getGetUsersQueryKey({}),
          });
        })
        .catch((e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Failed")
        );
    },
    [qc]
  );

  const users = (data?.users ?? []) as ExtendedUser[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Users</h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString()} user{total !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
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
            onValueChange={(v) => {
              setFilter(v as GetUsersFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1700px] w-full text-sm">
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
                  [...Array(10)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
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

                {users.map((user) => {
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

                        <div className="text-xs text-muted-foreground">
                          {user.email || "No email"}
                        </div>

                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {(user.emailVerified === true ||
                            user.emailVerified === "true") && (
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

                      <td className="px-4 py-3 text-muted-foreground min-w-40">
                        <div className="text-xs">
                          Active: {safeDate(user.lastLoginAt || user.createdAt)}
                        </div>
                        <div className="text-xs">
                          Joined: {safeDate(user.createdAt)}
                        </div>
                        <div className="text-xs">
                          First login: {user.isFirstLogin ? "Yes" : "No"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {user.daysInactive != null && user.daysInactive >= 0 ? (
                          <span
                            className={cn(
                              "font-mono text-xs",
                              user.daysInactive >= 14
                                ? "text-red-600"
                                : user.daysInactive >= 7
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                            )}
                          >
                            {user.daysInactive}d
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setSendUser(user)}
                            title="Send email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setHistoryUser(user)}
                            title="Email history"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>

                          {!user.doNotContact && user._id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleMarkDNC(user._id!)}
                              title="Mark do-not-contact"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>

              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SendEmailModal
        user={sendUser}
        open={!!sendUser}
        onClose={() => setSendUser(null)}
      />

      <EmailHistorySheet
        user={historyUser}
        open={!!historyUser}
        onClose={() => setHistoryUser(null)}
      />
    </Layout>
  );
}