/**
 * ESPN public scoreboard provider (no API key required).
 *
 * Supplies real Premier League fixtures, live scores, timelines
 * (goals, cards, substitutions) and team statistics.
 *
 * Normalized output is consumed by ./live.ts and mirrored by
 * ./footballdata.ts so the live engine is provider-agnostic.
 */

export type LiveTeamRef = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  crest: string;
  color: string;
  score: number;
};

export type LiveMatchStatus = {
  state: "pre" | "in" | "post";
  detail: string;
  completed: boolean;
};

export type LiveMatchSummary = {
  id: string;
  competition: string;
  utcDate: string;
  venue: string;
  status: LiveMatchStatus;
  home: LiveTeamRef;
  away: LiveTeamRef;
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

export type LiveTimelineItem = {
  id: string;
  kind: "goal" | "card" | "substitution" | "kickoff" | "halftime" | "fulltime" | "other";
  minute: number;
  minuteDisplay: string;
  clockSeconds: number;
  side: "home" | "away" | null;
  players: string[];
  text: string;
  scoringPlay: boolean;
  penaltyKick: boolean;
  ownGoal: boolean;
  yellowCard: boolean;
  redCard: boolean;
};

export type LiveCommentaryItem = { minute: string; text: string };

export type LiveVideoClip = {
  id: string;
  headline: string;
  description: string;
  duration: number;
  url: string;
};

export type LiveMatchDetail = LiveMatchSummary & {
  clockDisplay: string;
  period: number;
  stats: { home: LiveTeamStats; away: LiveTeamStats } | null;
  timeline: LiveTimelineItem[];
  commentary: LiveCommentaryItem[];
  videos: LiveVideoClip[];
};

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

const SCOREBOARD_TTL_MS = 25_000;
const DETAIL_TTL_MS = 10_000;

type CacheEntry<T> = { value: T; fetchedAt: number };

const scoreboardCache = new Map<string, CacheEntry<LiveMatchSummary[]>>();
const detailCache = new Map<string, CacheEntry<LiveMatchDetail>>();

function leagueSlug(): string {
  return process.env.LIVE_LEAGUE ?? "eng.1";
}

async function espnFetch(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function parseScore(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(competition: any): LiveMatchStatus {
  const type = competition?.status?.type ?? {};
  const state = type.state === "in" ? "in" : type.state === "post" ? "post" : "pre";
  const displayClock = competition?.status?.displayClock;
  const detail = String(type.detail ?? type.shortDetail ?? "Scheduled");
  // While play is running ESPN reports the running clock in both fields
  // ("67'" and "67'"); only append the detail when it adds information
  // (e.g. "HT", "Halftime") rather than duplicating the clock.
  const liveDetail =
    typeof displayClock === "string" && displayClock.length > 0
      ? /^\d/.test(detail)
        ? displayClock
        : `${displayClock} · ${detail}`
      : detail;
  return { state, detail: state === "in" ? liveDetail : detail, completed: Boolean(type.completed) };
}

function normalizeTeamRef(competitor: any): LiveTeamRef {
  const team = competitor?.team ?? {};
  return {
    id: String(team.id ?? ""),
    name: String(team.displayName ?? team.name ?? "Unknown"),
    shortName: String(team.shortDisplayName ?? team.displayName ?? team.name ?? "Unknown"),
    abbreviation: String(team.abbreviation ?? ""),
    crest: String(team.logo ?? ""),
    color: String(team.color ?? "#0ea5a4"),
    score: parseScore(competitor?.score),
  };
}

export async function fetchScoreboard(): Promise<LiveMatchSummary[]> {
  const slug = leagueSlug();
  const cached = scoreboardCache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < SCOREBOARD_TTL_MS) {
    return cached.value;
  }

  const payload = await espnFetch(`${ESPN_BASE}/${slug}/scoreboard`);
  const matches: LiveMatchSummary[] = [];
  for (const event of payload?.events ?? []) {
    const competition = event?.competitions?.[0];
    if (!competition) continue;
    const competitors = competition.competitors ?? [];
    const home = competitors.find((item: any) => item?.homeAway === "home");
    const away = competitors.find((item: any) => item?.homeAway === "away");
    if (!home || !away) continue;
    matches.push({
      id: String(event.id),
      competition: String(payload?.leagues?.[0]?.name ?? "Premier League"),
      utcDate: String(event.date ?? ""),
      venue: String(competition.venue?.fullName ?? ""),
      status: normalizeStatus(competition),
      home: normalizeTeamRef(home),
      away: normalizeTeamRef(away),
    });
  }

  scoreboardCache.set(slug, { value: matches, fetchedAt: Date.now() });
  return matches;
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

function emptyStats(): LiveTeamStats {
  return {
    possession: 0,
    shots: 0,
    shotsOnTarget: 0,
    accuratePasses: 0,
    totalPasses: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    corners: 0,
    offsides: 0,
    saves: 0,
  };
}

function normalizeTeamStats(boxTeam: any): LiveTeamStats {
  const stats = emptyStats();
  for (const entry of boxTeam?.statistics ?? []) {
    const field = STAT_FIELDS[String(entry?.name ?? "")];
    if (!field) continue;
    const parsed = Number(entry?.displayValue);
    if (Number.isFinite(parsed)) {
      stats[field] = parsed;
    }
  }
  return stats;
}

function parseMinute(displayValue: string): number {
  const match = /(\d+)/.exec(displayValue ?? "");
  return match ? Number(match[1]) : 0;
}

function classifyTimelineItem(item: any): LiveTimelineItem["kind"] | null {
  const text = String(item?.type?.text ?? item?.type?.displayName ?? "").toLowerCase();
  if (item?.scoringPlay || text.includes("goal") || text.includes("penalty")) return "goal";
  if (text.includes("card")) return "card";
  if (text.includes("substitution") || text.includes("sub")) return "substitution";
  if (text.includes("kick")) return "kickoff";
  if (text.includes("half")) return item?.clock?.value >= 5400 ? "fulltime" : "halftime";
  if (text.includes("full") || text.includes("end of game")) return "fulltime";
  return null;
}

function normalizeTimelineItem(item: any, homeId: string, awayId: string): LiveTimelineItem | null {
  const kind = classifyTimelineItem(item);
  if (!kind) return null;
  const clock = item?.clock ?? {};
  const teamId = String(item?.team?.id ?? "");
  let players = (item?.athletesInvolved ?? [])
    .map((athlete: any) => String(athlete?.displayName ?? "").trim())
    .filter(Boolean);
  if (players.length === 0) {
    // Header "details" entries name participants differently.
    players = (item?.participants ?? [])
      .map((participant: any) => String(participant?.athlete?.displayName ?? "").trim())
      .filter(Boolean);
  }
  if (players.length === 0) {
    // Last resort: recover names from the event text.
    const text = String(item?.text ?? "").replace(/^Substitution,\s*[^.]+\.\s*/i, "");
    let match = /Own Goal by ([^,.]+)/.exec(text);
    if (match) players = [match[1].trim()];
    if (players.length === 0) {
      match = /(?:Goal!|scored by)\b.*?\b([A-Z][\w''.-]*(?:\s+[A-Z][\w''.-]*)+)\s*\(/.exec(text);
      if (match) players = [match[1].trim()];
    }
    if (players.length === 0 && kind === "substitution") {
      match = /(.+?)\s+replaces\s+(.+?)(?:\s+because|\.|$)/.exec(text);
      if (match) players = [match[1].trim(), match[2].trim()];
    }
    if (players.length === 1) {
      const assist = /Assisted by ([^.]+?)(?:\.|$)/.exec(text);
      if (assist) players = [...players, assist[1].trim()];
    }
  }
  return {
    id: String(item?.id ?? `${clock.value ?? 0}-${kind}-${players.join("-")}`),
    kind,
    minute: parseMinute(String(clock.displayValue ?? "")),
    minuteDisplay: String(clock.displayValue ?? `${parseMinute(String(clock.displayValue ?? ""))}'`),
    clockSeconds: Number(clock.value ?? 0),
    side: teamId === homeId ? "home" : teamId === awayId ? "away" : null,
    players,
    text: String(item?.text ?? item?.shortText ?? item?.type?.text ?? ""),
    scoringPlay: Boolean(item?.scoringPlay),
    penaltyKick: Boolean(item?.penaltyKick),
    ownGoal: Boolean(item?.ownGoal) || /^Own Goal/i.test(String(item?.text ?? "")),
    yellowCard: Boolean(item?.yellowCard),
    redCard: Boolean(item?.redCard),
  };
}

function mergeTeamRef(base: LiveTeamRef, override: LiveTeamRef): LiveTeamRef {
  // The summary header's team objects are sparser than the scoreboard's
  // (often no logo/abbreviation), so keep the base value when the override
  // is empty and only take real updates (score, names).
  return {
    ...base,
    ...override,
    id: override.id || base.id,
    name: override.name || base.name,
    shortName: override.shortName || base.shortName,
    abbreviation: override.abbreviation || base.abbreviation,
    crest: override.crest || base.crest,
    color: override.color || base.color,
  };
}

export async function fetchMatchDetail(matchId: string): Promise<LiveMatchDetail> {
  const cached = detailCache.get(matchId);
  if (cached && Date.now() - cached.fetchedAt < DETAIL_TTL_MS) {
    return cached.value;
  }

  const [scoreboard, summary] = await Promise.all([
    fetchScoreboard(),
    espnFetch(`${ESPN_BASE}/${leagueSlug()}/summary?event=${encodeURIComponent(matchId)}`),
  ]);

  const summaryMatch = scoreboard.find((match) => match.id === matchId);
  if (!summaryMatch) {
    throw new Error(`Match ${matchId} not found on the current scoreboard`);
  }

  const headerCompetition = summary?.header?.competitions?.[0] ?? {};
  const headerCompetitors = headerCompetition.competitors ?? [];
  const headerHome = headerCompetitors.find((item: any) => item?.homeAway === "home");
  const headerAway = headerCompetitors.find((item: any) => item?.homeAway === "away");
  const home = headerHome ? mergeTeamRef(summaryMatch.home, normalizeTeamRef(headerHome)) : summaryMatch.home;
  const away = headerAway ? mergeTeamRef(summaryMatch.away, normalizeTeamRef(headerAway)) : summaryMatch.away;

  const boxTeams = summary?.boxscore?.teams ?? [];
  const boxHome = boxTeams.find((item: any) => String(item?.team?.id) === home.id);
  const boxAway = boxTeams.find((item: any) => String(item?.team?.id) === away.id);
  const stats =
    boxHome && boxAway
      ? { home: normalizeTeamStats(boxHome), away: normalizeTeamStats(boxAway) }
      : null;

  const timeline: LiveTimelineItem[] = [];
  const seenIds = new Set<string>();
  const seenEventKeys = new Set<string>();
  const seenHalftimes = new Set<number>();
  for (const source of [summary?.keyEvents ?? [], headerCompetition.details ?? []]) {
    for (const raw of source) {
      const item = normalizeTimelineItem(raw, home.id, away.id);
      if (!item) continue;
      // keyEvents and details describe the same incidents with different ids;
      // dedupe on both the id and the incident identity (kind + clock + side).
      const eventKey = `${item.kind}:${item.clockSeconds}:${item.side ?? ""}`;
      if (seenIds.has(item.id) || seenEventKeys.has(eventKey)) continue;
      // "Halftime" and "Start 2nd Half" both map to kind halftime at 45';
      // keep only the first one per minute.
      if (item.kind === "halftime") {
        if (seenHalftimes.has(item.minute)) continue;
        seenHalftimes.add(item.minute);
      }
      seenIds.add(item.id);
      seenEventKeys.add(eventKey);
      timeline.push(item);
    }
  }
  timeline.sort((a, b) => a.clockSeconds - b.clockSeconds || a.minute - b.minute);

  const commentary: LiveCommentaryItem[] = (summary?.commentary ?? [])
    .map((item: any) => ({
      minute: String(item?.time?.displayValue ?? "").trim(),
      text: String(item?.text ?? "").trim(),
    }))
    .filter((item: LiveCommentaryItem) => item.text.length > 0)
    .slice(-10)
    .reverse();

  const videos: LiveVideoClip[] = (summary?.videos ?? [])
    .map((video: any) => {
      const links = video?.links ?? {};
      const href =
        (typeof links.web === "object" ? links.web?.href : links.web) ??
        (typeof links.mobile === "object" ? links.mobile?.href : links.mobile) ??
        (video?.id ? `https://www.espn.com/video/clip/_/id/${video.id}` : "");
      return {
        id: String(video?.id ?? ""),
        headline: String(video?.headline ?? "Match clip"),
        description: String(video?.description ?? ""),
        duration: Number(video?.duration ?? 0),
        url: String(href ?? ""),
      };
    })
    .filter((clip: LiveVideoClip) => clip.url.length > 0);

  const statusSource = headerCompetition.status ?? {};
  const detail: LiveMatchDetail = {
    ...summaryMatch,
    home,
    away,
    status: normalizeStatus(headerCompetition),
    clockDisplay: String(statusSource.displayClock ?? statusSource.type?.detail ?? ""),
    period: Number(statusSource.period ?? 0),
    stats,
    timeline,
    commentary,
    videos,
  };

  detailCache.set(matchId, { value: detail, fetchedAt: Date.now() });
  return detail;
}
