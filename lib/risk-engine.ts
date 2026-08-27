export type MissionProfile = "satellite" | "crewed" | "lunar";

export type SpaceWeatherSignals = {
  kp: number;
  protonFlux: number;
  xrayFlux: number;
};

export type RiskContribution = {
  key: keyof SpaceWeatherSignals;
  label: string;
  value: string;
  impact: number;
  tone: "low" | "medium" | "high";
  explanation: string;
};

export type RiskAssessment = {
  probability: number;
  confidence: number;
  decision: "GO" | "CONDITIONAL" | "HOLD";
  decisionLabel: string;
  summary: string;
  contributions: RiskContribution[];
  recommendation: string;
};

const PROFILE_BIAS: Record<MissionProfile, number> = {
  satellite: -0.1,
  lunar: 0.18,
  crewed: 0.42,
};

const PROFILE_LABEL: Record<MissionProfile, string> = {
  satellite: "Satellite deployment",
  lunar: "Lunar cargo",
  crewed: "Crewed LEO",
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const toneFor = (value: number, medium: number, high: number) =>
  value >= high ? "high" : value >= medium ? "medium" : "low";

export function calculateRisk(
  signals: SpaceWeatherSignals,
  profile: MissionProfile,
): RiskAssessment {
  const kpNormalized = clamp(signals.kp / 9);
  const protonNormalized = clamp(Math.log10(signals.protonFlux + 1) / 5);
  const xrayLog = Math.log10(Math.max(signals.xrayFlux, 1e-9));
  const xrayNormalized = clamp((xrayLog + 8) / 5);

  const kpWeight = kpNormalized * 4.2;
  const protonWeight = protonNormalized * 3;
  const xrayWeight = xrayNormalized * 2.6;
  const logit =
    -3.9 + kpWeight + protonWeight + xrayWeight + PROFILE_BIAS[profile];
  const probability = Math.round(sigmoid(logit) * 100);

  const contributions: RiskContribution[] = [
    {
      key: "kp",
      label: "Geomagnetic activity",
      value: `Kp ${signals.kp.toFixed(1)}`,
      impact: Math.round(kpWeight * 10),
      tone: toneFor(signals.kp, 4, 5) as RiskContribution["tone"],
      explanation:
        signals.kp >= 5
          ? "Storm-level disturbance can degrade navigation and spacecraft operations."
          : signals.kp >= 4
            ? "Elevated magnetic disturbance reduces the mission margin."
            : "Below NOAA's geomagnetic storm threshold.",
    },
    {
      key: "protonFlux",
      label: "Solar radiation",
      value: `${signals.protonFlux.toFixed(2)} pfu`,
      impact: Math.round(protonWeight * 10),
      tone: toneFor(signals.protonFlux, 5, 10) as RiskContribution["tone"],
      explanation:
        signals.protonFlux >= 10
          ? "At or above NOAA's S1 threshold for >=10 MeV protons."
          : "Radiation exposure remains below the S1 alert threshold.",
    },
    {
      key: "xrayFlux",
      label: "Radio blackout potential",
      value: `${signals.xrayFlux.toExponential(1)} W/m2`,
      impact: Math.round(xrayWeight * 10),
      tone: toneFor(signals.xrayFlux, 1e-6, 1e-5) as RiskContribution["tone"],
      explanation:
        signals.xrayFlux >= 1e-5
          ? "M-class flare range can disrupt HF communications."
          : signals.xrayFlux >= 1e-6
            ? "C-class activity warrants communications monitoring."
            : "X-ray flux is in a quiet operating range.",
    },
  ].sort((a, b) => b.impact - a.impact);

  const decision = probability >= 65 ? "HOLD" : probability >= 35 ? "CONDITIONAL" : "GO";
  const decisionLabel =
    decision === "GO"
      ? "Proceed with nominal controls"
      : decision === "CONDITIONAL"
        ? "Proceed only with mitigations"
        : "Delay the launch window";

  const top = contributions[0];
  const recommendation =
    top.key === "kp"
      ? "Protect navigation margins and re-evaluate when forecast Kp falls below 4."
      : top.key === "protonFlux"
        ? "Reduce crew or avionics exposure and wait for proton flux to trend below 10 pfu."
        : "Preserve alternate communications and wait for X-ray flux to return below C-class range.";

  return {
    probability,
    confidence: Math.max(76, Math.min(94, 94 - Math.round(Math.abs(probability - 50) / 8))),
    decision,
    decisionLabel,
    summary: `${PROFILE_LABEL[profile]} risk is ${probability}% under the selected conditions. ${top.label} is the strongest driver.`,
    contributions,
    recommendation,
  };
}

export function buildMissionBrief(
  assessment: RiskAssessment,
  profile: MissionProfile,
  sourceLabel: string,
) {
  const topTwo = assessment.contributions.slice(0, 2);
  return {
    headline:
      assessment.decision === "GO"
        ? "Mission conditions are inside the launch envelope."
        : assessment.decision === "CONDITIONAL"
          ? "Launch margin is narrowing; mitigations are required."
          : "The current environment exceeds the recommended launch envelope.",
    body: `${assessment.summary} ${topTwo[0].explanation} ${assessment.recommendation}`,
    evidence: [
      `${topTwo[0].label}: ${topTwo[0].value}`,
      `${topTwo[1].label}: ${topTwo[1].value}`,
      `Mission profile: ${PROFILE_LABEL[profile]}`,
      `Data mode: ${sourceLabel}`,
    ],
  };
}
