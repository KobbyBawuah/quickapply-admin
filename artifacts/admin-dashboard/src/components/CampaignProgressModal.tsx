import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Send, AlertCircle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunData {
  runId: string;
  status: "running" | "completed" | "failed";
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  matchedUsers: number;
  message?: string;
  notes?: string;
}

interface CampaignProgressModalProps {
  runId: string | null;
  campaignType: string;
  onComplete: (run: RunData) => void;
  onDismiss: () => void;
}

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      const tick = () => {
        if (startRef.current !== null) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  return elapsed;
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function CampaignProgressModal({
  runId,
  campaignType,
  onComplete,
  onDismiss,
}: CampaignProgressModalProps) {
  const [run, setRun] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDone = run?.status === "completed" || run?.status === "failed";
  const elapsed = useElapsed(!!runId && !isDone);

  const poll = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem("qap_admin_token");
      const r = await fetch(`/api/campaigns/runs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data: RunData = await r.json();
      setRun(data);
      if (data.status === "completed" || data.status === "failed") {
        onComplete(data);
      }
    } catch {
      // network blip — keep polling
    }
  }, [onComplete]);

  useEffect(() => {
    if (!runId) return;
    // Initial fetch immediately
    poll(runId);
    const interval = setInterval(() => poll(runId), 1500);
    return () => clearInterval(interval);
  }, [runId, poll]);

  const processed = (run?.sentCount ?? 0) + (run?.failedCount ?? 0);
  const total = run?.matchedUsers ?? 0;
  const progressPct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  const isRunning = !isDone;
  const isCompleted = run?.status === "completed";
  const isFailed = run?.status === "failed";

  return (
    <Dialog open={!!runId} onOpenChange={(open) => { if (!open && isDone) onDismiss(); }}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => { if (!isDone) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            {isCompleted && <CheckCircle className="w-4 h-4 text-emerald-600" />}
            {isFailed && <XCircle className="w-4 h-4 text-destructive" />}
            {isRunning ? `${campaignType} Running…` : isCompleted ? `${campaignType} Complete` : `${campaignType} Failed`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isRunning
                  ? `Processing ${processed} of ${total || "…"}`
                  : isCompleted
                  ? `Processed ${processed} of ${total}`
                  : "Stopped"}
              </span>
              <span className="font-mono tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isFailed ? "bg-destructive" : isCompleted ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${isRunning && total === 0 ? 8 : progressPct}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
              <Send className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-emerald-700 tabular-nums">{run?.sentCount ?? 0}</p>
              <p className="text-xs text-emerald-600 font-medium">Sent</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
              <AlertCircle className="w-4 h-4 text-red-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-700 tabular-nums">{run?.failedCount ?? 0}</p>
              <p className="text-xs text-red-600 font-medium">Failed</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
              <SkipForward className="w-4 h-4 text-amber-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-amber-700 tabular-nums">{run?.skippedCount ?? 0}</p>
              <p className="text-xs text-amber-600 font-medium">Skipped</p>
            </div>
          </div>

          {/* Elapsed / notes */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            {isRunning && (
              <p>Elapsed: <span className="font-mono">{formatElapsed(elapsed)}</span></p>
            )}
            {isDone && run?.message && (
              <p className={cn("text-sm font-medium", isCompleted ? "text-emerald-700" : "text-destructive")}>
                {run.message}
              </p>
            )}
            {isFailed && run?.notes && (
              <p className="text-destructive">{run.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isRunning && (
              <Button variant="outline" size="sm" onClick={onDismiss}>
                Run in background
              </Button>
            )}
            {isDone && (
              <Button onClick={onDismiss}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
