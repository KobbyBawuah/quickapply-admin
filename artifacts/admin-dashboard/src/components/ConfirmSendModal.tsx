import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recipientCount: number;
  campaignType: string;
  loading?: boolean;
}

export function ConfirmSendModal({ open, onClose, onConfirm, recipientCount, campaignType, loading }: Props) {
  const [typed, setTyped] = useState("");

  function handleClose() {
    setTyped("");
    onClose();
  }

  function handleConfirm() {
    if (typed !== "SEND") return;
    onConfirm();
    setTyped("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <DialogTitle>Confirm Campaign Send</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            You are about to send the <strong className="text-foreground">{campaignType}</strong> campaign to{" "}
            <strong className="text-foreground">{recipientCount.toLocaleString()} recipient{recipientCount !== 1 ? "s" : ""}</strong>.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-sm text-muted-foreground">
            Type <strong className="text-foreground font-mono">SEND</strong> to confirm:
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="SEND"
            className="font-mono"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && typed === "SEND" && handleConfirm()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={typed !== "SEND" || loading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? "Sending..." : `Send to ${recipientCount.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
