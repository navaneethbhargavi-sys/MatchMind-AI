/**
 * Live match engine: polls the real football data provider, converts real
 * Premier League matches into the studio's event + snapshot contract, and
 * broadcasts updates to SSE subscribers. This is the app's single data path.
 */

import { insightLibrary, type Insight, type MatchEvent, type Snapshot, type TacticalState } from "@workspace/matchmind";
import {
  fetchMatchDetail as espnDetail,
  fetchScoreboard as espnScoreboard,
  type LiveMatchDetail,
  type LiveMatchSummary,
} from "./espn";
import {
  fetchMatchDetail as fdDetail,
  fetchScoreboard as fdScoreboard,
} from "./footballdata";
import { logger } from "./logger";

export type LiveProvider = "espn" | "footballdata";

export type LiveFeedPayload = {
  mode: "live";
  provider: LiveProvider;
  match: {
    id: string;
    competition: string;
    utcDate: string;
    venue: string;
    status: { state: "pre" | "in" | "post"; detail: string; completed: boolean };
    clockDisplay: string;
    period: number;
    home: { id: string; name: string; shortName: string; abbreviation: string; crest: string; color: string; score: number };
    away: { id: string; name: string; shortName: string; abbreviation: string; crest: string; color: string; score: number };
    stats: LiveMatchDetail["stats"];
    statsSource: "provider" | "derived" | "unavailable";
    videos: { id: string; headline: string; description: string; duration: number; url: string }[];
  };
  cursor: number;
  event: MatchEvent | null;
  events: MatchEvent[];
  snapshot: Snapshot;
  commentary: { minute: string; text: string }[];
  updatedAt: string;
};

const POLL_MS = Math.max(8_000, Number(process.env.LIVE_POLL_MS ?? 15_000));

let provider: LiveProvider = process.env.LIVE_PROVIDER === "footballdata" ? "footballdata" : "espn";
let scoreboard: LiveMatchSummary[] = [];
let selectedMatchId: string | null = null;
let lastDetail: LiveMatchDetail | null = null;
let lastPayload: LiveFeedPayload | null = null;
let lastError: string | null = null;
let pollTimer: NodeJS.Timeout | null = null;
const subscribers = new Set<import("express").Response>();

async function fetchScoreboard(): Promise<LiveMatchSummary[]> {
  return provider === "footballdata" ? fdScoreboard() : espnScoreboard();
}

async function fetchDetail(matchId: string): Promise<LiveMatchDetail> {
  return provider === "footballdata" ? fdDetail(matchId) : espnDetail(matchId);
}

function pickDefaultMatch(matches: LiveMatchSummary[]): string | null {
  const live = matches.find((match) => match.status.state === "in");
  if (live) return live.id;
  const upcoming = matches.find((match) => match.status.state === "pre");
  if (upcoming) return upcoming.id;
  return matches.length ? matches[matches.length - 1].id : null;
}

function timelineToEvents(detail: LiveMatchDetail): MatchEvent[] {
  return detail.timeline.map((item) => {
    const player = item.players[0] ?? (item.side === "home" ? detail.home.shortName : detail.away.shortName);
    const label =
      item.kind === "goal"
        ? item.penaltyKick
          ? "Goal — penalty"
          : item.ownGoal
            ? "Goal — own goal"
            : "Goal"
        : item.kind === "card"
          ? item.redCard
            ? "Red card"
            : "Yellow card"
          : item.kind === "substitution"
            ? "Substitution"
            : item.kind === "kickoff"
              ? "Kick-off"
              : item.kind === "halftime"
                ? "Half-time"
                : item.kind === "fulltime"
                  ? "Full-time"
                  : "Match event";
    const outcome =
      item.kind === "goal"
        ? `${item.players[0] ?? "Scorer"}${item.players[1] ? ` (assist: ${item.players[1]})` : ""}`
        : item.kind === "substitution"
          ? `${item.players[0] ?? ""} on for ${item.players[1] ?? ""}`
          : item.players[0] ?? item.text.slice(0, 80);
    return {
      id: `live-${item.id}`,
      minute: item.minute,
      second: Math.round(item.clockSeconds % 60),
      team: item.side ?? "home",
      player: player ?? (item.side === "home" ? detail.home.shortName : detail.away.shortName),
      type: item.kind,
      label,
      zone: item.kind === "goal" ? "final-third" : item.kind === "card" ? "middle-third" : "middle-third",
      outcome,
      highlight: item.kind === "goal" || item.redCard === true,
      source: "live" as const,
      modelConfidence: undefined,
    };
  });
}

