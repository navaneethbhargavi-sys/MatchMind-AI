/**
 * Ask MatchMind: a question-answering engine over the live Premier League feed.
 *
 * Confident intents (score, goals, cards, substitutions, statistics, fixtures,
 * cross-match questions, tactical rationale) are answered instantly and
 * deterministically from the live data - no LLM in the path. Only free-form
 * questions are routed to the configured OpenAI-compatible inference endpoint
 * (GitHub Models / Azure OpenAI / Gemini), with the live payload injected as
 * grounding context and the deterministic engine as an always-available
 * fallback.
 */

import { fetchMatchEvents, getLiveState } from "./live";
import { logger } from "./logger";

export type AskAnswer = {
  question: string;
  answer: string;
  source: "rules" | "openai";
  matchId: string | null;
  askedAt: string;
};

function fmtClock(detail: string): string {
  return detail || "";
}

/* The live payload carries studio-format events: { type, minute, second, team, player, label, outcome }. */

function goalsLine(events: any[], home: any, away: any): string {
  const goals = events.filter((e: any) => e.type === "goal");
  if (!goals.length) return `No goals in ${home.shortName} vs ${away.shortName}.`;
  return goals
    .map((g: any) => {
      const team = g.team === "home" ? home.shortName : away.shortName;
      const kind = /penalty/i.test(g.label ?? "") ? ", penalty" : /own goal/i.test(g.label ?? "") ? ", own goal" : "";
      const assist = /assist: ([^)]+)/.exec(g.outcome ?? "");
      return `${g.minute}' ${team}: ${g.player}${kind}${assist ? ` (assist: ${assist[1]})` : ""}`;
    })
    .join(" | ");
}

function cardsLine(events: any[], home: any, away: any): string {
  const cards = events.filter((e: any) => e.type === "card");
  if (!cards.length) return "No cards shown so far.";
  const detail = cards
    .map((c: any) => {
      const team = c.team === "home" ? home.shortName : away.shortName;
      const red = /red/i.test(c.label ?? "");
      return `${c.minute}' ${red ? "RED" : "Yellow"} - ${c.player} (${team})`;
    })
    .join(" | ");
  const reds = cards.filter((c: any) => /red/i.test(c.label ?? "")).length;
  const yellows = cards.length - reds;
  return `Cards so far: ${yellows} yellow${yellows === 1 ? "" : "s"}${reds ? `, ${reds} red${reds === 1 ? "" : "s"}. ` : ". "}${detail}`;
}

function subsLine(events: any[], home: any, away: any): string {
  const subs = events.filter((e: any) => e.type === "substitution");
  if (!subs.length) return "No substitutions made yet.";
  return subs
    .map((s: any) => {
      const team = s.team === "home" ? home.shortName : away.shortName;
      return `${s.minute}' ${team}: ${String(s.outcome ?? "").replace(" on for ", " ON for ") || s.player}`;
    })
    .join(" | ");
}

function fixturesLine(): string {
  const { matches } = getLiveState();
  if (!matches.length) return "No Premier League fixtures found in the current provider window.";
  return matches
    .map((m: any) => {
      const state = m.status.state === "in" ? "LIVE" : m.status.state === "post" ? "FT" : m.status.detail;
      return `${m.home.shortName} ${m.home.score}-${m.away.score} ${m.away.shortName} (${state})`;
    })
    .join(" | ");
}

/** Find a fixture from today's slate mentioned by name in the question. */
function findMentionedMatch(question: string, excludeId?: string | null): any | null {
  const q = question.toLowerCase();
  const { matches } = getLiveState();
  const found = matches.find((m: any) => {
    if (excludeId && m.id === excludeId) return false;
    const names = [m.home.name, m.away.name, m.home.shortName, m.away.shortName, m.home.abbreviation, m.away.abbreviation];
    return names.some((n: string) => n && n.length > 2 && q.includes(String(n).toLowerCase()));
  });
  return found ?? null;
}

/**
 * Confident deterministic intents. Returns null when the question needs the
 * LLM (free-form). Cross-match questions are checked BEFORE selected-match
 * intents so "who scored in the Liverpool match" routes to Liverpool even
 * though "scored" also matches the generic goals intent.
 */
