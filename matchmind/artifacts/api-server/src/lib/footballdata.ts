/**
 * football-data.org provider (optional; requires a free API key).
 *
 * Set FOOTBALL_DATA_API_KEY to activate. The free tier covers the Premier
 * League (competition code PL) with live goals, bookings and substitutions.
 * Team statistics (possession etc.) are not part of the free tier, so the
 * live engine falls back to timeline-derived estimates for those metrics.
 *
 * Exposes the same normalized contract as ./espn.ts.
 */

import type {
  LiveMatchDetail,
  LiveMatchSummary,
  LiveTeamRef,
  LiveTimelineItem,
} from "./espn";

const API_BASE = "https://api.football-data.org/v4";
const COMPETITION = process.env.FOOTBALL_DATA_COMPETITION ?? "PL";
const SCOREBOARD_TTL_MS = 25_000;
const DETAIL_TTL_MS = 12_000;

type CacheEntry<T> = { value: T; fetchedAt: number };
const scoreboardCache: CacheEntry<LiveMatchSummary[]> | null = null;
const detailCache = new Map<string, CacheEntry<LiveMatchDetail>>();

let cachedScoreboard: CacheEntry<LiveMatchSummary[]> | null = null;

async function apiFetch(path: string): Promise<any> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) {
    throw new Error("FOOTBALL_DATA_API_KEY is not set");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": key, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`football-data.org request failed (${response.status}) for ${path}`);
  }
  return response.json();
}

