import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "matchmind-event-engine",
    mode: "live",
    liveProvider: process.env.LIVE_PROVIDER === "footballdata" ? "footballdata" : "espn",
    runtime: process.env.MATCHMIND_RUNTIME ?? "local",
  });
});

router.get("/ready", (_req, res) => {
  res.json({
    ready: true,
    service: "matchmind-event-engine",
    integrations: {
      inference: Boolean(process.env.OPENAI_API_KEY),
      cosmos: Boolean(process.env.AZURE_COSMOS_ENDPOINT),
      eventHubs: Boolean(process.env.AZURE_EVENT_HUBS_CONNECTION_STRING),
    },
  });
});

export default router;