async function tryRulesIntent(question: string): Promise<AskAnswer | null> {
  const q = question.toLowerCase();
  const { payload, matches } = getLiveState();
  const askedAt = new Date().toISOString();
  const base = { question, askedAt, source: "rules" as const };

  const match = payload?.match ?? null;
  const timeline: any[] = (payload?.events ?? []) as any[];
  const home = match?.home;
  const away = match?.away;

  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  if (has("hello", "hi ", "hey", "help", "what can you")) {
    return {
      ...base,
      answer:
        "Ask me anything about the live Premier League feed - the score, goals and scorers, cards, substitutions, possession and shots, the running clock, today's fixtures, or why the tactical state changed. You can also ask about any other match from today's slate by name.",
      matchId: match?.id ?? null,
    };
  }

  if (has("fixture", "fixtures", "today", "who plays", "schedule", "games today", "matches today")) {
    return { ...base, answer: `Today's Premier League slate: ${fixturesLine()}`, matchId: match?.id ?? null };
  }

  // Cross-match questions: mention another fixture by name -> answer from
  // that fixture's real timeline (fetched on demand, cached by the engine).
  const otherMatch = findMentionedMatch(question, match?.id);
  if (otherMatch) {
    const outcome =
      otherMatch.home.score === otherMatch.away.score
        ? "It finished level."
        : `${(otherMatch.home.score > otherMatch.away.score ? otherMatch.home : otherMatch.away).name} won.`;
    let detail = "";
    const fetched = await fetchMatchEvents(otherMatch.id);
    if (fetched) {
      const goals = goalsLine(fetched.events, fetched.match.home, fetched.match.away);
      const cards = cardsLine(fetched.events, fetched.match.home, fetched.match.away);
      detail = ` Goals: ${goals}. ${cards}`;
    }
    return {
      ...base,
      answer:
        `${otherMatch.home.name} ${otherMatch.home.score}-${otherMatch.away.score} ${otherMatch.away.name} (${otherMatch.status.detail}). ${outcome}${detail}` +
        (match && match.id !== otherMatch.id ? ` The studio is currently showing ${match.home.shortName} vs ${match.away.shortName} - switch with the Premier League dropdown to load this one fully.` : ""),
      matchId: otherMatch.id,
    };
  }

  if (!match || !home || !away) {
    return {
      ...base,
      answer: `I don't have a match loaded right now. ${fixturesLine()}`,
      matchId: null,
    };
  }

  const statusText = match.status.state === "in" ? `live at ${fmtClock(match.clockDisplay || match.status.detail)}` : match.status.detail;
  const stats = match.stats;

  if (has("goal", "scored", "scorer", "goals")) {
    return { ...base, answer: goalsLine(timeline, home, away), matchId: match.id };
  }
  if (has("score", "result", "who winning", "who is winning", "who's winning", "leading")) {
    const leader =
      home.score === away.score
        ? "It's level."
        : home.score > away.score
          ? `${home.shortName} lead.`
          : `${away.shortName} lead.`;
    return {
      ...base,
      answer: `${home.name} ${home.score}-${away.score} ${away.name} (${statusText}, ${match.competition}${match.venue ? `, ${match.venue}` : ""}). ${leader}`,
      matchId: match.id,
    };
  }
  if (has("card", "booking", "yellow", "red", "sent off")) {
    return { ...base, answer: cardsLine(timeline, home, away), matchId: match.id };
  }
  if (has("sub", "substitut", "came on", "brought on", "off the pitch")) {
    return { ...base, answer: subsLine(timeline, home, away), matchId: match.id };
  }
  if (has("possession", "ball")) {
    const p = stats
      ? `Possession is ${stats.home.possession}% ${home.shortName} vs ${stats.away.possession}% ${away.shortName}${match.statsSource === "provider" ? " (provider statistics)." : " (derived from the timeline)."}`
      : "Possession statistics aren't available for this match yet.";
    return { ...base, answer: p, matchId: match.id };
  }
  if (has("shot", "on target", "chance")) {
    const s = stats
      ? `Shots: ${home.shortName} ${stats.home.shots} (${stats.home.shotsOnTarget} on target), ${away.shortName} ${stats.away.shots} (${stats.away.shotsOnTarget} on target).`
      : "Shot statistics aren't available for this match yet.";
    return { ...base, answer: s, matchId: match.id };
  }
  if (has("corner", "foul", "pass", "stats", "statistics", "numbers")) {
    if (!stats) return { ...base, answer: "Team statistics aren't available for this match yet.", matchId: match.id };
    return {
      ...base,
      answer:
        `${home.shortName} vs ${away.shortName}: possession ${stats.home.possession}-${stats.away.possession}%, ` +
        `shots ${stats.home.shots}-${stats.away.shots} (on target ${stats.home.shotsOnTarget}-${stats.away.shotsOnTarget}), ` +
        `passes ${stats.home.accuratePasses}-${stats.away.accuratePasses} completed, ` +
        `corners ${stats.home.corners}-${stats.away.corners}, fouls ${stats.home.fouls}-${stats.away.fouls}.`,
      matchId: match.id,
    };
  }
  if (has("time", "minute", "clock", "how long", "when")) {
    return { ...base, answer: `The clock reads ${match.clockDisplay || match.status.detail} (${match.status.detail}), ${statusText}.`, matchId: match.id };
  }
  if (has("where", "venue", "stadium", "playing at")) {
    return { ...base, answer: `${home.shortName} vs ${away.shortName} is being played at ${match.venue || "the home side's stadium"} (${match.competition}).`, matchId: match.id };
  }
  if (has("state", "tactic", "why", "momentum", "pattern")) {
    const snap = payload?.snapshot;
    if (!snap) return { ...base, answer: "The tactical engine hasn't produced a snapshot yet.", matchId: match.id };
    const evidence = (snap.insight?.evidence ?? []).map((e: any) => `${e.label}: ${e.value}`).join("; ");
    return {
      ...base,
      answer: `Current tactical state: ${snap.state}. ${snap.insight?.analyst ?? ""} Evidence: ${evidence}`,
      matchId: match.id,
    };
  }
  if (has("commentary", "happened", "recent", "latest", "last")) {
    const commentary = payload?.commentary ?? [];
    const recent = commentary.slice(0, 3).map((c: any) => `${c.minute || ""} ${c.text}`).join(" | ");
    return { ...base, answer: recent ? `Latest from the feed: ${recent}` : "No recent commentary items yet.", matchId: match.id };
  }
  if (has("insight", "narrative", "story")) {
    const snap = payload?.snapshot;
    return { ...base, answer: snap ? `${snap.insight?.title}. ${snap.insight?.analyst ?? ""}` : "No insight generated yet.", matchId: match.id };
  }

  // No confident intent - hand the question to the LLM.
  return null;
}

