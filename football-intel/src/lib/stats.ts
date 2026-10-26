// src/lib/stats.ts
import { Event, PlayerStats, MatchState } from "./types";

export function computePlayerStats(events: Event[]): PlayerStats[] {
  const map = new Map<string, PlayerStats>();

  for (const e of events) {
    if (!map.has(e.playerId)) {
      map.set(e.playerId, {
        name: e.player,
        team: e.team,
        passes: 0,
        passAccuracy: 0,
        shots: 0,
        shotsOnTarget: 0,
        tackles: 0,
        distance: 0,
        speed: 0,
      });
    }
    const s = map.get(e.playerId)!;
    if (e.type === "pass") {
      s.passes++;
      if (e.metadata.accuracy) s.passAccuracy++;
    } else if (e.type === "shot" || e.type === "goal") {
      s.shots++;
      if (e.metadata.onTarget) s.shotsOnTarget++;
    } else if (e.type === "tackle") {
      s.tackles++;
    }
    s.distance += Math.round(Math.random() * 50 + 10);
    s.speed = Math.round(5 + Math.random() * 25);
  }

  const result = Array.from(map.values());
  for (const s of result) {
    s.passAccuracy = s.passes > 0 ? Math.round((s.passAccuracy / s.passes) * 100) : 0;
  }
  return result.sort((a, b) => b.passes - a.passes);
}

export function computeTeamStats(events: Event[], team: "home" | "away") {
  const teamEvents = events.filter((e) => e.team === team);
  const passes = teamEvents.filter((e) => e.type === "pass");
  const shots = teamEvents.filter((e) => e.type === "shot" || e.type === "goal");
  const tackles = teamEvents.filter((e) => e.type === "tackle");
  const goals = teamEvents.filter((e) => e.type === "goal");
  const successfulPasses = passes.filter((e) => e.metadata.accuracy);

  return {
    passes: passes.length,
    passAccuracy: passes.length > 0 ? Math.round((successfulPasses.length / passes.length) * 100) : 0,
    shots: shots.length,
    shotsOnTarget: shots.filter((e) => e.metadata.onTarget).length,
    goals: goals.length,
    tackles: tackles.length,
    successfulTackles: tackles.filter((e) => e.metadata.successful).length,
    possession: Math.round((teamEvents.length / events.length) * 100),
  };
}

export function detectKeyMoments(events: Event[]): Event[] {
  const moments: Event[] = [];
  for (const e of events) {
    if (e.type === "goal") moments.push(e);
    else if (e.type === "shot" && e.metadata.xG && (e.metadata.xG as number) > 0.3) moments.push(e);
    else if (e.type === "pressure" && (e.metadata.intensity as number) > 85) moments.push(e);
    else if (e.type === "tackle" && e.metadata.successful === false) moments.push(e);
  }
  return moments;
}

export function computeMatchState(events: Event[], homeTeam: string, awayTeam: string): MatchState {
  let homeScore = 0, awayScore = 0;
  let possession: "home" | "away" = "home";
  for (const e of events) {
    if (e.type === "goal") {
      if (e.team === "home") homeScore++;
      else awayScore++;
    }
    if (e.type === "possession_change") possession = e.team;
  }
  const lastEvent = events[events.length - 1];
  const minute = lastEvent ? Math.floor(lastEvent.timestamp / 60) : 0;
  return {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    possession,
    minute: Math.min(minute, 90),
    half: minute >= 45 ? 2 : 1,
    events,
  };
}