function estimateStats(detail: LiveMatchDetail): { home: any; away: any; source: "provider" | "derived" | "unavailable" } {
  if (detail.stats) {
    return { home: detail.stats.home, away: detail.stats.away, source: "provider" };
  }
  const events = detail.timeline;
  const homeShots = events.filter((e) => e.side === "home" && e.kind === "goal").length;
  const awayShots = events.filter((e) => e.side === "away" && e.kind === "goal").length;
  const totalGoals = homeShots + awayShots || 1;
  return {
    home: { possession: Math.round((homeShots / totalGoals) * 100), shots: homeShots, shotsOnTarget: homeShots, fouls: 0, yellowCards: events.filter((e) => e.side === "home" && e.yellowCard).length, redCards: events.filter((e) => e.side === "home" && e.redCard).length, corners: 0, offsides: 0, saves: 0, accuratePasses: 0, totalPasses: 0 },
    away: { possession: Math.round((awayShots / totalGoals) * 100), shots: awayShots, shotsOnTarget: awayShots, fouls: 0, yellowCards: events.filter((e) => e.side === "away" && e.yellowCard).length, redCards: events.filter((e) => e.side === "away" && e.redCard).length, corners: 0, offsides: 0, saves: 0, accuratePasses: 0, totalPasses: 0 },
    source: "derived",
  };
}

function classifyState(detail: LiveMatchDetail, stats: { home: any; away: any }): TacticalState {
  const currentMinute = Math.max(detail.timeline.at(-1)?.minute ?? 0, 1);
  const recentGoal = detail.timeline.some(
    (item) => item.kind === "goal" && currentMinute - item.minute <= 5,
  );
  if (recentGoal) return "SWING";
  const possession = stats.home.possession;
  if (possession >= 58 || possession <= 42) return "CONTROL";
  const cards = detail.timeline.filter((item) => item.kind === "card").length;
  const goalsTotal = detail.timeline.filter((item) => item.kind === "goal").length;
  if (cards >= 3 || goalsTotal >= 3) return "CHAOS";
  return "PRESSURE";
}

function localizeInsight(template: string, home: string, away: string): string {
  return template.replaceAll("Northbridge", home).replaceAll("Riverside", away);
}

function buildInsight(state: TacticalState, detail: LiveMatchDetail, stats: { home: any; away: any }): Insight {
  const template = insightLibrary[state];
  const home = detail.home.shortName;
  const away = detail.away.shortName;
  const evidence = [
    { label: "Possession", value: `${stats.home.possession}% ${home} · ${stats.away.possession}% ${away}`, tone: "mint" as const },
    { label: "Shots (on target)", value: `${stats.home.shots} (${stats.home.shotsOnTarget}) · ${stats.away.shots} (${stats.away.shotsOnTarget})`, tone: "coral" as const },
    { label: "Cards", value: `${stats.home.yellowCards + stats.home.redCards} ${home} · ${stats.away.yellowCards + stats.away.redCards} ${away}`, tone: "blue" as const },
  ];
  return {
    ...template,
    title: localizeInsight(template.title, home, away),
    analyst: localizeInsight(template.analyst, home, away),
    fan: localizeInsight(template.fan, home, away),
    spanish: localizeInsight(template.spanish, home, away),
    french: localizeInsight(template.french, home, away),
    hindi: localizeInsight(template.hindi, home, away),
    confidence: 90,
    evidence,
  };
}

function buildSnapshot(detail: LiveMatchDetail): Snapshot {
  const { home, away, source } = estimateStats(detail);
  const state = classifyState(detail, { home, away });
  const insight = buildInsight(state, detail, { home, away });
  const events = detail.timeline;
  const minuteNow = Math.max(detail.timeline.at(-1)?.minute ?? 0, estimateClockMinute(detail));
  const totalTeamEvents = events.filter((e) => e.kind === "goal" || e.kind === "card").length;
  const passCompletionHome = home.totalPasses > 0 ? Math.round((home.accuratePasses / home.totalPasses) * 100) : source === "provider" ? 0 : 80;
  const passCompletionAway = away.totalPasses > 0 ? Math.round((away.accuratePasses / away.totalPasses) * 100) : source === "provider" ? 0 : 78;
  return {
    clock: minuteNow * 60,
    possession: [home.possession, away.possession],
    passCompletion: [passCompletionHome, passCompletionAway],
    pressure: Math.min(100, 20 + totalTeamEvents * 6 + (home.shots + away.shots) * 3),
    tempo: Math.min(100, 25 + Math.round((events.length / Math.max(minuteNow, 1)) * 180)),
    territory: Math.round(50 + (home.possession - 50) / 2 + (home.shots - away.shots) * 2),
    ballSpeedKph: 0,
    shotSpeedKph: 0,
    passDistanceM: 0,
    passQuality: 0,
    playerSpeedKph: 0,
    distanceCoveredKm: 0,
    autoEventConfidence: source === "provider" ? 97 : 74,
    milestone: `${detail.home.shortName} ${detail.home.score}–${detail.away.score} ${detail.away.shortName} · ${detail.status.detail}`,
    state,
    insight,
  };
}

