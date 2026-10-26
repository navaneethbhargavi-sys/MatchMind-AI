# MatchMind AI — Project Pitch

## Elevator pitch (short version, ~30 seconds)

> **MatchMind AI** turns synthetic, football-realistic match events into explainable match intelligence in real time. A server-side event engine ingests football-realistic event streams, a tactical engine classifies the match into explainable states — Control, Pressure, Chaos, Swing — and a multi-agent AI layer turns those events into live narratives, automated recaps, and a conversational analyst you can ask questions in plain language. Studios get decision-support "what-if" simulations; fans get a broadcast-quality, multilingual experience in English, Spanish, French and Hindi — built with React, Node.js and Microsoft's AI stack (Azure OpenAI / GitHub Models compatible), deployable to Azure Container Apps with the included infrastructure templates.

## What we built

- **MatchMind Studio** — a broadcast-style control room: live scoreboard, streaming event feed, tactical state with an evidence trail, decision lab, insight library, recaps, performance lab, and **Ask MatchMind**, a grounded conversational analyst.
- **Event engine (Node.js + Express)** — ingests synthetic football-realistic event streams over Server-Sent Events, computes possession/tempo/pressure telemetry, classifies tactical states with a deterministic, explainable rules engine, and broadcasts synchronized snapshots to every client.
- **Football Match Intelligence (Next.js)** — a companion viewer with narratives, key-moment explainers and match statistics.

## Which Microsoft & Azure technologies are used

- **Azure OpenAI / GitHub Models (OpenAI-compatible inference)** — powers Ask MatchMind's free-form answers. The engine speaks the OpenAI Chat Completions protocol and is configured via environment variables (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`), so it runs against **GitHub Models** (free for developers), **Azure OpenAI**, or any Azure AI inference endpoint with zero code changes. When no key is configured, a deterministic grounded engine answers from the match data — the demo never depends on an external service.
- **Azure-ready architecture** — the repository includes `infra/azure/main.bicep` (Infrastructure-as-Code for Azure Container Apps + Azure Event Hubs + Azure Cosmos DB + Azure AI Search) and the event engine ships Azure adapter stubs (`lib/azure.ts`) with a `/api/platform/capabilities` readiness contract. Docker Compose files provide one-command local orchestration of the full stack.
- **TypeScript/Node + React 19** monorepo managed with pnpm workspaces, strict type-checking, and SSE-based realtime — mapped 1:1 to Azure Container Apps hosting in the Bicep template.

## What problem it solves

Broadcasters, analysts and fans see the score but not the *story*: why momentum shifted, which tactical pattern is unfolding, what a substitution changes. MatchMind AI closes that gap — every insight is **explainable** (each narrative cites the exact events and metrics that caused it), **real-time** (sub-second synthetic event streams, 15-second narrative cycles), and **personalized** (studios get tactical decision support; fans get energetic multilingual storytelling; developers get a clean, documented event contract).

## Agentic design

The platform is organized as cooperating, single-responsibility AI agents orchestrated server-side:

1. **Ingestion agent** — normalizes football-realistic event streams into a versioned contract (`matchmind-graphics/v1`).
2. **Tactical Analyst agent** — deterministic rules engine classifying match state with a printed evidence trail (no black box).
3. **Narrator agent** — turns each state change into grounded narratives in four languages.
4. **Q&A agent (Ask MatchMind)** — intent-routes natural-language questions to grounded "tools" (score, goals, cards, substitutions, statistics, fixtures, tactical rationale) and, when an inference endpoint is configured, augments free-form answers with LLM reasoning injected with live context. Answers are always computed from match data — never invented.

## Rubric mapping

| Criterion | Where it scores |
| :-- | :-- |
| Technological implementation | pnpm monorepo, strict TypeScript, SSE realtime, Docker Compose + Azure Bicep, documented API contract |
| Agentic design & innovation | Four-agent pipeline (ingest → analyse → narrate → converse); tool-routed grounded Q&A; deterministic + LLM hybrid |
| Real-world impact | Broadcast studios, streaming second-screens, global fans; explainable AI builds trust; production-shaped deployment path |
| UX & presentation | Broadcast-grade studio UI (dark sidebar / light content), animated telemetry, four languages, conversational Q&A |
| Category adherence | 100% synthetic, football-realistic data (Northbridge FC vs Riverside United); no real Premier League data used or redistributed |

## Honest notes for judges

- Player-level telemetry (speeds/distances) appears only in the synthetic feed, labelled "simulated".
- The optional public-feed connector (ESPN) ships **disabled by default**; the submission runs entirely on the required synthetic data.
- Azure services are deployment-targeted via Bicep and adapter contracts; the running demo is local (Container Apps deployment is one `azd up` away with the included template).
