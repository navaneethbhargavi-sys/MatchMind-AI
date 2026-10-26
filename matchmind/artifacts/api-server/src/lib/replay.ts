import { azureAdapters, generateFoundryNarrative, persistSnapshotToCosmos } from "./azure";
import {
  getSnapshot,
  nextEvent,
  initialEvents,
  type MatchEvent,
  type ReplayScenario,
  type Snapshot,
} from "@workspace/matchmind";

export type CurrentPayload = {
  cursor: number;
  scenario: ReplayScenario;
  event: MatchEvent;
  events: MatchEvent[];
  snapshot: Snapshot;
};

const scenarios: ReplayScenario[] = ["pressure-pulse", "rhythm-control", "open-match"];

let cursor = 0;
let scenario: ReplayScenario = "pressure-pulse";
let events: MatchEvent[] = [...initialEvents];
let narrativeOverride: any = null;
let subscribers = new Set<import("express").Response>();

function buildPayload(): CurrentPayload {
  const snapshot = getSnapshot(cursor, scenario);
  const event = events[events.length - 1] ?? initialEvents[0];
  return { cursor, scenario, event, events: [...events], snapshot };
}

function broadcast() {
  const payload = buildPayload();
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(data);
    } catch {
      subscribers.delete(res);
    }
  }
}

function advance() {
  cursor += 1;
  const snapshot = getSnapshot(cursor, scenario);
  const evt = nextEvent(cursor, snapshot.clock, scenario);
  events = [...events, evt].slice(-9);
  broadcast();
}

const timer = setInterval(advance, 1800);

export function getCurrentPayload(): CurrentPayload {
  return buildPayload();
}

export function resetReplay(nextScenario?: string) {
  if (nextScenario && scenarios.includes(nextScenario as ReplayScenario)) {
    scenario = nextScenario as ReplayScenario;
  }
  cursor = 0;
  events = [...initialEvents];
  broadcast();
  return buildPayload();
}

export function getScenarios() {
  return {
    scenarios: [
      { id: "pressure-pulse", label: "Pressure pulse", description: "Northbridge squeeze the midfield" },
      { id: "rhythm-control", label: "Rhythm control", description: "Northbridge slow the match down" },
      { id: "open-match", label: "Open match", description: "Both teams trade high-variance attacks" },
    ],
    selected: scenario,
  };
}

export function subscribe(res: import("express").Response) {
  subscribers.add(res);
  res.write(`data: ${JSON.stringify(buildPayload())}\n\n`);
}

export function unsubscribe(res: import("express").Response) {
  subscribers.delete(res);
}

export function getCapabilities() {
  return {
    mode: "synthetic",
    stream: "sse",
    contractVersion: "0.3",
    stages: [
      { number: "01", name: "Ingest", product: "Synthetic SSE", role: "Stream events", status: "live-local", localProof: "Synthetic events over SSE" },
      { number: "02", name: "Interpret", product: "TypeScript", role: "Derive snapshot", status: "live-local", localProof: "Metrics and tactical state" },
      { number: "03", name: "Explain", product: "Templates", role: "Evidence narrative", status: "live-local", localProof: "Deterministic insight library" },
      { number: "04", name: "Render", product: "React", role: "Overlay preview", status: "live-local", localProof: "Overlay lab" },
      { number: "05", name: "Personalize", product: "UI state", role: "Modes and languages", status: "live-local", localProof: "Analyst/Fan + 4 languages" },
    ],
    services: [
      { name: "Event Hubs", category: "Ingest", status: "planned", role: "Synthetic live events" },
      { name: "Azure Functions", category: "Interpret", status: "planned", role: "Windowed metrics" },
      { name: "Microsoft Fabric", category: "Analytics", status: "planned", role: "Event history" },
      { name: "Microsoft Foundry", category: "Explain", status: "planned", role: "Grounded narrative" },
      { name: "Azure AI Services", category: "Translate", status: "planned", role: "Language coverage" },
      { name: "Cosmos DB", category: "Persist", status: "planned", role: "Snapshots and prefs" },
      { name: "Azure AI Search", category: "Ground", status: "planned", role: "Editorial context" },
      { name: "Container Apps", category: "Host", status: "planned", role: "API and UI" },
    ],
    adapters: azureAdapters(),
    integrations: {
      eventHubs: Boolean(process.env.AZURE_EVENT_HUBS_CONNECTION_STRING),
      foundry: Boolean(process.env.AZURE_OPENAI_ENDPOINT),
      cosmos: Boolean(process.env.AZURE_COSMOS_ENDPOINT),
      fabric: Boolean(process.env.FABRIC_WORKSPACE_ID),
    },
  };
}



