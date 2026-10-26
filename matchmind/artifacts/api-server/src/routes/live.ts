import { Router, type IRouter } from "express";
import { getLiveState, listLiveMatches, selectLiveMatch, subscribeLive, unsubscribeLive } from "../lib/live";
import { askMatchMind } from "../lib/qa";

const router: IRouter = Router();

router.get("/live/matches", async (_req, res) => {
  res.json(await listLiveMatches());
});

router.post("/live/ask", async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question : "";
  res.json(await askMatchMind(question));
});

// Machine-readable graphics feed for studio playout systems and
// second-screen/streaming integrations (Vizrt, Chyron, OBS, custom apps).
router.get("/live/graphics", (_req, res) => {
  const { payload } = getLiveState();
  const match = payload?.match ?? null;
  res.json({
    contract: "matchmind-graphics/v1",
    matchId: match?.id ?? null,
    competition: match?.competition ?? "Premier League",
    clock: match?.clockDisplay ?? null,
    status: match?.status.detail ?? null,
    score: match
      ? {
          home: { name: match.home.name, abbreviation: match.home.abbreviation, crest: match.home.crest, score: match.home.score },
          away: { name: match.away.name, abbreviation: match.away.abbreviation, crest: match.away.crest, score: match.away.score },
        }
      : null,
    tacticalState: payload?.snapshot?.state ?? null,
    headline: payload?.snapshot?.insight?.title ?? null,
    evidence: payload?.snapshot?.insight?.evidence ?? [],
    possession: payload?.snapshot?.possession ?? null,
    recentEvents: (payload?.events ?? []).slice(-10).map((event: any) => ({
      minute: event.minute,
      type: event.type,
      team: event.team,
      player: event.player,
      label: event.label,
      outcome: event.outcome,
    })),
    highlights: match?.videos ?? [],
    generatedAt: payload?.updatedAt ?? new Date().toISOString(),
  });
});

router.get("/live/state", (_req, res) => {
  res.json(getLiveState());
});

router.post("/live/select", async (req, res) => {
  const matchId = typeof req.body?.matchId === "string" ? req.body.matchId : typeof req.query.matchId === "string" ? (req.query.matchId as string) : null;
  if (!matchId) {
    res.status(400).json({ error: "matchId is required (body JSON or query string)" });
    return;
  }
  const state = await selectLiveMatch(matchId);
  res.json({ ...state, payload: state.payload ?? null });
});

router.get("/live/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  subscribeLive(res);
  req.on("close", () => {
    unsubscribeLive(res);
  });
});

export default router;
