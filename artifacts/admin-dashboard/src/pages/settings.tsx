import { useState, useEffect } from "react";
import type { ElementType, FormEvent, ReactNode } from "react";
import {
  useGetSettings,
  useUpdateSettings,
  useTestMongodbConnection,
  useTestEmailConnection,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save,
  Database,
  Mail,
  CheckCircle,
  XCircle,
  Sparkles,
  Tag,
  Palette,
} from "lucide-react";

interface FormState {
  adminEmail: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  ctaUrl: string;

  mongoUri: string;
  databaseName: string;
  usersCollection: string;

  gmailUser: string;
  gmailPassword: string;
  resendApiKey: string;

  inactiveCampaignEnabled: boolean;
  inactiveDaysThreshold: number;
  newsletterEnabled: boolean;
  newsletterIntervalDays: number;
  maxEmailsPerRun: number;
  delayBetweenEmailsMs: number;

  textAiProvider: string;
  claudeApiKey: string;
  claudeApiKeySet: boolean;
  claudeModel: string;
  openAiApiKey: string;
  openAiApiKeySet: boolean;
  openAiModel: string;
  geminiApiKey: string;
  geminiApiKeySet: boolean;
  geminiModel: string;
  falKey: string;
  falKeySet: boolean;
  falTextModel: string;
  falImageModel: string;
  falGraphicsEnabled: boolean;
  aiAutoGenerationEnabled: boolean;
  aiGenerateIntervalDays: number;
  aiEmailDraftsPerRun: number;
  aiNewsletterDraftsPerRun: number;
  brandNotes: string;

  discountCode: string;
  discountText: string;
  discountUrl: string;
  discountExpiryDate: string;

  companyWebsiteUrl: string;
  brandLogoUrl: string;
  newsletterPrimaryColor: string;
  newsletterAccentColor: string;
  newsletterHeaderImageUrl: string;
  newsletterFooterText: string;
}

const defaultState: FormState = {
  adminEmail: "",
  senderName: "QuickApply Pro",
  senderEmail: "",
  replyToEmail: "",
  ctaUrl: "https://quickapplypro.com/pricing",

  mongoUri: "",
  databaseName: "test",
  usersCollection: "users",

  gmailUser: "",
  gmailPassword: "",
  resendApiKey: "",

  inactiveCampaignEnabled: true,
  inactiveDaysThreshold: 7,
  newsletterEnabled: true,
  newsletterIntervalDays: 14,
  maxEmailsPerRun: 50,
  delayBetweenEmailsMs: 1000,

  textAiProvider: "claude",
  claudeApiKey: "",
  claudeApiKeySet: false,
  claudeModel: "claude-sonnet-4-6",
  openAiApiKey: "",
  openAiApiKeySet: false,
  openAiModel: "gpt-4o-mini",
  geminiApiKey: "",
  geminiApiKeySet: false,
  geminiModel: "gemini-1.5-pro",
  falKey: "",
  falKeySet: false,
  falTextModel: "anthropic/claude-sonnet-4",
  falImageModel: "fal-ai/flux/schnell",
  falGraphicsEnabled: true,
  aiAutoGenerationEnabled: true,
  aiGenerateIntervalDays: 2,
  aiEmailDraftsPerRun: 2,
  aiNewsletterDraftsPerRun: 1,
  brandNotes: "",

  discountCode: "QAP20",
  discountText: "20% off your next upgrade",
  discountUrl: "https://quickapplypro.com/pricing",
  discountExpiryDate: "",

  companyWebsiteUrl: "https://quickapplypro.com",
  brandLogoUrl: "https://quickapplypro.com/logo.png",
  newsletterPrimaryColor: "#0B88D5",
  newsletterAccentColor: "#48A5DF",
  newsletterHeaderImageUrl: "https://quickapplypro.com/logo.png",
  newsletterFooterText:
    "You are receiving this because you signed up for QuickApply Pro.",
};

