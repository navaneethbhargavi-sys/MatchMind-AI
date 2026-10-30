export type Mode = "analyst" | "fan";
export type Language = "EN" | "ES" | "FR" | "HI";
export type TacticalState = "CONTROL" | "PRESSURE" | "CHAOS" | "SWING";
export type ReplayScenario = "pressure-pulse" | "rhythm-control" | "open-match";

export type EventType =
  | "pressure"
  | "pass"
  | "shot"
  | "tackle"
  | "turnover"
  | "goal"
  | "card"
  | "substitution"
  | "kickoff"
  | "halftime"
  | "fulltime"
  | "other";

export type MatchEvent = {
  id: string;
  minute: number;
  second: number;
  team: string;
  player: string;
  type: EventType;
  label: string;
  zone: "defensive-third" | "middle-third" | "final-third";
  outcome: string;
  highlight?: boolean;
  playerId?: string;
  distanceM?: number;
  speedKph?: number;
  ballSpeedKph?: number;
  shotSpeedKph?: number;
  passAccuracy?: number;
  passQuality?: number;
  passDifficulty?: number;
  modelConfidence?: number;
  thresholdTriggered?: string;
  source?: "live" | "synthetic";
};

export type Insight = {
  state: TacticalState;
  title: string;
  analyst: string;
  fan: string;
  spanish: string;
  french: string;
  hindi: string;
  confidence: number;
  evidence: { label: string; value: string; tone: "mint" | "coral" | "blue" }[];
};

export type Snapshot = {
  clock: number;
  possession: [number, number];
  passCompletion: [number, number];
  pressure: number;
  tempo: number;
  territory: number;
  ballSpeedKph: number;
  shotSpeedKph: number;
  passDistanceM: number;
  passQuality: number;
  playerSpeedKph: number;
  distanceCoveredKm: number;
  autoEventConfidence: number;
  milestone: string;
  state: TacticalState;
  insight: Insight;
};

export const players = [
  { id: "player-07", name: "M. Adeyemi", position: "CM", team: "northbridge" },
  { id: "player-11", name: "L. Duarte", position: "LW", team: "northbridge" },
  { id: "player-04", name: "A. Vale", position: "CB", team: "northbridge" },
  { id: "player-09", name: "J. Okafor", position: "ST", team: "riverside" },
];

export const replayScenarios: { id: ReplayScenario; label: string; description: string }[] = [
  { id: "pressure-pulse", label: "Pressure pulse", description: "Northbridge squeeze the midfield" },
  { id: "rhythm-control", label: "Rhythm control", description: "Northbridge slow the match down" },
  { id: "open-match", label: "Open match", description: "Both teams trade high-variance attacks" },
];

const eventTemplates: Omit<MatchEvent, "id" | "minute" | "second">[] = [
  { team: "northbridge", player: "M. Adeyemi", type: "pressure", label: "Pressure applied", zone: "middle-third", outcome: "forced wide exit", highlight: true },
  { team: "riverside", player: "J. Okafor", type: "pass", label: "Progressive pass", zone: "final-third", outcome: "intercepted" },
  { team: "northbridge", player: "L. Duarte", type: "pass", label: "Line-breaking pass", zone: "middle-third", outcome: "completed" },
  { team: "northbridge", player: "A. Vale", type: "tackle", label: "Recovery tackle", zone: "defensive-third", outcome: "possession retained" },
  { team: "riverside", player: "J. Okafor", type: "turnover", label: "Possession lost", zone: "middle-third", outcome: "under pressure", highlight: true },
  { team: "northbridge", player: "M. Adeyemi", type: "pressure", label: "Pressure applied", zone: "middle-third", outcome: "turnover won", highlight: true },
  { team: "northbridge", player: "L. Duarte", type: "shot", label: "Shot", zone: "final-third", outcome: "saved", highlight: true },
  { team: "riverside", player: "J. Okafor", type: "pass", label: "Switch of play", zone: "middle-third", outcome: "completed" },
  { team: "northbridge", player: "M. Adeyemi", type: "pass", label: "Quick combination", zone: "final-third", outcome: "completed" },
  { team: "riverside", player: "J. Okafor", type: "pressure", label: "Counter-press", zone: "middle-third", outcome: "delayed build-up" },
];

