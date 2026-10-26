// src/lib/insights.ts
import { Event, Insight, MatchState } from "./types";
import { computeTeamStats, detectKeyMoments } from "./stats";

let insightCounter = 0;

export function generateInsights(events: Event[], state: MatchState): Insight[] {
  const insights: Insight[] = [];
  const homeStats = computeTeamStats(events, "home");
  const awayStats = computeTeamStats(events, "away");
  const keyMoments = detectKeyMoments(events);

  // Tactical insight: possession dominance
  if (homeStats.possession > 60) {
    insights.push({
      id: `ins_${++insightCounter}`,
      timestamp: state.minute * 60,
      type: "tactical",
      title: "Possession Dominance",
      description: `${state.homeTeam} controlling the ball with ${homeStats.possession}% possession.`,
      explanation: "Sustained possession creates pressure and limits opponent counter-attack opportunities. When a team holds over 60% of the ball, they dictate tempo and force the opposition into defensive shape.",
      importance: "high",
      team: "home",
    });
  } else if (awayStats.possession > 60) {
    insights.push({
      id: `ins_${++insightCounter}`,
      timestamp: state.minute * 60,
      type: "tactical",
      title: "Possession Dominance",
      description: `${state.awayTeam} controlling the ball with ${awayStats.possession}% possession.`,
      explanation: "Sustained possession creates pressure and limits opponent counter-attack opportunities. When a team holds over 60% of the ball, they dictate tempo and force the opposition into defensive shape.",
      importance: "high",
      team: "away",
    });
  }

  // Pass quality insight
  if (homeStats.passAccuracy > 85) {
    insights.push({
      id: `ins_${++insightCounter}`,
      timestamp: state.minute * 60,
      type: "tactical",
      title: "Passing Precision",
      description: `${state.homeTeam} completing ${homeStats.passAccuracy}% of passes — elite ball retention.`,
      explanation: "High pass accuracy indicates technical quality and tactical discipline. Teams above 85% typically control match rhythm and create more scoring chances through structured build-up.",
      importance: "medium",
      team: "home",
    });
  }

  // Key moment insights
  for (const moment of keyMoments.slice(-5)) {
    if (moment.type === "goal") {
      insights.push({
        id: `ins_${++insightCounter}`,
        timestamp: moment.timestamp,
        type: "moment",
        title: "GOAL!",
        description: `${moment.player} scores for ${moment.team === "home" ? state.homeTeam : state.awayTeam}!`,
        explanation: `A goal changes the match state entirely. ${moment.player} found the net, shifting momentum and forcing the opposition to adjust their tactical approach. The score is now ${state.homeScore}-${state.awayScore}.`,
        importance: "critical",
        team: moment.team,
        player: moment.player,
      });
    } else if (moment.type === "pressure" && (moment.metadata.intensity as number) > 85) {
      insights.push({
        id: `ins_${++insightCounter}`,
        timestamp: moment.timestamp,
        type: "tactical",
        title: "High Press Intensity",
        description: `${moment.team === "home" ? state.homeTeam : state.awayTeam} pressing with ${moment.metadata.intensity}% intensity in the ${moment.metadata.zone} zone.`,
        explanation: "Intense pressing disrupts opponent build-up and creates turnovers in dangerous areas. High-intensity pressing in the attacking zone is a hallmark of aggressive, proactive football.",
        importance: "high",
        team: moment.team,
      });
    }
  }

  // Milestone insights
  if (homeStats.shots >= 10) {
    insights.push({
      id: `ins_${++insightCounter}`,
      timestamp: state.minute * 60,
      type: "milestone",
      title: "Shot Volume",
      description: `${state.homeTeam} have taken ${homeStats.shots} shots — sustained attacking threat.`,
      explanation: "Reaching double-digit shots indicates consistent attacking intent. While not all shots are equal, high volume creates cumulative pressure and increases the probability of scoring.",
      importance: "medium",
      team: "home",
    });
  }

  return insights.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
}

export function explainMoment(event: Event, state: MatchState): string {
  switch (event.type) {
    case "goal":
      return `Goal by ${event.player}! This moment matters because it changes the match state to ${state.homeScore}-${state.awayScore}. The scoring team gains psychological momentum, and the conceding team must now chase the game, potentially opening up space for counter-attacks.`;
    case "shot":
      return `Shot by ${event.player} with ${event.metadata.speed || "unknown"} km/h speed. ${event.metadata.onTarget ? "On target" : "Off target"}. ${event.metadata.xG ? `Expected goals (xG): ${event.metadata.xG}` : ""}. This shot matters because it represents a scoring opportunity that tests the opposition's defensive organization.`;
    case "pass":
      return `Pass by ${event.player} over ${event.metadata.distance}m. ${event.metadata.accuracy ? "Completed" : "Incomplete"}. Difficulty: ${event.metadata.difficulty}. ${event.metadata.difficulty === "high" ? "This high-difficulty pass matters because it breaks defensive lines and creates attacking opportunities." : "This pass maintains possession and builds attacking structure."}`;
    case "tackle":
      return `Tackle by ${event.player}. ${event.metadata.successful ? "Successful — possession regained." : "Unsuccessful — opponent retains ball."}. ${event.metadata.successful ? "This tackle matters because it halts an attack and transitions play to the tackling team." : "This failed tackle matters because it allows the opponent to continue their attacking move."}`;
    case "pressure":
      return `Pressure event: ${event.metadata.intensity}% intensity in the ${event.metadata.zone} zone. ${event.metadata.intensity && (event.metadata.intensity as number) > 70 ? "High-intensity pressing disrupts opponent build-up and forces errors." : "Moderate pressing maintains defensive shape while conserving energy."}`;
    default:
      return `${event.type} by ${event.player} at minute ${Math.floor(event.timestamp / 60)}. This moment contributes to the overall match narrative and flow.`;
  }
}