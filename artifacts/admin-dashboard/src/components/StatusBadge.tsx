import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  if (status === "sent" || status === "completed" || status === "active") {
    return <Badge variant="success" className={className}>{status}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive" className={className}>{status}</Badge>;
  }
  if (status === "skipped" || status === "inactive") {
    return <Badge variant="warning" className={className}>{status}</Badge>;
  }
  if (status === "running") {
    return <Badge variant="info" className={className}>{status}</Badge>;
  }
  return <Badge variant="muted" className={className}>{status}</Badge>;
}

export function SubscriptionBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  if (status === "active" || status === "paid") return <Badge variant="success">{status}</Badge>;
  if (status === "trial") return <Badge variant="info">{status}</Badge>;
  if (status === "expired" || status === "cancelled") return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="muted">{status}</Badge>;
}
