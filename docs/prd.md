# Product Requirements

## Product
LoCap is an AI video clipper and caption editor. The current package description is: turn long videos into short-form clips. LoCap is the production name.

## Users
- **Primary, inferred:** creators who turn long-form video into short social clips.
- **Secondary, inferred:** teams that need repeatable captions, exports, and brand settings.
- User research, personas, pricing, and plan limits are **Unconfirmed**.

## Current MVP capabilities
- Upload a video, validate it, persist a project/video, and enqueue processing.
- Probe media, extract audio, transcribe word timestamps, generate captions, and render a captioned proxy.
- Request separate AI clip analysis and save draft clip suggestions with scores.
- Cut, reframe, burn captions, and render exports for platform/aspect settings.
- Browse projects, clips, captions, and exports through the web app.
- Support Hinglish/script metadata and provider abstractions for transcription and LLM analysis.

## Requirements
- Preserve source media; video operations are non-destructive.
- Keep user-owned storage keys and database records isolated by user ID.
- Show job progress and terminal status in persistent records.
- Support local development without requiring external services where possible.
- Keep captions editable and exportable through the existing caption/domain APIs.

## Constraints
- Node.js 20+, npm workspaces, TypeScript, Next.js 14, system FFmpeg/ffprobe.
- Local Prisma datasource is SQLite. PostgreSQL/Redis/MinIO are provisioned for infrastructure but are not the local default.
- Authentication is disabled in the current web flow; the seeded demo user is used instead.

## Open questions
- What is the final product name, target customer, pricing, and supported social platforms?
- What production authentication/session design replaces demo-user mode?
- Should clip analysis remain an explicit action or be part of upload processing?
- Which storage, queue, AI providers, quotas, and monitoring are required for production?
- What is the intended editor scope beyond the current caption/project views?