/** Deterministic fallback (used when the LLM is unavailable). */
export function answerFromRules(question: string): AskAnswer {
  const { payload, matches } = getLiveState();
  const askedAt = new Date().toISOString();
  const base = { question, askedAt, source: "rules" as const };
  const match = payload?.match ?? null;
  const home = match?.home;
  const away = match?.away;
  const timeline: any[] = (payload?.events ?? []) as any[];

  if (match && home && away) {
    const goals = goalsLine(timeline, home, away);
    const cards = cardsLine(timeline, home, away);
    return {
      ...base,
      answer: `${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name} (${match.status.detail}). Goals: ${goals}. ${cards} Possession: ${match.stats ? `${match.stats.home.possession}% - ${match.stats.away.possession}%` : "unavailable"}.`,
      matchId: match.id,
    };
  }
  return { ...base, answer: `I couldn't reach the inference endpoint for that free-form question. ${fixturesLine()}`, matchId: null };
}

/** Optional LLM answer with the live payload injected as grounding context. */
async function answerFromOpenAI(question: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  // Point at any OpenAI-compatible endpoint (Azure/proxy/reseller) via OPENAI_BASE_URL.
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const { payload, matches } = getLiveState();
  const context = JSON.stringify({
    selectedMatch: payload?.match ?? null,
    recentEvents: payload?.events ?? [],
    snapshot: payload?.snapshot ? { state: payload.snapshot.state, insight: payload.snapshot.insight?.title } : null,
    commentary: payload?.commentary ?? [],
    todaysFixtures: matches.map((m) => ({
      home: m.home.shortName, away: m.away.shortName,
      score: `${m.home.score}-${m.away.score}`, status: m.status.detail,
    })),
  }).slice(0, 12000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are MatchMind, a lively Premier League match analyst. Answer the user's question using ONLY the live match context provided. " +
              "Lead with what the context DOES show: name the real players involved in recent events, quote the real score, minute, " +
              "possession, shots and card counts. If the exact thing asked for is not in the context (e.g. player speeds), answer with the " +
              "closest grounded insight (who is involved in the action, which way momentum leans) and note the gap in one short clause. " +
              "Be concise (2-4 sentences), energetic, concrete - never invent players, numbers or events. " +
              "Live match context: " + context,
          },
          { role: "user", content: question },
        ],
        // Generous budget: Gemini 2.5-style thinking models spend internal
        // reasoning tokens from the same limit; the prompt caps the visible answer.
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (error) {
    logger.warn({ err: String(error) }, "OpenAI ask failed; falling back to rules engine");
    return null;
  }
}

export async function askMatchMind(question: string): Promise<AskAnswer> {
  const trimmed = question.trim().slice(0, 500);
  if (!trimmed) {
    return { question, answer: "Ask me something about the live Premier League feed.", source: "rules", matchId: null, askedAt: new Date().toISOString() };
  }
  // Confident intents answer instantly from the live data (no LLM wait).
  const rules = await tryRulesIntent(trimmed);
  if (rules) return rules;
  // Free-form questions go to the configured inference endpoint.
  const llm = await answerFromOpenAI(trimmed);
  if (llm) {
    const { payload } = getLiveState();
    return { question: trimmed, answer: llm, source: "openai", matchId: payload?.match?.id ?? null, askedAt: new Date().toISOString() };
  }
  // Inference unavailable - deterministic fallback keeps the chat useful.
  return answerFromRules(trimmed);
}
