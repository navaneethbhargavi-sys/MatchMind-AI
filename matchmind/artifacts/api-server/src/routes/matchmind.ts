import { Router, type IRouter } from "express";
import {
  getCurrentPayload,
  resetReplay,
  getScenarios,
  subscribe,
  unsubscribe,
  getCapabilities,
} from "../lib/replay";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "matchmind-event-engine",
    mode: "synthetic+live",
    liveProvider: process.env.LIVE_PROVIDER === "footballdata" ? "footballdata" : "espn",
    runtime: process.env.MATCHMIND_RUNTIME ?? "local",
    syntheticOnly: false,
  });
});

router.get("/ready", (_req, res) => {
  res.json({
    ready: true,
    service: "matchmind-event-engine",
    integrations: {
      eventHubs: Boolean(process.env.AZURE_EVENT_HUBS_CONNECTION_STRING),
      foundry: Boolean(process.env.AZURE_OPENAI_ENDPOINT),
      cosmos: Boolean(process.env.AZURE_COSMOS_ENDPOINT),
      fabric: Boolean(process.env.FABRIC_WORKSPACE_ID),
    },
  });
});

router.get("/matches/match-001", (_req, res) => {
  res.json(getCurrentPayload());
});

router.get("/matches/match-001/dataset", (_req, res) => {
  const { cursor, scenario, events, snapshot } = getCurrentPayload();
  res.json({
    source: "synthetic-football-realistic",
    matchId: "match-001",
    scenario,
    cursor,
    events,
    snapshot,
    schema: ["playerId", "eventType", "zone", "distanceM", "speedKph", "ballSpeedKph", "shotSpeedKph", "passAccuracy", "passDifficulty", "modelConfidence"],
  });
});

router.get("/replay/scenarios", (_req, res) => {
  res.json(getScenarios());
});

router.get("/platform/capabilities", (_req, res) => {
  res.json(getCapabilities());
});

router.post("/replay/reset", (req, res) => {
  const scenario = typeof req.query.scenario === "string" ? req.query.scenario : undefined;
  res.json(resetReplay(scenario));
});

router.get("/matches/match-001/events/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  subscribe(res);
  req.on("close", () => {
    unsubscribe(res);
  });
});

export default router;