function estimateClockMinute(detail: LiveMatchDetail): number {
  const kickoff = Date.parse(detail.utcDate);
  if (!Number.isFinite(kickoff)) return 0;
  const elapsed = Math.floor((Date.now() - kickoff) / 60_000);
  if (detail.status.state === "post") return 90;
  if (elapsed <= 45) return Math.max(0, elapsed);
  if (elapsed <= 60) return 45;
  return Math.min(90, elapsed - 15);
}

function buildPayload(detail: LiveMatchDetail): LiveFeedPayload {
  const events = timelineToEvents(detail);
  const { home, away, source } = estimateStats(detail);
  return {
    mode: "live",
    provider,
    match: {
      id: detail.id,
      competition: detail.competition,
      utcDate: detail.utcDate,
      venue: detail.venue,
      status: detail.status,
      clockDisplay: detail.clockDisplay,
      period: detail.period,
      home: detail.home,
      away: detail.away,
      stats: source === "provider" ? { home, away } : null,
      statsSource: source,
      videos: detail.videos,
    },
    cursor: events.length,
    event: events.at(-1) ?? null,
    events: events.slice(-40),
    snapshot: buildSnapshot(detail),
    commentary: detail.commentary.slice(0, 6),
    updatedAt: new Date().toISOString(),
  };
}

function broadcast() {
  if (!lastPayload) return;
  const data = `data: ${JSON.stringify(lastPayload)}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(data);
    } catch {
      subscribers.delete(res);
    }
  }
}

async function poll() {
  try {
    if (!selectedMatchId) {
      scoreboard = await fetchScoreboard();
      selectedMatchId = pickDefaultMatch(scoreboard);
    }
    if (!selectedMatchId) {
      lastError = null;
      lastPayload = null;
      broadcast();
      return;
    }
    lastDetail = await fetchDetail(selectedMatchId);
    lastError = null;
    lastPayload = buildPayload(lastDetail);
    broadcast();
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    logger.warn({ err: lastError, provider }, "Live provider poll failed; keeping last snapshot");
  }
}

function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void poll();
  }, POLL_MS);
  void poll();
}

/** Fetch any fixture's normalized timeline on demand (used by the Q&A agent
 * to answer questions about matches that are not currently selected). */
export async function fetchMatchEvents(matchId: string): Promise<{ match: LiveMatchDetail; events: MatchEvent[] } | null> {
  try {
    const detail = await fetchDetail(matchId);
    return { match: detail, events: timelineToEvents(detail) };
  } catch {
    return null;
  }
}

export function getLiveState() {
  ensurePolling();
  return {
    provider,
    providerConfigured: provider === "espn" ? true : Boolean(process.env.FOOTBALL_DATA_API_KEY),
    selectedMatchId,
    matches: scoreboard,
    payload: lastPayload,
    error: lastError,
  };
}

export async function listLiveMatches() {
  ensurePolling();
  try {
    scoreboard = await fetchScoreboard();
    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  return {
    provider,
    providerConfigured: provider === "espn" ? true : Boolean(process.env.FOOTBALL_DATA_API_KEY),
    selectedMatchId: selectedMatchId ?? pickDefaultMatch(scoreboard),
    matches: scoreboard,
    error: lastError,
  };
}

export async function selectLiveMatch(matchId: string) {
  ensurePolling();
  selectedMatchId = matchId;
  lastDetail = null;
  await poll();
  return getLiveState();
}

export function subscribeLive(res: import("express").Response) {
  ensurePolling();
  subscribers.add(res);
  const initial = lastPayload
    ? `data: ${JSON.stringify(lastPayload)}\n\n`
    : `data: ${JSON.stringify({ mode: "live" as const, provider, pending: true, error: lastError })}\n\n`;
  res.write(initial);
}

export function unsubscribeLive(res: import("express").Response) {
  subscribers.delete(res);
}
