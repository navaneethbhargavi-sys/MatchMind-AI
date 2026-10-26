// src/lib/live.ts
// Real Premier League live data (ESPN public API, no key required) normalized
// for the Football Match Intelligence app. Server routes fetch; the client
// maps normalized data onto the existing Event / MatchState contracts.

import { Event, MatchState } from "./types";

export type LiveTeam = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  crest: string;
  color: string;
  score: number;
};

export type LiveTeamStats = {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  accuratePasses: number;
  totalPasses: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  corners: number;
  offsides: number;
  saves: number;
};

export type LiveMatchSummaryJson = {
  id: string;
  competition: string;
  utcDate: string;
  venue: string;
  status: { state: "pre" | "in" | "post"; detail: string; completed: boolean };
  home: LiveTeam;
  away: LiveTeam;
};

export type LiveTimelineJson = {
  id: string;
  kind: "goal" | "card" | "substitution" | "kickoff" | "halftime" | "fulltime" | "other";
  minute: number;
  minuteDisplay: string;
  clockSeconds: number;
  side: "home" | "away" | null;
  players: string[];
  text: string;
  penaltyKick: boolean;
  ownGoal: boolean;
  yellowCard: boolean;
  redCard: boolean;
};

export type LiveMatchDetailJson = LiveMatchSummaryJson & {
  clockDisplay: string;
  period: number;
  stats: { home: LiveTeamStats; away: LiveTeamStats } | null;
  timeline: LiveTimelineJson[];
  commentary: { minute: string; text: string }[];
  videos: { id: string; headline: string; description: string; duration: number; url: string }[];
};

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const LEAGUE = "eng.1";

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

