# QuickApply Pro Admin — Windows Local Setup

## 1) Install dependencies

Use pnpm, not npm.

```powershell
cd C:\Users\h3llo\OneDrive\Desktop\quickapply-admin
pnpm install
pnpm rebuild esbuild
```

If esbuild fails on Windows:

```powershell
pnpm add -D @esbuild/win32-x64@0.27.3 -w
pnpm rebuild esbuild
```

## 2) Create backend environment file

Create:

```text
artifacts\api-server\.env
```

Use `artifacts\api-server\.env.example` as reference.

Minimum required:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@quickapplypro.com
ADMIN_PASSWORD=Admin@12345
JWT_SECRET=qap-local-admin-2026-super-secret-9xKp42Lm
MONGO_URI=your_mongodb_uri
MONGO_DB_NAME=qap_demo
USERS_COLLECTION=users
EMAIL_USER=your_gmail@gmail.com
EMAIL_APP_PASSWORD=your_app_password_without_spaces
SENDER_EMAIL=your_gmail@gmail.com
REPLY_TO_EMAIL=your_gmail@gmail.com
TEXT_AI_PROVIDER=fal
CLAUDE_API_KEY=
FAL_KEY=your_fal_key
FAL_IMAGE_MODEL=fal-ai/flux/schnell
FAL_NEWSLETTER_GRAPHICS_ENABLED=true
CRON_TIMEZONE=America/New_York
```

## 3) Run backend

Open terminal 1:

```powershell
cd artifacts\api-server
pnpm dev
```

Expected: backend listens on port `5000`.

## 4) Run frontend

Open terminal 2:

```powershell
cd artifacts\admin-dashboard
pnpm dev
```

Open:

```text
http://localhost:5173
```

## 5) AI provider setup

Settings → AI Generation Settings:

- Text Generation Provider: Claude / OpenAI / Gemini / fal / Local
- fal.ai key can generate email/newsletter copy through `fal-ai/any-llm`.
- The same fal.ai key generates newsletter graphics.
- Do not paste fal key into Claude key field.

Recommended setup:

```text
Text Provider: fal.ai Any LLM
fal.ai Newsletter Graphics: ON
fal Image Model: fal-ai/flux/schnell
```

If you only have a fal.ai key, choose `fal.ai Any LLM text` as Text Provider, set fal Text Model to `anthropic/claude-3.5-sonnet`, and enable fal graphics.
