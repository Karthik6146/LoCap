# Repository Rules

## Working conventions
- Read `memory.md`, `tasks.md`, and this file before coding; read `prd.md`, `architecture.md`, or `design.md` when relevant.
- Treat source, package manifests, and Prisma schema as authoritative over older overview text.
- Keep changes scoped to the owning app/package. Preserve public types and existing package boundaries.
- Use strict TypeScript settings from `tsconfig.base.json`; avoid untyped JSON assumptions and keep shared contracts in `packages/types`.
- Keep media transformations non-destructive and use storage abstractions rather than direct backend-specific access.

## Commands
- Install: `npm install`
- Develop: `npm run dev` or `npm run dev:web` / `npm run dev:worker`
- Build: `npm run build`, `npm run build:web`, `npm run build:worker`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (currently meaningful for the web workspace)
- Tests: `npm run test`; focused suites are `npm run test -w @clipx/ai`, `...@clipx/captions`, and `...@clipx/video-engine`.
- Database: `npm run db:setup`, or `db:generate`, `db:migrate`, and `db:seed` separately.
- Optional services: `npm run infra:up` / `npm run infra:down`.

## Testing expectations
- Run the narrowest affected package test and typecheck first, then widen to the root command when practical.
- Add regression coverage for job status transitions, user scoping, storage keys, caption persistence, and media edge cases.
- FFmpeg-dependent tests need FFmpeg/ffprobe available in `PATH` or configured through environment variables.
- Web and worker have typecheck/build scripts. Worker, AI, captions and video-engine define Vitest tests; web has a Playwright smoke script (`npm run test:browser -w @clipx/web`, after the web build).

## Security
- Never commit credentials, API keys, local databases, generated media, or secrets.
- Keep API reads/writes scoped to the authenticated user and preserve the `users/{userId}/` storage-prefix check.
- Use environment variables for database, auth, storage, FFmpeg, AI, billing, and admin settings. `loadEnv` defines defaults; production defaults must be reviewed.
- Authentication is currently demo-user based via `apps/web/lib/session.ts`; do not describe it as production auth.
- Treat uploaded media and provider responses as untrusted input; validate file type/size and avoid shell interpolation around media paths.

## Documentation workflow
- Update `tasks.md` after work and update other knowledge files only when durable facts change.
- Mark incomplete or inferred facts **Unconfirmed** instead of filling gaps with assumptions.