export const initialEvents: MatchEvent[] = eventTemplates.slice(0, 6).map((event, index) => ({
  ...event,
  id: `evt-${String(index + 1).padStart(3, "0")}`,
  minute: 17,
  second: 18 + index * 7,
  playerId: players.find((player) => player.name === event.player)?.id,
  distanceM: event.type === "pass" ? 11 + index * 4 : undefined,
  speedKph: event.type === "pressure" || event.type === "tackle" ? 24 + index : undefined,
  ballSpeedKph: event.type === "pass" || event.type === "shot" ? 39 + index * 3 : undefined,
  shotSpeedKph: event.type === "shot" ? 87 : undefined,
  passAccuracy: event.type === "pass" ? 78 + index : undefined,
  passQuality: event.type === "pass" ? 76 + index * 2 : undefined,
  passDifficulty: event.type === "pass" ? 4 + index : undefined,
  modelConfidence: 93 - index,
  thresholdTriggered: event.type === "pressure" ? "Sprint threshold" : event.type === "shot" ? "Shot-speed threshold" : undefined,
}));

export const insightLibrary: Record<TacticalState, Insight> = {
  CONTROL: {
    state: "CONTROL",
    title: "Northbridge are dictating the rhythm",
    analyst: "Northbridge have slowed the match after the regain, keeping Riverside below their preferred tempo and circulating through the central lane.",
    fan: "Northbridge have the match where they want it: calm, patient and moving to their beat.",
    spanish: "Northbridge está imponiendo el ritmo: calma, paciencia y control en el centro.",
    french: "Northbridge impose son rythme : calme, patience et contrôle dans l'axe.",
    hindi: "Northbridge मैच की रफ्तार नियंत्रित कर रहा है—शांत, धैर्यवान और बीच से खेलता हुआ।",
    confidence: 88,
    evidence: [
      { label: "Possession", value: "57% Northbridge", tone: "mint" },
      { label: "Pass completion", value: "84% in the last 5′", tone: "blue" },
      { label: "Tempo", value: "−12% below match average", tone: "coral" },
    ],
  },
  PRESSURE: {
    state: "PRESSURE",
    title: "Northbridge are squeezing the midfield",
    analyst: "The press is forcing Riverside into wide exits. Four middle-third turnovers have arrived inside the last 60 seconds, moving the next action closer to goal.",
    fan: "Northbridge are making Riverside uncomfortable. Every rushed pass is pulling them closer to danger.",
    spanish: "Northbridge está apretando en el centro: Riverside se ve obligado a salir por las bandas y comete errores.",
    french: "Northbridge étouffe le milieu : Riverside est repoussé vers les côtés et perd des ballons.",
    hindi: "Northbridge मिडफील्ड को दबा रहा है। Riverside को बाहर खेलना पड़ रहा है और गेंदें खो रही हैं।",
    confidence: 94,
    evidence: [
      { label: "Pressure events", value: "6 in the last 60 seconds", tone: "mint" },
      { label: "Turnovers won", value: "4 in the middle third", tone: "coral" },
      { label: "Opponent pass rate", value: "71% → 54%", tone: "blue" },
    ],
  },
  CHAOS: {
    state: "CHAOS",
    title: "The match has opened up",
    analyst: "Both teams are skipping the first pass after regains. The combined tempo spike is creating a higher-variance phase with fewer settled possessions.",
    fan: "This has turned into a football storm. Neither side is getting time to breathe.",
    spanish: "El partido se ha abierto: ambos equipos atacan rápido y nadie encuentra calma.",
    french: "Le match s'est ouvert : les deux équipes attaquent vite et personne ne trouve son calme.",
    hindi: "मैच खुल गया है। दोनों टीमें तेजी से हमला कर रही हैं और किसी को सांस लेने का समय नहीं मिल रहा।",
    confidence: 81,
    evidence: [
      { label: "Tempo", value: "+24% above match average", tone: "coral" },
      { label: "Possessions", value: "9 changes in 90 seconds", tone: "mint" },
      { label: "Shots", value: "3 since the last state change", tone: "blue" },
    ],
  },
  SWING: {
    state: "SWING",
    title: "Momentum has tilted toward Northbridge",
    analyst: "A successful regain followed by a final-third entry has shifted territory and shot quality. The change is meaningful because it is sustained across three possessions.",
    fan: "The game is leaning Northbridge’s way. They are winning the next action and building pressure together.",
    spanish: "El impulso se inclina hacia Northbridge: están ganando la segunda jugada y acercándose al área.",
    french: "L'élan penche vers Northbridge : l'équipe gagne le second ballon et avance ensemble.",
    hindi: "गति Northbridge के पक्ष में है। वे अगली चुनौती जीत रहे हैं और मिलकर दबाव बना रहे हैं।",
    confidence: 86,
    evidence: [
      { label: "Territory", value: "61% in the final 5′", tone: "mint" },
      { label: "Final-third entries", value: "+5 vs previous window", tone: "blue" },
      { label: "Momentum", value: "+18 point swing", tone: "coral" },
    ],
  },
};