function Section({
  title,
  icon: Icon,
  children,
  accent,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Icon className={`w-4 h-4 ${accent || "text-primary"}`} />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useGetSettings({
    query: {
      queryKey: getGetSettingsQueryKey(),
    },
  });

  const [form, setForm] = useState<FormState>(defaultState);

  const [mongoTestResult, setMongoTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [emailTestResult, setEmailTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!settings) return;

    const s = settings as any;

    setForm({
      adminEmail: s.adminEmail ?? "",
      senderName: s.senderName ?? "QuickApply Pro",
      senderEmail: s.senderEmail ?? "",
      replyToEmail: s.replyToEmail ?? "",
      ctaUrl: s.ctaUrl ?? "https://quickapplypro.com/pricing",

      mongoUri: s.mongoUri ?? "",
      databaseName: s.databaseName ?? "test",
      usersCollection: s.usersCollection ?? "users",

      gmailUser: "",
      gmailPassword: "",
      resendApiKey: "",

      inactiveCampaignEnabled: s.inactiveCampaignEnabled ?? true,
      inactiveDaysThreshold: s.inactiveDaysThreshold ?? 7,
      newsletterEnabled: s.newsletterEnabled ?? true,
      newsletterIntervalDays: s.newsletterIntervalDays ?? 14,
      maxEmailsPerRun: s.maxEmailsPerRun ?? 50,
      delayBetweenEmailsMs: s.delayBetweenEmailsMs ?? 1000,

      textAiProvider: s.textAiProvider ?? "claude",
      claudeApiKey: "",
      claudeApiKeySet: s.claudeApiKeySet ?? false,
      claudeModel: s.claudeModel ?? "claude-sonnet-4-6",

      openAiApiKey: "",
      openAiApiKeySet: s.openAiApiKeySet ?? false,
      openAiModel: s.openAiModel ?? "gpt-4o-mini",

      geminiApiKey: "",
      geminiApiKeySet: s.geminiApiKeySet ?? false,
      geminiModel: s.geminiModel ?? "gemini-1.5-pro",

      falKey: "",
      falKeySet: s.falKeySet ?? false,
      falTextModel: s.falTextModel ?? "anthropic/claude-sonnet-4",
      falImageModel: s.falImageModel ?? "fal-ai/flux/schnell",
      falGraphicsEnabled: s.falGraphicsEnabled ?? true,

      aiAutoGenerationEnabled: s.aiAutoGenerationEnabled ?? true,
      aiGenerateIntervalDays: s.aiGenerateIntervalDays ?? 2,
      aiEmailDraftsPerRun: s.aiEmailDraftsPerRun ?? 2,
      aiNewsletterDraftsPerRun: s.aiNewsletterDraftsPerRun ?? 1,
      brandNotes: s.brandNotes ?? "",

      discountCode: s.discountCode ?? "QAP20",
      discountText: s.discountText ?? "20% off your next upgrade",
      discountUrl: s.discountUrl ?? "https://quickapplypro.com/pricing",
      discountExpiryDate: s.discountExpiryDate ?? "",

      companyWebsiteUrl: s.companyWebsiteUrl ?? "https://quickapplypro.com",
      brandLogoUrl: s.brandLogoUrl ?? "https://quickapplypro.com/logo.png",
      newsletterPrimaryColor: s.newsletterPrimaryColor ?? "#0B88D5",
      newsletterAccentColor: s.newsletterAccentColor ?? "#48A5DF",
      newsletterHeaderImageUrl:
        s.newsletterHeaderImageUrl ?? "https://quickapplypro.com/logo.png",
      newsletterFooterText:
        s.newsletterFooterText ??
        "You are receiving this because you signed up for QuickApply Pro.",
    });
  }, [settings]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const update = useUpdateSettings({
    mutation: {
      onSuccess() {
        toast.success("Settings saved");
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError(error: unknown) {
        toast.error(error instanceof Error ? error.message : "Save failed");
      },
    },
  });

  const testMongo = useTestMongodbConnection({
    mutation: {
      onSuccess(result) {
        setMongoTestResult({
          success: result.success,
          message: result.message,
        });
        toast[result.success ? "success" : "error"](result.message);
      },
      onError(error: unknown) {
        const message = error instanceof Error ? error.message : "MongoDB test failed";
        setMongoTestResult({
          success: false,
          message,
        });
        toast.error(message);
      },
    },
  });

  const testEmail = useTestEmailConnection({
    mutation: {
      onSuccess(result) {
        const message = (result as { message?: string })?.message ?? "Test email sent";
        setEmailTestResult({
          success: true,
          message,
        });
        toast.success(message);
      },
      onError(error: unknown) {
        const message = error instanceof Error ? error.message : "Email test failed";
        setEmailTestResult({
          success: false,
          message,
        });
        toast.error(message);
      },
    },
  });

  function handleSave(event: FormEvent) {
    event.preventDefault();

    const body: Record<string, unknown> = {
      adminEmail: form.adminEmail || undefined,
      senderName: form.senderName || undefined,
      senderEmail: form.senderEmail || undefined,
      replyToEmail: form.replyToEmail || undefined,
      ctaUrl: form.ctaUrl || undefined,

      mongoUri: form.mongoUri || undefined,
      databaseName: form.databaseName || undefined,
      usersCollection: form.usersCollection || undefined,

      inactiveCampaignEnabled: form.inactiveCampaignEnabled,
      inactiveDaysThreshold: form.inactiveDaysThreshold,
      newsletterEnabled: form.newsletterEnabled,
      newsletterIntervalDays: form.newsletterIntervalDays,
      maxEmailsPerRun: form.maxEmailsPerRun,
      delayBetweenEmailsMs: form.delayBetweenEmailsMs,

      textAiProvider: form.textAiProvider,
      claudeModel: form.claudeModel,
      openAiModel: form.openAiModel,
      geminiModel: form.geminiModel,
      falTextModel: form.falTextModel,
      falImageModel: form.falImageModel,
      falGraphicsEnabled: form.falGraphicsEnabled,
      aiAutoGenerationEnabled: form.aiAutoGenerationEnabled,
      aiGenerateIntervalDays: form.aiGenerateIntervalDays,
      aiEmailDraftsPerRun: form.aiEmailDraftsPerRun,
      aiNewsletterDraftsPerRun: form.aiNewsletterDraftsPerRun,
      brandNotes: form.brandNotes,

      discountCode: form.discountCode,
      discountText: form.discountText,
      discountUrl: form.discountUrl,
      discountExpiryDate: form.discountExpiryDate,

      companyWebsiteUrl: form.companyWebsiteUrl,
      brandLogoUrl: form.brandLogoUrl,
      newsletterPrimaryColor: form.newsletterPrimaryColor,
      newsletterAccentColor: form.newsletterAccentColor,
      newsletterHeaderImageUrl: form.newsletterHeaderImageUrl,
      newsletterFooterText: form.newsletterFooterText,
    };

    if (form.gmailUser.trim()) body.gmailUser = form.gmailUser.trim();
    if (form.gmailPassword.trim()) body.gmailPassword = form.gmailPassword.trim();
    if (form.resendApiKey.trim()) body.resendApiKey = form.resendApiKey.trim();

    if (form.claudeApiKey.trim()) body.claudeApiKey = form.claudeApiKey.trim();
    if (form.openAiApiKey.trim()) body.openAiApiKey = form.openAiApiKey.trim();
    if (form.geminiApiKey.trim()) body.geminiApiKey = form.geminiApiKey.trim();
    if (form.falKey.trim()) body.falKey = form.falKey.trim();

    update.mutate({ data: body as any });
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={handleSave}>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Campaign, email, and AI generation configuration
              </p>
            </div>

            <Button type="submit" disabled={update.isPending} className="gap-1.5">
              <Save className="w-4 h-4" />
              {update.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>

          <Section title="MongoDB Connection" icon={Database}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="MongoDB URI">
                  <Input
                    type="password"
                    value={form.mongoUri}
                    onChange={(event) => set("mongoUri", event.target.value)}
                    placeholder="mongodb+srv://..."
                    className="font-mono text-xs"
                  />
                </Field>
              </div>

              <Field label="Database Name">
                <Input
                  value={form.databaseName}
                  onChange={(event) => set("databaseName", event.target.value)}
                  placeholder="test"
                />
              </Field>

              <Field label="Users Collection">
                <Input
                  value={form.usersCollection}
                  onChange={(event) => set("usersCollection", event.target.value)}
                  placeholder="users"
                />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  testMongo.mutate({
                    data: {
                      mongoUri: form.mongoUri,
                      databaseName: form.databaseName || undefined,
                      usersCollection: form.usersCollection || undefined,
                    },
                  })
                }
                disabled={!form.mongoUri || testMongo.isPending}
              >
                {testMongo.isPending ? "Testing..." : "Test Connection"}
              </Button>

              {mongoTestResult && (
                <div
                  className={`flex items-center gap-1.5 text-sm ${
                    mongoTestResult.success ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {mongoTestResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {mongoTestResult.message}
                </div>
              )}
            </div>
          </Section>

          <Section title="Email Configuration" icon={Mail}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Admin Email (receives test emails)">
                <Input
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => set("adminEmail", event.target.value)}
                  placeholder="admin@company.com"
                />
              </Field>

              <Field label="Sender Name">
                <Input
                  value={form.senderName}
                  onChange={(event) => set("senderName", event.target.value)}
                  placeholder="QuickApply Pro"
                />
              </Field>

              <Field label="Sender Email">
                <Input
                  type="email"
                  value={form.senderEmail}
                  onChange={(event) => set("senderEmail", event.target.value)}
                  placeholder="noreply@company.com"
                />
              </Field>

              <Field label="Reply-To Email">
                <Input
                  type="email"
                  value={form.replyToEmail}
                  onChange={(event) => set("replyToEmail", event.target.value)}
                  placeholder="support@company.com"
                />
              </Field>

              <Field label="CTA URL">
                <Input
                  value={form.ctaUrl}
                  onChange={(event) => set("ctaUrl", event.target.value)}
                  placeholder="https://quickapplypro.com/pricing"
                />
              </Field>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Gmail / Nodemailer (leave blank to keep current)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Gmail Address">
                  <Input
                    type="email"
                    value={form.gmailUser}
                    onChange={(event) => set("gmailUser", event.target.value)}
                    placeholder="Leave blank to keep saved value"
                  />
                </Field>

                <Field label="Gmail App Password">
                  <Input
                    type="password"
                    value={form.gmailPassword}
                    onChange={(event) => set("gmailPassword", event.target.value)}
                    placeholder="Leave blank to keep saved value"
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => testEmail.mutate()}
                disabled={testEmail.isPending}
              >
                {testEmail.isPending ? "Sending..." : "Send Test Email"}
              </Button>

              {emailTestResult && (
                <div
                  className={`flex items-center gap-1.5 text-sm ${
                    emailTestResult.success ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {emailTestResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {emailTestResult.message}
                </div>
              )}
            </div>
          </Section>

          <Section title="Campaign Settings" icon={Mail}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div>
                  <p className="text-sm font-medium">Inactive Campaign</p>
                  <p className="text-xs text-muted-foreground">
                    Every Monday at 9am ET
                  </p>
                </div>

                <Switch
                  checked={form.inactiveCampaignEnabled}
                  onCheckedChange={(value) => set("inactiveCampaignEnabled", value)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div>
                  <p className="text-sm font-medium">Newsletter Campaign</p>
                  <p className="text-xs text-muted-foreground">
                    Every {form.newsletterIntervalDays} days
                  </p>
                </div>

                <Switch
                  checked={form.newsletterEnabled}
                  onCheckedChange={(value) => set("newsletterEnabled", value)}
                />
              </div>

              <Field label={`Inactive threshold (days): ${form.inactiveDaysThreshold}`}>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={form.inactiveDaysThreshold}
                  onChange={(event) =>
                    set("inactiveDaysThreshold", Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
              </Field>

              <Field label={`Newsletter interval (days): ${form.newsletterIntervalDays}`}>
                <input
                  type="range"
                  min={7}
                  max={60}
                  step={1}
                  value={form.newsletterIntervalDays}
                  onChange={(event) =>
                    set("newsletterIntervalDays", Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
              </Field>

              <Field label="Max Emails Per Run">
                <Input
                  type="number"
                  value={form.maxEmailsPerRun}
                  onChange={(event) => set("maxEmailsPerRun", Number(event.target.value))}
                  min={1}
                  max={1000}
                />
              </Field>

              <Field label="Delay Between Emails (ms)">
                <Input
                  type="number"
                  value={form.delayBetweenEmailsMs}
                  onChange={(event) =>
                    set("delayBetweenEmailsMs", Number(event.target.value))
                  }
                  min={0}
                  step={100}
                />
              </Field>
            </div>
          </Section>

          <Section title="AI Generation Settings" icon={Sparkles} accent="text-violet-500">
            <div className="bg-violet-50/50 border border-violet-100 rounded-lg p-3 text-xs text-violet-700 mb-2">
              API keys are stored securely and never exposed. Leave key fields blank
              to keep existing keys.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Text Generation Provider">
                <Select
                  value={form.textAiProvider}
                  onValueChange={(value) => set("textAiProvider", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="fal">fal.ai Any LLM text</SelectItem>
                    <SelectItem value="local">Local fallback templates</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex items-center justify-between py-2 border border-border rounded-lg px-3">
                <div>
                  <p className="text-sm font-medium">fal.ai Newsletter Graphics</p>
                  <p className="text-xs text-muted-foreground">
                    Generate hero/banner images for newsletter drafts
                  </p>
                </div>

                <Switch
                  checked={form.falGraphicsEnabled}
                  onCheckedChange={(value) => set("falGraphicsEnabled", value)}
                />
              </div>

              <Field
                label={`Claude API Key ${
                  form.claudeApiKeySet ? "(currently set ✓)" : "(not set)"
                }`}
                hint="Do not paste fal.ai key here."
              >
                <Input
                  type="password"
                  value={form.claudeApiKey}
                  onChange={(event) => set("claudeApiKey", event.target.value)}
                  placeholder={
                    form.claudeApiKeySet
                      ? "••••••••••••••••••• (saved)"
                      : "sk-ant-..."
                  }
                  className="font-mono text-xs"
                />
              </Field>

              <Field label="Claude Model">
                <Input
                  value={form.claudeModel}
                  onChange={(event) => set("claudeModel", event.target.value)}
                  placeholder="claude-sonnet-4-6"
                />
              </Field>

              <Field
                label={`OpenAI API Key ${
                  form.openAiApiKeySet ? "(currently set ✓)" : "(not set)"
                }`}
              >
                <Input
                  type="password"
                  value={form.openAiApiKey}
                  onChange={(event) => set("openAiApiKey", event.target.value)}
                  placeholder={
                    form.openAiApiKeySet
                      ? "••••••••••••••••••• (saved)"
                      : "sk-..."
                  }
                  className="font-mono text-xs"
                />
              </Field>

              <Field label="OpenAI Model">
                <Input
                  value={form.openAiModel}
                  onChange={(event) => set("openAiModel", event.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </Field>

              <Field
                label={`Gemini API Key ${
                  form.geminiApiKeySet ? "(currently set ✓)" : "(not set)"
                }`}
              >
                <Input
                  type="password"
                  value={form.geminiApiKey}
                  onChange={(event) => set("geminiApiKey", event.target.value)}
                  placeholder={
                    form.geminiApiKeySet
                      ? "••••••••••••••••••• (saved)"
                      : "AIza..."
                  }
                  className="font-mono text-xs"
                />
              </Field>

              <Field label="Gemini Model">
                <Input
                  value={form.geminiModel}
                  onChange={(event) => set("geminiModel", event.target.value)}
                  placeholder="gemini-1.5-pro"
                />
              </Field>

              <Field
                label={`fal.ai API Key ${
                  form.falKeySet ? "(currently set ✓)" : "(not set)"
                }`}
              >
                <Input
                  type="password"
                  value={form.falKey}
                  onChange={(event) => set("falKey", event.target.value)}
                  placeholder={
                    form.falKeySet ? "••••••••••••••••••• (saved)" : "fal key"
                  }
                  className="font-mono text-xs"
                />
              </Field>

              <Field label="fal Image Model">
                <Input
                  value={form.falImageModel}
                  onChange={(event) => set("falImageModel", event.target.value)}
                  placeholder="fal-ai/flux/schnell"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="fal Text Model">
                  <Input
                    value={form.falTextModel}
                    onChange={(event) => set("falTextModel", event.target.value)}
                    placeholder="anthropic/claude-sonnet-4"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between py-2 border border-border rounded-lg px-3">
                <div>
                  <p className="text-sm font-medium">
                    Auto-Generate Every {form.aiGenerateIntervalDays} Days
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Creates pending drafts only
                  </p>
                </div>

                <Switch
                  checked={form.aiAutoGenerationEnabled}
                  onCheckedChange={(value) => set("aiAutoGenerationEnabled", value)}
                />
              </div>

              <Field label={`Auto-generation interval (days): ${form.aiGenerateIntervalDays}`}>
                <input
                  type="range"
                  min={1}
                  max={14}
                  step={1}
                  value={form.aiGenerateIntervalDays}
                  onChange={(event) =>
                    set("aiGenerateIntervalDays", Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
              </Field>

              <Field label="Email Drafts Per Auto-Run">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.aiEmailDraftsPerRun}
                  onChange={(event) =>
                    set("aiEmailDraftsPerRun", Number(event.target.value))
                  }
                />
              </Field>

              <Field label="Newsletter Drafts Per Auto-Run">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.aiNewsletterDraftsPerRun}
                  onChange={(event) =>
                    set("aiNewsletterDraftsPerRun", Number(event.target.value))
                  }
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Brand Notes / Extra Instructions">
                  <Textarea
                    value={form.brandNotes}
                    onChange={(event) => set("brandNotes", event.target.value)}
                    placeholder="Brand voice, style preferences, things to avoid..."
                    className="h-20 text-sm resize-none"
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Discount & Offer Settings" icon={Tag} accent="text-amber-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Discount Code">
                <Input
                  value={form.discountCode}
                  onChange={(event) => set("discountCode", event.target.value)}
                  placeholder="QAP20"
                />
              </Field>

              <Field label="Discount Text / Description">
                <Input
                  value={form.discountText}
                  onChange={(event) => set("discountText", event.target.value)}
                  placeholder="20% off your next upgrade"
                />
              </Field>

              <Field label="Discount URL">
                <Input
                  value={form.discountUrl}
                  onChange={(event) => set("discountUrl", event.target.value)}
                  placeholder="https://quickapplypro.com/pricing"
                />
              </Field>

              <Field label="Discount Expiry Date">
                <Input
                  type="date"
                  value={form.discountExpiryDate}
                  onChange={(event) => set("discountExpiryDate", event.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Newsletter Design Settings" icon={Palette} accent="text-blue-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Primary Color" hint="Used for header background and CTA button">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.newsletterPrimaryColor}
                    onChange={(event) =>
                      set("newsletterPrimaryColor", event.target.value)
                    }
                    className="h-9 w-12 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={form.newsletterPrimaryColor}
                    onChange={(event) =>
                      set("newsletterPrimaryColor", event.target.value)
                    }
                    placeholder="#0B88D5"
                    className="font-mono text-xs flex-1"
                  />
                </div>
              </Field>

              <Field label="Accent Color" hint="Used for highlights and subtle sections">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.newsletterAccentColor}
                    onChange={(event) =>
                      set("newsletterAccentColor", event.target.value)
                    }
                    className="h-9 w-12 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={form.newsletterAccentColor}
                    onChange={(event) =>
                      set("newsletterAccentColor", event.target.value)
                    }
                    placeholder="#48A5DF"
                    className="font-mono text-xs flex-1"
                  />
                </div>
              </Field>

              <Field label="Company Website URL">
                <Input
                  value={form.companyWebsiteUrl}
                  onChange={(event) => set("companyWebsiteUrl", event.target.value)}
                  placeholder="https://quickapplypro.com"
                />
              </Field>

              <Field
                label="Brand Logo URL"
                hint="Public HTTPS logo URL. This should appear in generated emails and newsletters."
              >
                <Input
                  value={form.brandLogoUrl}
                  onChange={(event) => set("brandLogoUrl", event.target.value)}
                  placeholder="https://quickapplypro.com/logo.png"
                />
              </Field>

              <Field label="Header Image URL">
                <Input
                  value={form.newsletterHeaderImageUrl}
                  onChange={(event) =>
                    set("newsletterHeaderImageUrl", event.target.value)
                  }
                  placeholder="https://quickapplypro.com/logo.png"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Newsletter Footer Text">
                  <Textarea
                    value={form.newsletterFooterText}
                    onChange={(event) =>
                      set("newsletterFooterText", event.target.value)
                    }
                    placeholder="You are receiving this because you signed up for QuickApply Pro."
                    className="h-16 text-sm resize-none"
                  />
                </Field>
              </div>
            </div>
          </Section>
        </div>
      </form>
    </Layout>
  );
}