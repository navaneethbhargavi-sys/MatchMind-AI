// src/lib/events.ts
import { Event, EventType, Position, MatchState } from "./types";

const HOME_PLAYERS = [
  "Rodri", "Haaland", "De Bruyne", "Grealish", "Walker",
  "Dias", "Stones", "Foden", "Bernardo", "Alvarez", "Ederson",
];
const AWAY_PLAYERS = [
  "Salah", "Van Dijk", "Alexander-Arnold", "Mac Allister", "Nunez",
  "Diaz", "Szoboszlai", "Robertson", "Konate", "Endo", "Alisson",
];

let eventCounter = 0;

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPos(): Position {
  return { x: Math.random() * 100, y: Math.random() * 100 };
}

function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function generateEvent(state: MatchState): Event {
  const minute = state.minute;
  const team: "home" | "away" = Math.random() > 0.5 ? "home" : "away";
  const players = team === "home" ? HOME_PLAYERS : AWAY_PLAYERS;
  const player = randomFrom(players);
  const playerId = `${team}_${player}`;

  // Event type probabilities shift based on match state
  const r = Math.random();
  let type: EventType;
  if (r < 0.05) type = "kickoff";
  else if (r < 0.5) type = "pass";
  else if (r < 0.6) type = "tackle";
  else if (r < 0.68) type = "shot";
  else if (r < 0.72) type = "possession_change";
  else if (r < 0.76) type = "pressure";
  else if (r < 0.78) type = "foul";
  else if (r < 0.8) type = "card";
  else if (r < 0.82) type = "substitution";
  else type = "pass";

  const position = randomPos();
  const target = type === "pass" || type === "shot" ? randomPos() : undefined;

  const metadata: Record<string, unknown> = {};
  if (type === "pass") {
    metadata.distance = Math.round(distance(position, target!) * 0.9);
    metadata.accuracy = Math.random() > 0.15;
    metadata.difficulty = Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "medium" : "low";
  } else if (type === "shot") {
    metadata.speed = Math.round(80 + Math.random() * 40);
    metadata.onTarget = Math.random() > 0.4;
    metadata.xG = Math.round(Math.random() * 0.6 * 100) / 100;
  } else if (type === "pressure") {
    metadata.intensity = Math.round(Math.random() * 100);
    metadata.zone = randomFrom(["defensive", "midfield", "attacking"]);
  } else if (type === "tackle") {
    metadata.successful = Math.random() > 0.3;
  }

  const event: Event = {
    id: `evt_${++eventCounter}`,
    timestamp: minute * 60 + Math.floor(Math.random() * 60),
    type,
    team,
    player,
    playerId,
    position,
    target,
    metadata,
  };

  // Goal check
  if (type === "shot" && (metadata.onTarget as boolean) && Math.random() < 0.12) {
    event.type = "goal";
    metadata.onTarget = true;
  }

  return event;
}

export function generateMatchEvents(count: number = 200): Event[] {
  const events: Event[] = [];
  const state: MatchState = {
    homeTeam: "Manchester City",
    awayTeam: "Liverpool",
    homeScore: 0,
    awayScore: 0,
    possession: "home",
    minute: 0,
    half: 1,
    events: [],
  };

  for (let i = 0; i < count; i++) {
    state.minute = Math.floor((i / count) * 90);
    if (state.minute >= 45 && state.half === 1) state.half = 2;
    const evt = generateEvent(state);
    evt.timestamp = state.minute * 60 + Math.floor(Math.random() * 60);
    events.push(evt);
    state.events.push(evt);
    if (evt.type === "goal") {
      if (evt.team === "home") state.homeScore++;
      else state.awayScore++;
    }
    if (evt.type === "possession_change") {
      state.possession = evt.team;
    }
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}