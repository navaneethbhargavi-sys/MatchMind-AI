# MatchMind Live — Real Premier League Match Events

This is your Football MatchMind app suite upgraded to run on **real Premier League live match data** — real fixtures, real scores, real goals/cards/substitutions, real team statistics — instead of the fictional "Northbridge vs Riverside" simulation.

Both apps still keep the original synthetic replay as a fallback/demo mode, so nothing breaks when no matches are on.

---

## Hackathon submission (Inside the Game)

> **Data compliance:** this project runs on **synthetic, football-realistic data** (Northbridge FC vs Riverside United, three replay scenarios). The synthetic engine is the default experience on every boot. The optional public-feed connector ships **disabled by default** and is not part of the submission demo.

Submission checklist:

1. **Public GitHub repo** — this folder is a ready-to-push git repository (see "Publish to GitHub" below).
2. **Project pitch** — see [PITCH.md](PITCH.md) (what we built, Microsoft/Azure technologies, problem solved, rubric mapping).
3. **Demo video (< 2 minutes)** — a ready-to-upload walkthrough recording is included as `demo-video.webm` (recorded from the running app). Upload it to YouTube (public or unlisted) and paste the URL on the hackathon project page. No copyrighted music or third-party trademarks in the recording.
4. **AI answers** — Ask MatchMind works out of the box with the grounded rules engine. To enable LLM-powered free-form answers with **Microsoft's stack**, set a free **GitHub Models** token in `matchmind/.env.local`:
   ```
   OPENAI_BASE_URL=https://models.github.ai/inference
   OPENAI_MODEL=openai/gpt-4o-mini
   OPENAI_API_KEY=<GitHub personal access token with models:read>
   ```
   The same engine also accepts Azure OpenAI endpoints — zero code changes.

## Publish to GitHub

```bash
cd matchmind-live
git remote add origin https://github.com/<your-user>/matchmind-ai.git
git push -u origin main
```

The repository includes `.gitignore` (excludes node_modules, dist, .env.local — your API keys never leave your machine) and an MIT license placeholder.

## What you get

| App | Path | What it does now |
| :-- | :-- | :-- |
| **MatchMind Studio** (React + Express SSE) | `matchmind/` | Broadcast studio with live PL match picker, real scoreboard/crests, real event timeline (goals, cards, subs), real possession/shots/pass stats, tactical state classifier running on real events |
| **Ask MatchMind** (studio tab) | `matchmind/` | Conversational Q&A over the live feed - score, goals, cards, subs, stats, today's fixtures, tactical state. Grounded rules engine out of the box; optional OpenAI free-form mode with `OPENAI_API_KEY` |
| **Football Match Intelligence** (Next.js) | `football-intel/` | Match viewer with a real PL match selector, live scoreboard, real event feed + play-by-play commentary, real team stats, AI narrative over real events, official event video clips |


## Quick start (Windows)

Double-click, in this order:

1. `start-studio-api.bat`   — starts the event engine (http://localhost:5000)
2. `start-studio-ui.bat`    — starts the MatchMind studio (http://localhost:5173)
3. `start-football-intel.bat` — starts the Next.js app (http://localhost:3005)

First run: the scripts call `pnpm install` / `npm install` automatically (requires [Node.js 20+](https://nodejs.org) and [pnpm](https://pnpm.io) — `npm i -g pnpm`).

## Quick start (any shell)

```bash
# --- MatchMind studio (2 terminals) ---
cd matchmind
pnpm install

# Terminal 1: event engine (SSE + live provider)
PORT=5000 pnpm --filter @workspace/api-server run dev

# Terminal 2: studio UI
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/matchmind-ai run dev
# open http://localhost:5173

# --- football-intel ---
cd football-intel
npm install
npm run dev
# open http://localhost:3005
```

On match days the studio auto-selects the **live** Premier League match (falls back to the next kickoff, then the latest result). Use the **Premier League** dropdown to switch matches. The **Live feed on / Demo replay** button toggles between real data and the original synthetic demo.

---

## What is real vs derived (MatchMind studio)

| Metric | Source |
| :-- | :-- |
| Teams, crests, score, clock, status, goals, cards, substitutions | **Real** (live provider) |
| Possession, pass completion, shots, corners, fouls (when provider stats exist) | **Real** |
| Pressure index, tempo, territory, tactical state | **Derived** from real events (labelled "derived" in the UI) |
| Ball/shot speed, player speeds | Not in the free feed — only shown in demo replay mode |

football-intel shows the same real events/stats and its play-by-play commentary list is the provider's real commentary.

## Environment variables (all optional)

| Variable | Default | Purpose |
| :-- | :-- | :-- |
| `LIVE_PROVIDER` | `espn` | `espn` (keyless) or `footballdata` (needs key) |
| `FOOTBALL_DATA_API_KEY` | — | football-data.org free-tier key |
| `LIVE_POLL_MS` | `15000` | How often the server refreshes the selected live match |
| `LIVE_LEAGUE` | `eng.1` | ESPN league slug — e.g. `esp.1` (LaLiga), `ita.1` (Serie A), `ger.1` (Bundesliga) |
| `FOOTBALL_DATA_COMPETITION` | `PL` | football-data.org competition code |
| `API_PROXY_TARGET` | `http://localhost:5000` | Where the studio's Vite dev server proxies `/api` |

## Free AI options (no money needed)

Ask MatchMind's GPT-powered free-form answers work with any OpenAI-compatible provider. Two free ones:

1. **Z.ai (recommended - free GLM flash models).** Sign in at z.ai, open the API console, create an API key, then set in `matchmind/.env.local`:
   ```
   OPENAI_API_KEY=<your z.ai key>
   OPENAI_BASE_URL=https://api.z.ai/api/paas/v4
   OPENAI_MODEL=glm-4.5-flash
   ```
2. **Google AI Studio (free Gemini tier).** Get a key at https://aistudio.google.com/apikey (no card required), then:
   ```
   OPENAI_API_KEY=<your google key>
   OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
   OPENAI_MODEL=gemini-2.5-flash
   ```

Save the file and restart the event engine. Without any key, the grounded rules engine answers everything from the live feed.

## New API endpoints (api-server)

- `GET  /api/live/matches` — today's PL fixtures with live status/scores
- `POST /api/live/select { "matchId": "..." }` — switch the live stream to a match
- `GET  /api/live/stream` — Server-Sent Events stream of the selected real match
- `GET  /api/live/state` — current live payload snapshot

All original synthetic endpoints (`/api/matches/match-001/...`, `/api/replay/...`) still work.

## Notes

- The two zip files you provided (`Football-MatchMind-App-Suite.zip`, `football-app.zip`) were byte-identical — one app suite, wired up here once.
- Free-feed limits: ESPN is generous; football-data.org free tier allows 10 requests/minute (this app polls well under that).
- If no Premier League matches are scheduled today, the studio falls back to the last played fixture or the synthetic demo.