const scenarioCycles: Record<ReplayScenario, TacticalState[]> = {
  "pressure-pulse": ["PRESSURE", "PRESSURE", "CONTROL", "PRESSURE", "PRESSURE", "SWING"],
  "rhythm-control": ["CONTROL", "CONTROL", "SWING", "CONTROL", "CONTROL", "SWING"],
  "open-match": ["CHAOS", "SWING", "CHAOS", "PRESSURE", "CHAOS", "SWING"],
};

const scenarioEventOffsets: Record<ReplayScenario, number> = {
  "pressure-pulse": 0,
  "rhythm-control": 2,
  "open-match": 6,
};

export function getInsight(cursor: number, scenario: ReplayScenario = "pressure-pulse"): Insight {
  const cycle = scenarioCycles[scenario];
  return insightLibrary[cycle[cursor % cycle.length]];
}

export function getInsightForState(state: TacticalState): Insight {
  return insightLibrary[state];
}

export function getSnapshot(cursor: number, scenario: ReplayScenario = "pressure-pulse"): Snapshot {
  const insight = getInsight(cursor, scenario);
  const possessionBase = scenario === "rhythm-control" ? 61 : scenario === "open-match" ? 50 : 55;
  const possession = possessionBase + ((cursor * 3) % 6);
  return {
    clock: 1062 + cursor * 8,
    possession: [possession, 100 - possession],
    passCompletion: [scenario === "open-match" ? 76 + (cursor % 4) : 82 + (cursor % 4), scenario === "rhythm-control" ? 64 + ((cursor * 2) % 7) : 69 + ((cursor * 2) % 7)],
    pressure: (scenario === "rhythm-control" ? 48 : scenario === "open-match" ? 58 : 66) + ((cursor * 7) % 29),
    tempo: (scenario === "rhythm-control" ? 42 : scenario === "open-match" ? 70 : 54) + ((cursor * 11) % 35),
    territory: (scenario === "rhythm-control" ? 63 : scenario === "open-match" ? 49 : 58) + ((cursor * 5) % 21),
    ballSpeedKph: (scenario === "open-match" ? 43 : 36) + ((cursor * 5) % 16),
    shotSpeedKph: (scenario === "open-match" ? 92 : 78) + ((cursor * 9) % 18),
    passDistanceM: (scenario === "rhythm-control" ? 12 : 17) + ((cursor * 4) % 15),
    passQuality: (scenario === "open-match" ? 68 : 78) + ((cursor * 3) % 17),
    playerSpeedKph: (scenario === "open-match" ? 28 : 25) + ((cursor * 2) % 5),
    distanceCoveredKm: 6.4 + ((cursor * 7) % 15) / 10,
    autoEventConfidence: 91 + ((cursor * 2) % 7),
    milestone: cursor > 0 && cursor % 5 === 0 ? "Three-possession pattern confirmed" : cursor > 0 && cursor % 3 === 0 ? "Threshold event detected" : "Live pattern building",
    state: insight.state,
    insight,
  };
}

export function nextEvent(cursor: number, clock: number, scenario: ReplayScenario = "pressure-pulse"): MatchEvent {
  const offset = scenarioEventOffsets[scenario];
  const template = eventTemplates[(cursor + offset) % eventTemplates.length];
  const isPass = template.type === "pass";
  const isShot = template.type === "shot";
  const speed = 22 + ((cursor * 3) % 11);
  return {
    ...template,
    id: `evt-${String(cursor + 7).padStart(3, "0")}`,
    minute: Math.floor(clock / 60),
    second: clock % 60,
    playerId: players.find((player) => player.name === template.player)?.id,
    distanceM: isPass ? 8 + ((cursor * 5) % 29) : undefined,
    speedKph: template.type === "pressure" || template.type === "tackle" ? speed : undefined,
    ballSpeedKph: isPass || isShot ? 34 + ((cursor * 7) % 22) : undefined,
    shotSpeedKph: isShot ? 82 + ((cursor * 4) % 25) : undefined,
    passAccuracy: isPass ? 72 + ((cursor * 3) % 24) : undefined,
    passQuality: isPass ? 70 + ((cursor * 5) % 27) : undefined,
    passDifficulty: isPass ? 2 + ((cursor * 5) % 8) : undefined,
    modelConfidence: 90 + ((cursor * 2) % 9),
    thresholdTriggered: template.type === "pressure" ? "Sprint threshold" : isShot ? "Shot-speed threshold" : isPass && cursor % 2 === 0 ? "Progressive pass" : undefined,
  };
}
