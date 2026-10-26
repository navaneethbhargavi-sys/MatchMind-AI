// src/lib/types.ts
export type Position = { x: number; y: number };

export type EventType =
  | "kickoff"
  | "pass"
  | "shot"
  | "tackle"
  | "possession_change"
  | "pressure"
  | "goal"
  | "foul"
  | "card"
  | "substitution"
  | "halftime"
  | "fulltime";

export type Event = {
  id: string;
  timestamp: number; // seconds from kickoff
  type: EventType;
  team: "home" | "away";
  player: string;
  playerId: string;
  position: Position;
  target?: Position;
  metadata: Record<string, unknown>;
};

export type MatchState = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  possession: "home" | "away";
  minute: number;
  half: 1 | 2;
  events: Event[];
};

export type PlayerStats = {
  name: string;
  team: "home" | "away";
  passes: number;
  passAccuracy: number;
  shots: number;
  shotsOnTarget: number;
  tackles: number;
  distance: number; // meters covered
  speed: number; // current speed km/h
};

export type Insight = {
  id: string;
  timestamp: number;
  type: "moment" | "tactical" | "milestone" | "narrative";
  title: string;
  description: string;
  explanation: string;
  importance: "low" | "medium" | "high" | "critical";
  team?: "home" | "away";
  player?: string;
};

export type Narrative = {
  id: string;
  timestamp: number;
  text: string;
  type: "play_by_play" | "key_moment" | "recap" | "tactical";
  language: string;
};

export type ViewerMode = "analyst" | "fan" | "player_focus" | "casual";

export type ViewerPrefs = {
  mode: ViewerMode;
  language: string;
  favoriteTeam?: "home" | "away";
  favoritePlayer?: string;
  focusMetric?: string;
};