async function espnFetch(path: string): Promise<any> {
  const response = await fetch(`${ESPN_BASE}/${LEAGUE}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status})`);
  }
  return response.json();
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value as T;
  }
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function parseScore(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTeam(competitor: any): LiveTeam {
  const team = competitor?.team ?? {};
  return {
    id: String(team.id ?? ""),
    name: String(team.displayName ?? team.name ?? "Unknown"),
    shortName: String(team.shortDisplayName ?? team.displayName ?? team.name ?? "Unknown"),
    abbreviation: String(team.abbreviation ?? ""),
    crest: String(team.logo ?? ""),
    color: String(team.color ?? "#10b981"),
    score: parseScore(competitor?.score),
  };
}

export async function getLiveMatches(): Promise<LiveMatchSummaryJson[]> {
  return cached("scoreboard", 25_000, async () => {
    const payload = await espnFetch("/scoreboard");
    const matches: LiveMatchSummaryJson[] = [];
    for (const event of payload?.events ?? []) {
      const competition = event?.competitions?.[0];
      if (!competition) continue;
      const competitors = competition.competitors ?? [];
      const home = competitors.find((item: any) => item?.homeAway === "home");
      const away = competitors.find((item: any) => item?.homeAway === "away");
      if (!home || !away) continue;
      const type = competition.status?.type ?? {};
      const state = type.state === "in" ? "in" : type.state === "post" ? "post" : "pre";
      matches.push({
        id: String(event.id),
        competition: String(payload?.leagues?.[0]?.name ?? "Premier League"),
        utcDate: String(event.date ?? ""),
        venue: String(competition.venue?.fullName ?? ""),
        status: { state, detail: String(type.detail ?? "Scheduled"), completed: Boolean(type.completed) },
        home: normalizeTeam(home),
        away: normalizeTeam(away),
      });
    }
    return matches;
  });
}

const STAT_FIELDS: Record<string, keyof LiveTeamStats> = {
  possessionPct: "possession",
  totalShots: "shots",
  shotsOnTarget: "shotsOnTarget",
  accuratePasses: "accuratePasses",
  totalPasses: "totalPasses",
  foulsCommitted: "fouls",
  yellowCards: "yellowCards",
  redCards: "redCards",
  wonCorners: "corners",
  offsides: "offsides",
  saves: "saves",
};

export async function getLiveMatchDetail(matchId: string): Promise<LiveMatchDetailJson> {
  return cached(`detail-${matchId}`, 10_000, async () => {
    const [matches, summary] = await Promise.all([
      getLiveMatches(),
      espnFetch(`/summary?event=${encodeURIComponent(matchId)}`),
    ]);
    const base = matches.find((match) => match.id === matchId);
    if (!base) throw new Error(`Match ${matchId} not found`);

    const competition = summary?.header?.competitions?.[0] ?? {};
    const competitors = competition.competitors ?? [];
    const homeCompetitor = competitors.find((item: any) => item?.homeAway === "home");
    const awayCompetitor = competitors.find((item: any) => item?.homeAway === "away");
    const mergeTeam = (base: LiveTeam, override: LiveTeam): LiveTeam => ({
      ...base,
      ...override,
      id: override.id || base.id,
      name: override.name || base.name,
      shortName: override.shortName || base.shortName,
      abbreviation: override.abbreviation || base.abbreviation,
      crest: override.crest || base.crest,
      color: override.color || base.color,
    });
    const home = homeCompetitor ? mergeTeam(base.home, normalizeTeam(homeCompetitor)) : base.home;
    const away = awayCompetitor ? mergeTeam(base.away, normalizeTeam(awayCompetitor)) : base.away;

    const statsOf = (boxTeam: any): LiveTeamStats => {
      const out: LiveTeamStats = {
        possession: 0, shots: 0, shotsOnTarget: 0, accuratePasses: 0, totalPasses: 0,
        fouls: 0, yellowCards: 0, redCards: 0, corners: 0, offsides: 0, saves: 0,
      };
      for (const entry of boxTeam?.statistics ?? []) {
        const field = STAT_FIELDS[String(entry?.name ?? "")];
        if (!field) continue;
        const parsed = Number(entry?.displayValue);
        if (Number.isFinite(parsed)) out[field] = parsed;
      }
      return out;
    };
    const boxTeams = summary?.boxscore?.teams ?? [];
    const boxHome = boxTeams.find((item: any) => String(item?.team?.id) === home.id);
    const boxAway = boxTeams.find((item: any) => String(item?.team?.id) === away.id);
    const stats = boxHome && boxAway ? { home: statsOf(boxHome), away: statsOf(boxAway) } : null;

    const timeline: LiveTimelineJson[] = [];
    const seen = new Set<string>();
    const seenEventKeys = new Set<string>();
    const halftimes = new Set<number>();
    for (const source of [summary?.keyEvents ?? [], competition.details ?? []]) {
      for (const raw of source) {
        const text = String(raw?.type?.text ?? raw?.type?.displayName ?? "").toLowerCase();
        let kind: LiveTimelineJson["kind"] | null = null;
        if (raw?.scoringPlay || text.includes("goal") || text.includes("penalty")) kind = "goal";
        else if (text.includes("card")) kind = "card";
        else if (text.includes("substitution") || text.includes("sub")) kind = "substitution";
        else if (text.includes("kick")) kind = "kickoff";
        else if (text.includes("half")) kind = Number(raw?.clock?.value ?? 0) >= 5400 ? "fulltime" : "halftime";
        else if (text.includes("full") || text.includes("end of game")) kind = "fulltime";
        if (!kind) continue;
        const id = String(raw?.id ?? `${raw?.clock?.value ?? 0}-${kind}`);
        const clock = raw?.clock ?? {};
        // keyEvents and details describe the same incident with different ids;
        // dedupe on both the id and the incident identity.
        const eventKey = `${kind}:${Number(clock.value ?? 0)}:${String(raw?.team?.id ?? "")}`;
        if (seen.has(id) || seenEventKeys.has(eventKey)) continue;
        if (kind === "halftime" && halftimes.has(Number(clock.value ?? 0))) continue;
        if (kind === "halftime") halftimes.add(Number(clock.value ?? 0));
        seen.add(id);
        seenEventKeys.add(eventKey);
        const teamId = String(raw?.team?.id ?? "");
        let players: string[] = (raw?.athletesInvolved ?? []).map((a: any) => String(a?.displayName ?? "")).filter(Boolean);
        if (players.length === 0) {
          players = (raw?.participants ?? []).map((p: any) => String(p?.athlete?.displayName ?? "")).filter(Boolean);
        }
        if (players.length === 0) {
          const text = String(raw?.text ?? "").replace(/^Substitution,\s*[^.]+\.\s*/i, "");
          let m = /Own Goal by ([^,.]+)/.exec(text);
          if (m) players = [m[1].trim()];
          if (players.length === 0) {
            m = /(?:Goal!|scored by)\b.*?\b([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*)+)\s*\(/.exec(text);
            if (m) players = [m[1].trim()];
          }
          if (players.length === 0 && kind === "substitution") {
            m = /(.+?)\s+replaces\s+(.+?)(?:\s+because|\.|$)/.exec(text);
            if (m) players = [m[1].trim(), m[2].trim()];
          }
          if (players.length === 1) {
            const assist = /Assisted by ([^.]+?)(?:\.|$)/.exec(text);
            if (assist) players = [...players, assist[1].trim()];
          }
        }
        timeline.push({
          id,
          kind,
          minute: Number(/(\d+)/.exec(String(clock.displayValue ?? ""))?.[1] ?? 0),
          minuteDisplay: String(clock.displayValue ?? ""),
          clockSeconds: Number(clock.value ?? 0),
          side: teamId === home.id ? "home" : teamId === away.id ? "away" : null,
          players,
          text: String(raw?.text ?? raw?.shortText ?? raw?.type?.text ?? ""),
          penaltyKick: Boolean(raw?.penaltyKick),
          ownGoal: Boolean(raw?.ownGoal),
          yellowCard: Boolean(raw?.yellowCard),
          redCard: Boolean(raw?.redCard),
        });
      }
    }
    timeline.sort((a, b) => a.clockSeconds - b.clockSeconds);

    const commentary = (summary?.commentary ?? [])
      .map((item: any) => ({ minute: String(item?.time?.displayValue ?? "").trim(), text: String(item?.text ?? "").trim() }))
      .filter((item: any) => item.text)
      .slice(-10)
      .reverse();

    const videos = (summary?.videos ?? [])
      .map((video: any) => {
        const links = video?.links ?? {};
        const href =
          (typeof links.web === "object" ? links.web?.href : links.web) ??
          (video?.id ? `https://www.espn.com/video/clip/_/id/${video.id}` : "");
        return {
          id: String(video?.id ?? ""),
          headline: String(video?.headline ?? "Match clip"),
          description: String(video?.description ?? ""),
          duration: Number(video?.duration ?? 0),
          url: String(href ?? ""),
        };
      })
      .filter((clip: any) => clip.url.length > 0);

    const statusType = competition.status?.type ?? {};
    const state = statusType.state === "in" ? "in" : statusType.state === "post" ? "post" : "pre";
    return {
      ...base,
      home,
      away,
      status: { state, detail: String(statusType.detail ?? base.status.detail), completed: Boolean(statusType.completed) },
      clockDisplay: String(competition.status?.displayClock ?? statusType.detail ?? ""),
      period: Number(competition.status?.period ?? 0),
      stats,
      timeline,
      commentary,
      videos,
    };
  });
}

/** Map a real match timeline onto the app's Event contract. */
export function liveEventsToAppEvents(detail: LiveMatchDetailJson): Event[] {
  return detail.timeline.map((item) => ({
    id: `live_${item.id}`,
    timestamp: item.clockSeconds,
    type: item.kind === "other" ? "foul" : item.kind,
    team: item.side ?? "home",
    player: item.players[0] ?? (item.side === "away" ? detail.away.shortName : detail.home.shortName),
    playerId: `${item.side ?? "home"}_${item.players[0] ?? "team"}`,
    position: { x: 50, y: 50 },
    metadata: {
      text: item.text,
      minuteDisplay: item.minuteDisplay,
      penaltyKick: item.penaltyKick,
      ownGoal: item.ownGoal,
      yellowCard: item.yellowCard,
      redCard: item.redCard,
    },
  }));
}

export function liveMatchState(detail: LiveMatchDetailJson, events: Event[]): MatchState {
  const minute = detail.timeline.reduce((max, item) => Math.max(max, item.minute), 0) || Number(/(\d+)/.exec(detail.clockDisplay)?.[1] ?? 0);
  return {
    homeTeam: detail.home.name,
    awayTeam: detail.away.name,
    homeScore: detail.home.score,
    awayScore: detail.away.score,
    possession: detail.stats ? (detail.stats.home.possession >= detail.stats.away.possession ? "home" : "away") : "home",
    minute,
    half: detail.period >= 2 ? 2 : 1,
    events,
  };
}

export function describeLiveMatch(match: LiveMatchSummaryJson): string {
  const status = match.status.state === "in" ? "LIVE" : match.status.state === "post" ? "FT" : new Date(match.utcDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${match.home.shortName} ${match.home.score}–${match.away.score} ${match.away.shortName} · ${status}`;
}
