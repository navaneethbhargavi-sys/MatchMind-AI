export type AzureAdapterStatus = {
  name: string;
  configured: boolean;
  mode: "local" | "azure";
  detail: string;
};

export function azureConfig() {
  return {
    runtime: process.env.MATCHMIND_RUNTIME ?? "local",
    eventHubs: {
      connectionString: process.env.AZURE_EVENT_HUBS_CONNECTION_STRING,
      hubName: process.env.AZURE_EVENT_HUB_NAME,
    },
    foundry: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      clientId: process.env.AZURE_CLIENT_ID,
    },
    cosmos: {
      endpoint: process.env.AZURE_COSMOS_ENDPOINT,
      key: process.env.AZURE_COSMOS_KEY,
    },
    fabric: {
      workspaceId: process.env.FABRIC_WORKSPACE_ID,
    },
  };
}

export function azureAdapters(): AzureAdapterStatus[] {
  const cfg = azureConfig();
  return [
    {
      name: "Azure Event Hubs",
      configured: Boolean(cfg.eventHubs.connectionString && cfg.eventHubs.hubName),
      mode: cfg.eventHubs.connectionString ? "azure" : "local",
      detail: cfg.eventHubs.connectionString
        ? "Consumer ready to ingest synthetic events while preserving the local contract."
        : "Local SSE replay is active; Event Hubs is a planned adapter.",
    },
    {
      name: "Microsoft Foundry / Azure OpenAI",
      configured: Boolean(cfg.foundry.endpoint && cfg.foundry.deployment),
      mode: cfg.foundry.endpoint ? "azure" : "local",
      detail: cfg.foundry.endpoint
        ? "Narrative adapter can be enabled with managed identity or API key."
        : "Deterministic local templates are active; Foundry is a planned adapter.",
    },
    {
      name: "Azure Cosmos DB",
      configured: Boolean(cfg.cosmos.endpoint),
      mode: cfg.cosmos.endpoint ? "azure" : "local",
      detail: cfg.cosmos.endpoint
        ? "Replay snapshots and audience preferences can be persisted."
        : "In-memory replay state is active; Cosmos DB is a planned adapter.",
    },
    {
      name: "Microsoft Fabric",
      configured: Boolean(cfg.fabric.workspaceId),
      mode: cfg.fabric.workspaceId ? "azure" : "local",
      detail: cfg.fabric.workspaceId
        ? "Event history export for analytics can be enabled."
        : "Local dataset export is active; Fabric is a planned adapter.",
    },
  ];
}

export async function tryCreateCosmosClient() {
  const cfg = azureConfig();
  if (!cfg.cosmos.endpoint) return null;
  try {
    const { CosmosClient } = await import("@azure/cosmos");
    if (cfg.cosmos.key) {
      return new CosmosClient({ endpoint: cfg.cosmos.endpoint, key: cfg.cosmos.key });
    }
    const { DefaultAzureCredential } = await import("@azure/identity");
    return new CosmosClient({ endpoint: cfg.cosmos.endpoint, aadCredentials: new DefaultAzureCredential() });
  } catch {
    return null;
  }
}

export async function generateFoundryNarrative(baseInsight: any): Promise<any | null> {
  const cfg = azureConfig();
  if (!cfg.foundry.endpoint || !cfg.foundry.deployment) return null;
  try {
    const url = `${cfg.foundry.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.foundry.deployment}/chat/completions?api-version=2024-02-01`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.foundry.apiKey) {
      headers["api-key"] = cfg.foundry.apiKey;
    } else {
      const { DefaultAzureCredential } = await import("@azure/identity");
      const cred = new DefaultAzureCredential();
      const token = await cred.getToken("https://cognitiveservices.azure.com/.default");
      headers["Authorization"] = `Bearer ${token.token}`;
    }
    const prompt = `You are a football analyst. Given tactical state ${baseInsight.state} with title "${baseInsight.title}", produce JSON with keys analyst and fan. Keep it concise and evidence-aware. Respond only JSON.`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data as any)?.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return { ...baseInsight, analyst: parsed.analyst ?? baseInsight.analyst, fan: parsed.fan ?? baseInsight.fan };
  } catch {
    return null;
  }
}

export async function persistSnapshotToCosmos(snapshot: any): Promise<void> {
  const client = await tryCreateCosmosClient();
  if (!client) return;
  try {
    const db = client.database("matchmind");
    const container = db.container("snapshots");
    await container.items.upsert({ id: `match-001-${snapshot.clock}`, matchId: "match-001", ...snapshot, createdAt: new Date().toISOString() });
  } catch {
    // Persistence is best-effort in demo mode.
  }
}

