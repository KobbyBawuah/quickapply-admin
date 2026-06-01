import { useState } from "react";
import {
  useGetTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  usePreviewTemplate,
  getGetTemplatesQueryKey,
  type EmailTemplate,
  type TemplateBody,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Eye, Send } from "lucide-react";
import { toast } from "sonner";

interface TemplateFormData {
  name: string;
  campaignType: "inactive" | "newsletter";
  subject: string;
  htmlBody: string;
  textBody: string;
  angle: string;
  isActive: boolean;
}

const defaultForm: TemplateFormData = {
  name: "",
  campaignType: "inactive",
  subject: "",
  htmlBody: "",
  textBody: "",
  angle: "",
  isActive: true,
};

function TemplateFormDialog({
  open,
  onClose,
  initial,
  templateId,
}: {
  open: boolean;
  onClose: () => void;
  initial?: TemplateFormData;
  templateId?: string;
}) {
  const [form, setForm] = useState<TemplateFormData>(initial ?? defaultForm);
  const qc = useQueryClient();
  const isEdit = !!templateId;

  function set(k: keyof TemplateFormData, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const create = useCreateTemplate({
    mutation: {
      onSuccess() {
        toast.success("Template created");
        qc.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });
        onClose();
      },
      onError(e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); },
    },
  });

  const update = useUpdateTemplate({
    mutation: {
      onSuccess() {
        toast.success("Template updated");
        qc.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });
        onClose();
      },
      onError(e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: TemplateBody = {
      name: form.name,
      campaignType: form.campaignType,
      subject: form.subject,
      htmlBody: form.htmlBody,
      textBody: form.textBody || undefined,
      angle: form.angle || undefined,
      isActive: form.isActive,
    };
    if (isEdit && templateId) {
      update.mutate({ templateId, data: body });
    } else {
      create.mutate({ data: body });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Template Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="e.g., Inactive Win-Back 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Campaign Type</Label>
              <Select value={form.campaignType} onValueChange={(v) => set("campaignType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject Line</Label>
            <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} required placeholder="{{firstName}}, your applications are waiting" />
          </div>
          <div className="space-y-1.5">
            <Label>Angle / Hook (optional)</Label>
            <Input value={form.angle} onChange={(e) => set("angle", e.target.value)} placeholder="FOMO, social proof, tip, etc." />
          </div>
          <div className="space-y-1.5">
            <Label>HTML Body</Label>
            <Textarea
              value={form.htmlBody}
              onChange={(e) => set("htmlBody", e.target.value)}
              required
              rows={10}
              className="font-mono text-xs"
              placeholder="<p>Hi {{firstName}},</p>..."
            />
            <p className="text-xs text-muted-foreground">Variables: {"{{firstName}}"}, {"{{lastName}}"}, {"{{email}}"}, {"{{ctaUrl}}"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Text Body (optional)</Label>
            <Textarea
              value={form.textBody}
              onChange={(e) => set("textBody", e.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder="Plain text fallback"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive", v)}
              id="isActive"
            />
            <Label htmlFor="isActive">Active (used in campaigns)</Label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PreviewModal({
  templateId,
  open,
  onClose,
}: {
  templateId: string;
  open: boolean;
  onClose: () => void;
}) {
  const preview = usePreviewTemplate({
    mutation: {
      onError(e: unknown) { toast.error(e instanceof Error ? e.message : "Preview failed"); },
    },
  });

  const [triggered, setTriggered] = useState(false);
  if (open && !triggered) {
    setTriggered(true);
    preview.mutate({ templateId });
  }
  if (!open && triggered) setTriggered(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template Preview</DialogTitle>
        </DialogHeader>
        {preview.isPending && (
          <div className="h-40 flex items-center justify-center text-muted-foreground">Loading preview...</div>
        )}
        {preview.data && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground border border-border rounded-md px-3 py-2 bg-muted/30">
              Subject: {preview.data.subject}
            </div>
            <div
              className="border border-border rounded-md p-4 bg-white text-sm overflow-auto max-h-[60vh] prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: preview.data.htmlBody }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TemplatesPage() {
  const { data, isLoading } = useGetTemplates({
    query: { queryKey: getGetTemplatesQueryKey() },
  });
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  function handleDelete(t: EmailTemplate) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    fetch(`/api/templates/${t._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("qap_admin_token")}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        toast.success("Template deleted");
        qc.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"));
  }

  function handleSendTest(templateId: string) {
    fetch(`/api/templates/${templateId}/send-test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("qap_admin_token")}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        toast.success("Test email sent to admin");
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"));
  }

  const templates = data?.templates ?? [];

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Email Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => { setEditTemplate(null); setFormOpen(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && templates.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
            No templates yet. Create your first one.
          </div>
        )}

        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t._id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{t.name}</span>
                  <Badge variant={t.campaignType === "inactive" ? "warning" : "info"}>
                    {t.campaignType}
                  </Badge>
                  {t.isActive ? (
                    <Badge variant="success">active</Badge>
                  ) : (
                    <Badge variant="muted">inactive</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  Subject: {t.subject}
                </p>
                {t.angle && (
                  <p className="text-xs text-muted-foreground mt-0.5">Angle: {t.angle}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Created {formatDate(t.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost" size="sm" className="h-8 px-2"
                  onClick={() => setPreviewId(t._id)}
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 px-2"
                  onClick={() => handleSendTest(t._id)}
                  title="Send test email"
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 px-2"
                  onClick={() => { setEditTemplate(t); setFormOpen(true); }}
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(t)}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TemplateFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTemplate(null); }}
        initial={editTemplate ? {
          name: editTemplate.name,
          campaignType: editTemplate.campaignType,
          subject: editTemplate.subject,
          htmlBody: editTemplate.htmlBody,
          textBody: editTemplate.textBody ?? "",
          angle: editTemplate.angle ?? "",
          isActive: editTemplate.isActive ?? true,
        } : undefined}
        templateId={editTemplate?._id}
      />

      {previewId && (
        <PreviewModal
          templateId={previewId}
          open={!!previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </Layout>
  );
}
