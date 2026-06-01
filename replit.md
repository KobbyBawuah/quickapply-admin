# QuickApply Pro Admin Console

Full-stack admin dashboard for managing email campaigns, AI-generated content, and user engagement for the QuickApply Pro platform.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run API server (builds then starts)
- `pnpm --filter @workspace/admin-dashboard run dev` — run frontend
- `pnpm --filter @workspace/db run push` — push DB schema changes (not used — Mongoose auto-creates)
- `pnpm run typecheck` — full typecheck across workspace

**Required env vars (set as secrets):**
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `SESSION_SECRET`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `SENDER_EMAIL`, `REPLY_TO_EMAIL`

**Optional env vars:** `CLAUDE_API_KEY`, `CLAUDE_MODEL`, `MONGO_URI`, `INACTIVE_CAMPAIGN_CRON`, `NEWSLETTER_CAMPAIGN_CRON`, `AI_GENERATION_CRON`, `CRON_TIMEZONE`

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24 | **TypeScript**: 5.9
- **API**: Express 5 + Mongoose (MongoDB Atlas)
- **Frontend**: React + Vite + shadcn/ui + TanStack Query + Wouter
- **AI**: Anthropic Claude (`@anthropic-ai/sdk`) via `claudeService.ts`
- **Email**: Nodemailer (Gmail)
- **Auth**: JWT (stored in `localStorage` key `qap_admin_token`)
- **Scheduling**: node-cron (3 jobs: inactive campaign, newsletter, AI generation)

## Where things live

```
artifacts/
  api-server/src/
    models/         Settings, EmailLog, CampaignRun, EmailTemplate,
                    AiContentDraft, ApprovedContentTemplate, AiGenerationRun
    routes/         auth, settings, users, campaigns, templates, ai,
                    approvedTemplates, emailLogs, debug, health
    lib/            claudeService, campaignService, emailService,
                    cronJobs, auth, mongodb, userQuery, logger
  admin-dashboard/src/
    pages/          dashboard, users, campaigns-inactive, campaigns-newsletter,
                    campaigns-runs, templates, logs, settings,
                    ai-generator, approval-queue, approved-templates
    components/     Layout (sidebar), ConfirmSendModal, CampaignProgressModal,
                    StatusBadge, ui/*
```

## Architecture decisions

- **AI approval gate**: Claude generates drafts → always `pending_approval`. Admin approves → copied to `approved_content_templates`. Campaigns ONLY use approved templates — no fallback.
- **Claude API key security**: stored in MongoDB `app_settings.claudeApiKey`, never returned to frontend. GET `/api/settings` returns `claudeApiKeySet: boolean` only.
- **Campaign enforcement**: `runInactiveCampaign` / `runNewsletterCampaign` fail with a clear error message if no active `ApprovedContentTemplate` exists for that type.
- **Cron schedule**: inactive campaign `0 9 * * 1` (Mon 9am ET), newsletter `0 10 */14 * *`, AI generation `0 8 */2 * *` (every 2 days).
- **Template variables**: `{{firstName}}`, `{{name}}`, `{{daysInactive}}`, `{{plan}}`, `{{ctaUrl}}`, `{{discountCode}}`, `{{discountText}}`, `{{discountUrl}}` — rendered server-side at send time.

## Product

- **Dashboard**: stats overview, recent campaign runs
- **Users**: browse/filter the MongoDB users collection
- **Campaigns**: inactive-user re-engagement + newsletter — manual run + scheduled, with live progress polling
- **AI Content** (new): AI Generator → Approval Queue → Approved Templates pipeline
  - Generate email + newsletter drafts via Claude with configurable audience/angle/instructions
  - Review, edit, preview HTML, send test, approve or reject per draft
  - Approved templates library with activate/deactivate/archive/set-default/send-test
- **Templates**: legacy manual email templates (kept for reference)
- **Email Logs**: full send history
- **Settings**: MongoDB, email, campaign, AI generation, discount, newsletter design

## User preferences

- Brand voice: sharp, confident, direct, practical — never desperate or spammy
- Forbidden words: game-changer, dream job, supercharge, cutting-edge, guaranteed
- Campaigns must NEVER send AI content before human approval

## Gotchas

- Claude API key must be entered in Settings → AI Generation before the generator works
- Campaign Run button is disabled if no approved templates exist for that type
- Newsletter template dropdown in campaign page shows `ApprovedContentTemplate` only (not legacy `EmailTemplate`)
- `getSettings()` bootstraps from env vars on first call if no DB record exists
- Never call `pnpm dev` at workspace root — use `restart_workflow` instead

## Pointers

- pnpm-workspace skill for monorepo structure
- `.local/skills/pnpm-workspace/references/server.md` for route conventions