function isoDate(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function normalizeTeam(team: any, score: unknown): LiveTeamRef {
  return {
    id: String(team?.id ?? ""),
    name: String(team?.name ?? "Unknown"),
    shortName: String(team?.shortName ?? team?.name ?? "Unknown"),
    abbreviation: String(team?.tla ?? ""),
    crest: String(team?.crest ?? ""),
    color: "#0ea5a4",
    score: Number.isFinite(Number(score)) ? Number(score) : 0,
  };
}

function normalizeStatus(status: string): { state: "pre" | "in" | "post"; detail: string; completed: boolean } {
  switch (status) {
    case "IN_PLAY":
      return { state: "in", detail: "Live", completed: false };
    case "PAUSED":
      return { state: "in", detail: "Halftime", completed: false };
    case "FINISHED":
      return { state: "post", detail: "Full-time", completed: true };
    case "SCHEDULED":
    case "TIMED":
    default:
      return { state: "pre", detail: "Scheduled", completed: false };
  }
}

function toSummary(match: any): LiveMatchSummary {
  const live = match.status === "IN_PLAY" || match.status === "PAUSED";
  const scoreSource = live ? (match.score?.fullTime ?? {}) : (match.score?.fullTime ?? {});
  return {
    id: String(match.id),
    competition: String(match.competition?.name ?? "Premier League"),
    utcDate: String(match.utcDate ?? ""),
    venue: "",
    status: {
      ...normalizeStatus(match.status),
      detail: live ? `${estimateMinute(match.utcDate)}' · ${normalizeStatus(match.status).detail}` : normalizeStatus(match.status).detail,
    },
    home: normalizeTeam(match.homeTeam, scoreSource.home ?? 0),
    away: normalizeTeam(match.awayTeam, scoreSource.away ?? 0),
  };
}

function estimateMinute(utcDate: string): number {
  const kickoff = Date.parse(utcDate);
  if (!Number.isFinite(kickoff)) return 0;
  const elapsedMinutes = Math.floor((Date.now() - kickoff) / 60_000);
  if (elapsedMinutes <= 45) return Math.max(1, elapsedMinutes);
  if (elapsedMinutes <= 60) return 45; // half-time break
  return Math.min(90, elapsedMinutes - 15); // second half, minus the break
}

export async function fetchScoreboard(): Promise<LiveMatchSummary[]> {
  if (cachedScoreboard && Date.now() - cachedScoreboard.fetchedAt < SCOREBOARD_TTL_MS) {
    return cachedScoreboard.value;
  }
  const payload = await apiFetch(
    `/competitions/${COMPETITION}/matches?dateFrom=${isoDate(0)}&dateTo=${isoDate(1)}`,
  );
  const matches = ((payload?.matches ?? []) as any[]).map(toSummary);
  cachedScoreboard = { value: matches, fetchedAt: Date.now() };
  return matches;
}

export async function fetchMatchDetail(matchId: string): Promise<LiveMatchDetail> {
  const cached = detailCache.get(matchId);
  if (cached && Date.now() - cached.fetchedAt < DETAIL_TTL_MS) {
    return cached.value;
  }

  const match = await apiFetch(`/matches/${encodeURIComponent(matchId)}`);
  const base = toSummary(match);
  const homeId = base.home.id;
  const awayId = base.away.id;

  const timeline: LiveTimelineItem[] = [];
  for (const goal of match?.goals ?? []) {
    const players = [goal?.scorer?.name, ...(goal?.assists ?? []).map((a: any) => a?.name)].filter(Boolean);
    timeline.push({
      id: `goal-${goal.minute}-${goal?.scorer?.id ?? players.join("-")}`,
      kind: "goal",
      minute: Number(goal?.minute ?? 0),
      minuteDisplay: `${goal?.minute ?? 0}'`,
      clockSeconds: Number(goal?.minute ?? 0) * 60,
      side: String(goal?.team?.id) === homeId ? "home" : String(goal?.team?.id) === awayId ? "away" : null,
      players,
      text: `Goal — ${goal?.scorer?.name ?? ""}${goal?.penalty ? " (penalty)" : goal?.ownGoal ? " (own goal)" : ""}${
        goal?.assists?.length ? ` (assist: ${goal.assists.map((a: any) => a?.name).join(", ")})` : ""
      }`.trim(),
      scoringPlay: true,
      penaltyKick: Boolean(goal?.penalty),
      ownGoal: Boolean(goal?.ownGoal),
      yellowCard: false,
      redCard: false,
    });
  }
  for (const booking of match?.bookings ?? []) {
    timeline.push({
      id: `booking-${booking.minute}-${booking?.player?.id ?? booking?.player?.name}`,
      kind: "card",
      minute: Number(booking?.minute ?? 0),
      minuteDisplay: `${booking?.minute ?? 0}'`,
      clockSeconds: Number(booking?.minute ?? 0) * 60,
      side: String(booking?.team?.id) === homeId ? "home" : String(booking?.team?.id) === awayId ? "away" : null,
      players: [booking?.player?.name].filter(Boolean) as string[],
      text: `${booking?.card === "RED_CARD" ? "Red" : "Yellow"} card — ${booking?.player?.name ?? ""}`.trim(),
      scoringPlay: false,
      penaltyKick: false,
      ownGoal: false,
      yellowCard: booking?.card !== "RED_CARD",
      redCard: booking?.card === "RED_CARD",
    });
  }
  for (const sub of match?.substitutions ?? []) {
    timeline.push({
      id: `sub-${sub.minute}-${sub?.playerIn?.id ?? sub?.playerIn?.name}`,
      kind: "substitution",
      minute: Number(sub?.minute ?? 0),
      minuteDisplay: `${sub?.minute ?? 0}'`,
      clockSeconds: Number(sub?.minute ?? 0) * 60,
      side: String(sub?.team?.id) === homeId ? "home" : String(sub?.team?.id) === awayId ? "away" : null,
      players: [sub?.playerIn?.name, sub?.playerOut?.name].filter(Boolean) as string[],
      text: `Substitution — ${sub?.playerIn?.name ?? ""} on for ${sub?.playerOut?.name ?? ""}`.trim(),
      scoringPlay: false,
      penaltyKick: false,
      ownGoal: false,
      yellowCard: false,
      redCard: false,
    });
  }
  timeline.sort((a, b) => a.clockSeconds - b.clockSeconds);

  const detail: LiveMatchDetail = {
    ...base,
    clockDisplay: `${estimateMinute(base.utcDate)}'`,
    period: estimateMinute(base.utcDate) > 45 ? 2 : 1,
    stats: null,
    timeline,
    commentary: [],
    videos: [],
  };

  detailCache.set(matchId, { value: detail, fetchedAt: Date.now() });
  return detail;
}
