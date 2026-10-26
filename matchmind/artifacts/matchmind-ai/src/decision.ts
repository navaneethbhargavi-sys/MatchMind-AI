import type { MatchEvent, Snapshot } from "@workspace/matchmind";

export type DecisionAction = "press-higher" | "hold-shape" | "attack-wide";
export type DecisionHorizon = 3 | 5 | 10;

export type DecisionOption = {
  action: DecisionAction;
  label: string;
  fitScore: number;
  territorySignal: number;
  regainSignal: number;
  exposureRisk: number;
  workload: number;
  summary: string;
  tradeoff: string;
  evidence: MatchEvent[];
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

function isNorthbridgeRegain(event: MatchEvent) {
  return (
    event.team === "northbridge" &&
    (event.type === "turnover" ||
      event.outcome.toLowerCase().includes("turnover") ||
      event.outcome.toLowerCase().includes("recovery"))
  );
}

function selectEvidence(action: DecisionAction, events: MatchEvent[]) {
  const matching = events.filter((event) => {
    if (action === "press-higher") {
      return event.type === "pressure" || isNorthbridgeRegain(event);
    }
    if (action === "hold-shape") {
      return (
        (event.team === "northbridge" &&
          event.type === "pass" &&
          event.outcome.toLowerCase().includes("completed")) ||
        event.type === "tackle"
      );
    }
    return (
      event.type === "shot" ||
      (event.type === "pass" &&
        (event.zone === "final-third" ||
          event.outcome.toLowerCase().includes("completed")))
    );
  });
  return (matching.length ? matching : events).slice(-3);
}

/**
 * A transparent, deterministic fit rubric for the synthetic demo.
 * Scores describe how well an option aligns with the current replay signals;
 * they are not probabilities, forecasts, or measured match outcomes.
 */
export function evaluateDecisionOptions(
  snapshot: Snapshot,
  events: MatchEvent[],
  horizon: DecisionHorizon,
): DecisionOption[] {
  const recentEvents = events.slice(-9);
  const pressureCount = recentEvents.filter(
    (event) => event.team === "northbridge" && event.type === "pressure",
  ).length;
  const regainCount = recentEvents.filter(isNorthbridgeRegain).length;
  const completedPasses = recentEvents.filter(
    (event) =>
      event.team === "northbridge" &&
      event.type === "pass" &&
      event.outcome.toLowerCase().includes("completed"),
  ).length;
  const finalThirdEvents = recentEvents.filter(
    (event) => event.team === "northbridge" && event.zone === "final-third",
  ).length;
  const shots = recentEvents.filter(
    (event) => event.team === "northbridge" && event.type === "shot",
  ).length;

  const pressureSignal = clamp(
    snapshot.pressure * 0.55 + pressureCount * 5 + regainCount * 4,
  );
  const controlSignal = clamp(
    snapshot.possession[0] * 0.42 +
      snapshot.passCompletion[0] * 0.32 +
      (snapshot.state === "CONTROL" ? 12 : 0),
  );
  const tempoExposure = clamp(
    (snapshot.tempo - 35) * 0.72 +
      (snapshot.state === "CHAOS" ? 18 : 0),
  );
  const widthSignal = clamp(
    snapshot.passCompletion[0] * 0.38 +
      snapshot.passQuality * 0.32 +
      completedPasses * 4 +
      finalThirdEvents * 5 +
      shots * 3,
  );

  const profiles: Omit<DecisionOption, "evidence">[] = [
    {
      action: "press-higher",
      label: "Press higher",
      territorySignal: clamp(
        38 + pressureSignal * 0.34 + regainCount * 3 - tempoExposure * 0.08,
      ),
      regainSignal: clamp(30 + pressureSignal * 0.5 + regainCount * 4),
      exposureRisk: clamp(18 + tempoExposure * 0.58 + Math.max(0, horizon - 3) * 2),
      workload: clamp(32 + horizon * 4 + pressureCount * 3),
      fitScore: 0,
      summary: "Turn the current pressure signal into a more aggressive regain plan.",
      tradeoff:
        "More pressing intensity can create recoveries, but raises transition exposure and player workload.",
    },
    {
      action: "hold-shape",
      label: "Hold shape",
      territorySignal: clamp(36 + controlSignal * 0.45 + snapshot.territory * 0.12),
      regainSignal: clamp(26 + controlSignal * 0.2 + regainCount * 2),
      exposureRisk: clamp(13 + tempoExposure * 0.3 + Math.max(0, 5 - completedPasses) * 2),
      workload: clamp(22 + horizon * 2 + snapshot.tempo * 0.12),
      fitScore: 0,
      summary: "Prioritize compactness and protect the current territory.",
      tradeoff:
        "A safer shape can limit exposure, but may reduce the chance to force an immediate regain.",
    },
    {
      action: "attack-wide",
      label: "Attack wide",
      territorySignal: clamp(35 + widthSignal * 0.48 + finalThirdEvents * 3),
      regainSignal: clamp(24 + widthSignal * 0.2 + shots * 4),
      exposureRisk: clamp(25 + tempoExposure * 0.38 + Math.max(0, horizon - 3)),
      workload: clamp(27 + horizon * 3 + completedPasses * 2),
      fitScore: 0,
      summary: "Use completed passing and final-third activity to stretch the block.",
      tradeoff:
        "Wide progression may open territory, but attacks can leave space behind the ball.",
    },
  ];

  return profiles.map((profile) => {
    const fitScore = clamp(
      profile.territorySignal * 0.34 +
        profile.regainSignal * 0.22 +
        (100 - profile.exposureRisk) * 0.26 +
        (100 - profile.workload) * 0.18,
    );
    return {
      ...profile,
      fitScore,
      evidence: selectEvidence(profile.action, recentEvents),
    };
  });
}

export function formatDecisionRecommendation(
  option: DecisionOption,
  horizon: DecisionHorizon,
) {
  const eventRefs = option.evidence.map((event) => event.id).join(", ");
  return [
    `${option.label} · ${horizon}-minute illustrative scenario`,
    option.summary,
    `Fit ${option.fitScore}/100 · territory signal ${option.territorySignal}/100 · regain signal ${option.regainSignal}/100 · exposure risk ${option.exposureRisk}/100 · workload ${option.workload}/100.`,
    option.tradeoff,
    eventRefs ? `Evidence: ${eventRefs}.` : "Evidence: no recent matching events.",
    "Synthetic, rules-based comparison only—not a prediction or live tracking result.",
  ].join("\n\n");
}
