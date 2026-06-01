# Changes made by ChatGPT

## Windows local run fixes

- Removed dependency on Linux `export` in backend dev script by using `cross-env`.
- Updated backend start script to load `artifacts/api-server/.env` using Node `--env-file=.env`.
- Kept root `@esbuild/win32-x64@0.27.3` pin to match `esbuild@0.27.3` on Windows.
- Added `artifacts/api-server/.env.example`.
- Added `WINDOWS_LOCAL_SETUP.md`.

## AI provider upgrade

- Reworked the existing `claudeService.ts` into a provider-based AI generation service while keeping existing imports/routes working.
- Supported text providers:
  - Claude
  - OpenAI
  - Gemini
  - fal.ai Any LLM endpoint (`fal-ai/any-llm`) using the same `FAL_KEY` and `FAL_TEXT_MODEL=anthropic/claude-3.5-sonnet` by default
  - Local fallback templates
- Added fal.ai graphics workflow for newsletters.
- Newsletter generation can now inject fal.ai generated hero/banner images into newsletter HTML.
- Added safer error message when a fal.ai key is accidentally pasted into the Claude API key field.

## Settings upgrade

Added settings support for:

- Text AI Provider
- Claude API key/model
- OpenAI API key/model
- Gemini API key/model
- fal.ai API key
- fal text model
- fal image model
- fal newsletter graphics toggle

Sensitive keys are masked and not returned to the frontend.

## Debug updates

`/api/debug/status` and `/api/debug/test-all` now include provider and fal.ai status checks.

## Recommended setup

Use one fal.ai key for both text and graphics:

```env
TEXT_AI_PROVIDER=fal
FAL_KEY=your_fal_key
FAL_TEXT_MODEL=anthropic/claude-3.5-sonnet
FAL_IMAGE_MODEL=fal-ai/flux/schnell
FAL_NEWSLETTER_GRAPHICS_ENABLED=true
```

This uses `fal-ai/any-llm` for email/newsletter copy and fal image models for newsletter hero/banner images. Claude/OpenAI/Gemini keys are optional fallbacks only.
