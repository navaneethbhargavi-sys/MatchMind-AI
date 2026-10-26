export type PlatformStatus = "live-local" | "cloud-ready" | "next";

export type PlatformStage = {
  number: string;
  name: string;
  product: string;
  role: string;
  localProof: string;
  status: PlatformStatus;
};

export type PlatformService = {
  name: string;
  category: string;
  role: string;
  status: PlatformStatus;
  signal: string;
};

export const platformStages: PlatformStage[] = [
  {
    number: "01",
    name: "Ingest",
    product: "Azure Event Hubs",
    role: "Receive synthetic match events with a live stream contract.",
    localProof: "Local deterministic replay; no cloud connection",
    status: "live-local",
  },
  {
    number: "02",
    name: "Interpret",
    product: "Azure Functions + Fabric",
    role: "Aggregate windows, derive tactical states and expand analytics features.",
    localProof: "Synthetic replay drives local metrics",
    status: "cloud-ready",
  },
  {
    number: "03",
    name: "Explain",
    product: "Microsoft Foundry + Azure AI",
    role: "Ground narratives in evidence, translate output and score confidence.",
    localProof: "Local stories expose source evidence",
    status: "cloud-ready",
  },
  {
    number: "04",
    name: "Render",
    product: "Azure Container Apps",
    role: "Serve studio APIs, recaps and synchronized broadcast payloads.",
    localProof: "Overlay preview emits a local payload",
    status: "cloud-ready",
  },
  {
    number: "05",
    name: "Personalize",
    product: "Azure AI Services + profiles",
    role: "Shape the same intelligence for analysts, fans, clubs, players and languages.",
    localProof: "Local analyst, fan, player focus and 4 languages",
    status: "live-local",
  },
];

export const platformServices: PlatformService[] = [
  { name: "GitHub + Copilot", category: "Build", role: "Versioned source, issue-driven delivery and assisted implementation.", status: "live-local", signal: "Repository workflow" },
  { name: "Microsoft Foundry", category: "Reason", role: "Prompt, model and agent boundary for explainable match narratives.", status: "cloud-ready", signal: "Evidence-grounded output" },
  { name: "Azure AI Services", category: "Reach", role: "Translation and language services for global fan experiences.", status: "cloud-ready", signal: "EN · ES today" },
  { name: "Microsoft Fabric", category: "Analyze", role: "Real-time analytics, tactical windows and post-match exploration.", status: "next", signal: "KQL / event windows" },
  { name: "Cosmos DB", category: "Persist", role: "Match state, replay snapshots, user preferences and recap artifacts.", status: "next", signal: "Flexible event documents" },
  { name: "Azure AI Search", category: "Ground", role: "Search team context, player notes and approved studio knowledge.", status: "next", signal: "Retrieval-ready" },
];

export const platformProof = [
  { label: "Synthetic events", value: "Live", detail: "Replayable, football-realistic input" },
  { label: "Narratives", value: "Traceable", detail: "Evidence rows link back to moments" },
  { label: "Audiences", value: "2 modes", detail: "Analyst brief and fan story" },
  { label: "Broadcast", value: "Ready", detail: "Safe-area overlay payloads" },
];
