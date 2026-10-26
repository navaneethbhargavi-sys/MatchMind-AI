# MatchMind AI — Copilot instructions

MatchMind AI is a synthetic football intelligence studio. All match data is synthetic and must be labeled as such.

## Architecture
- pnpm workspaces: `artifacts/matchmind-ai` (React/Vite frontend), `artifacts/api-server` (Express API + SSE), `lib/matchmind` (shared data contract).
- Shared data contract lives in `lib/matchmind/src/index.ts`; both artifacts import `@workspace/matchmind`.
- API routes are mounted under `/api` in `artifacts/api-server/src/routes`.

## Conventions
- Keep all generated events synthetic; never imply real match data or live models.
- Label simulated metrics as illustrative; confidence is not calibrated.
- Preserve evidence-to-event traceability.
- Azure services are planned adapters only unless credentials and adapters are implemented.

## Commands
- Typecheck: `pnpm run typecheck`
- Build API: `pnpm --filter @workspace/api-server run build`
- Dev frontend: `pnpm --filter @workspace/matchmind-ai run dev`
- Dev API: `pnpm --filter @workspace/api-server run dev`
