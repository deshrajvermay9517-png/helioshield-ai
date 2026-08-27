/**
 * tests/risk-engine-model.test.mjs
 *
 * Validates the HS-XR v0.3 model equation, decision thresholds, tone-transition
 * boundaries, confidence clamp, and buildMissionBrief coverage.
 *
 * Reference equation (docs/ARCHITECTURE.md):
 *   z = -3.9
 *       + 4.2 * clamp(kp / 9)
 *       + 3.0 * clamp(log10(protonFlux + 1) / 5)
 *       + 2.6 * clamp((log10(max(xrayFlux, 1e-9)) + 8) / 5)
 *       + profileBias
 *   probability = round(sigmoid(z) * 100)
 */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => vite.close());

const { calculateRisk, buildMissionBrief } = await vite.ssrLoadModule("/lib/risk-engine.ts");

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Compute the expected probability using the published equation. */
function referenceProb(kp, protonFlux, xrayFlux, profileBias) {
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const kpN = clamp(kp / 9);
  const protonN = clamp(Math.log10(protonFlux + 1) / 5);
  const xrayLog = Math.log10(Math.max(xrayFlux, 1e-9));
  const xrayN = clamp((xrayLog + 8) / 5);
  const z = -3.9 + 4.2 * kpN + 3.0 * protonN + 2.6 * xrayN + profileBias;
  return Math.round((1 / (1 + Math.exp(-z))) * 100);
}

// Profile biases as documented in lib/risk-engine.ts
const BIAS = { satellite: -0.1, lunar: 0.18, crewed: 0.42 };

// ─── reference-point tests ────────────────────────────────────────────────────

test("reference point: quiet conditions — satellite matches published equation", () => {
  const kp = 1, pfu = 0.1, xray = 1e-8;
  const expected = referenceProb(kp, pfu, xray, BIAS.satellite);
  const result = calculateRisk({ kp, protonFlux: pfu, xrayFlux: xray }, "satellite");
  assert.equal(result.probability, expected,
    `Expected ${expected}% but got ${result.probability}%`);
  assert.equal(result.decision, "GO");
});

test("reference point: severe conditions — crewed matches published equation", () => {
  const kp = 8, pfu = 100, xray = 1e-4;
  const expected = referenceProb(kp, pfu, xray, BIAS.crewed);
  const result = calculateRisk({ kp, protonFlux: pfu, xrayFlux: xray }, "crewed");
  assert.equal(result.probability, expected,
    `Expected ${expected}% but got ${result.probability}%`);
  assert.equal(result.decision, "HOLD");
});

test("reference point: threshold neighbourhood — lunar matches published equation", () => {
  const kp = 5, pfu = 10, xray = 1e-5;
  const expected = referenceProb(kp, pfu, xray, BIAS.lunar);
  const result = calculateRisk({ kp, protonFlux: pfu, xrayFlux: xray }, "lunar");
  assert.equal(result.probability, expected,
    `Expected ${expected}% but got ${result.probability}%`);
});

// ─── decision-threshold boundary tests ───────────────────────────────────────

test("probability < 35 always produces GO", () => {
  const result = calculateRisk({ kp: 1, protonFlux: 0.1, xrayFlux: 1e-8 }, "satellite");
  assert.ok(result.probability < 35, `probability was ${result.probability}`);
  assert.equal(result.decision, "GO");
});

test("probability >= 65 always produces HOLD", () => {
  const result = calculateRisk({ kp: 9, protonFlux: 150, xrayFlux: 1e-3 }, "crewed");
  assert.ok(result.probability >= 65, `probability was ${result.probability}`);
  assert.equal(result.decision, "HOLD");
});

test("probability in 35–64 produces CONDITIONAL", () => {
  // kp=5.5, pfu=5, xray=1e-6, lunar → z≈+0.35 → ~59%
  const result = calculateRisk({ kp: 5.5, protonFlux: 5, xrayFlux: 1e-6 }, "lunar");
  assert.ok(
    result.probability >= 35 && result.probability <= 64,
    `probability was ${result.probability}, expected 35–64`,
  );
  assert.equal(result.decision, "CONDITIONAL");
});

// ─── tone-transition boundary tests ──────────────────────────────────────────

test("Kp tone boundary: below 4 is low", () => {
  const result = calculateRisk({ kp: 3.9, protonFlux: 0.1, xrayFlux: 1e-8 }, "satellite");
  const kpContrib = result.contributions.find((c) => c.key === "kp");
  assert.equal(kpContrib.tone, "low", `Expected low but got ${kpContrib.tone} at Kp=3.9`);
});

test("Kp tone boundary: exactly 4 is medium", () => {
  const result = calculateRisk({ kp: 4, protonFlux: 0.1, xrayFlux: 1e-8 }, "satellite");
  const kpContrib = result.contributions.find((c) => c.key === "kp");
  assert.equal(kpContrib.tone, "medium", `Expected medium but got ${kpContrib.tone} at Kp=4`);
});

test("Kp tone boundary: exactly 5 is high", () => {
  const result = calculateRisk({ kp: 5, protonFlux: 0.1, xrayFlux: 1e-8 }, "satellite");
  const kpContrib = result.contributions.find((c) => c.key === "kp");
  assert.equal(kpContrib.tone, "high", `Expected high but got ${kpContrib.tone} at Kp=5`);
  assert.match(kpContrib.explanation, /storm-level/i);
});

test("proton tone boundary: below 5 pfu is low", () => {
  const result = calculateRisk({ kp: 1, protonFlux: 4.9, xrayFlux: 1e-8 }, "satellite");
  const c = result.contributions.find((c) => c.key === "protonFlux");
  assert.equal(c.tone, "low");
});

test("proton tone boundary: exactly 5 pfu is medium", () => {
  const result = calculateRisk({ kp: 1, protonFlux: 5, xrayFlux: 1e-8 }, "satellite");
  const c = result.contributions.find((c) => c.key === "protonFlux");
  assert.equal(c.tone, "medium");
});

test("proton tone boundary: exactly 10 pfu is high with S1 explanation", () => {
  const result = calculateRisk({ kp: 1, protonFlux: 10, xrayFlux: 1e-8 }, "satellite");
  const c = result.contributions.find((c) => c.key === "protonFlux");
  assert.equal(c.tone, "high");
  assert.match(c.explanation, /S1/);
});

test("X-ray tone boundary: below 1e-6 is low", () => {
  const result = calculateRisk({ kp: 1, protonFlux: 0.1, xrayFlux: 9e-7 }, "satellite");
  const c = result.contributions.find((c) => c.key === "xrayFlux");
  assert.equal(c.tone, "low");
});

test("X-ray tone boundary: exactly 1e-6 is medium with C-class explanation", () => {
  const result = calculateRisk({ kp: 1, protonFlux: 0.1, xrayFlux: 1e-6 }, "satellite");
  const c = result.contributions.find((c) => c.key === "xrayFlux");
  assert.equal(c.tone, "medium");
  assert.match(c.explanation, /C-class/i);
});

test("X-ray tone boundary: exactly 1e-5 is high with M-class explanation", () => {
  const result = calculateRisk({ kp: 1, protonFlux: 0.1, xrayFlux: 1e-5 }, "satellite");
  const c = result.contributions.find((c) => c.key === "xrayFlux");
  assert.equal(c.tone, "high");
  assert.match(c.explanation, /M-class/i);
});

// ─── confidence clamp tests ───────────────────────────────────────────────────

test("confidence is always within the 76–94 prototype band", () => {
  const cases = [
    { kp: 1, protonFlux: 0.1, xrayFlux: 1e-8, profile: "satellite" },
    { kp: 5, protonFlux: 10, xrayFlux: 1e-5, profile: "lunar" },
    { kp: 9, protonFlux: 150, xrayFlux: 1e-3, profile: "crewed" },
    { kp: 4.5, protonFlux: 3, xrayFlux: 5e-7, profile: "satellite" },
  ];
  for (const { kp, protonFlux, xrayFlux, profile } of cases) {
    const result = calculateRisk({ kp, protonFlux, xrayFlux }, profile);
    assert.ok(
      result.confidence >= 76 && result.confidence <= 94,
      `confidence ${result.confidence} is outside 76–94 for kp=${kp}, profile=${profile}`,
    );
  }
});

// ─── profile ordering test (crewed ≥ lunar ≥ satellite) ──────────────────────

test("risk ordering: crewed >= lunar >= satellite for the same signals", () => {
  const signals = { kp: 4, protonFlux: 4, xrayFlux: 8e-7 };
  const satellite = calculateRisk(signals, "satellite");
  const lunar = calculateRisk(signals, "lunar");
  const crewed = calculateRisk(signals, "crewed");
  assert.ok(
    lunar.probability >= satellite.probability,
    `lunar (${lunar.probability}) should be >= satellite (${satellite.probability})`,
  );
  assert.ok(
    crewed.probability >= lunar.probability,
    `crewed (${crewed.probability}) should be >= lunar (${lunar.probability})`,
  );
});

// ─── buildMissionBrief coverage ───────────────────────────────────────────────

const BRIEF_CASES = [
  { decision: "GO",          signals: { kp: 1,   protonFlux: 0.1, xrayFlux: 1e-8 }, profile: "satellite" },
  { decision: "CONDITIONAL", signals: { kp: 4.5, protonFlux: 3,   xrayFlux: 5e-7 }, profile: "satellite" },
  { decision: "HOLD",        signals: { kp: 9,   protonFlux: 150, xrayFlux: 1e-3 }, profile: "crewed"    },
];

const PROFILES = ["satellite", "lunar", "crewed"];

for (const { decision, signals } of BRIEF_CASES) {
  for (const p of PROFILES) {
    test(`buildMissionBrief — decision=${decision} profile=${p} produces valid brief`, () => {
      const assessment = calculateRisk(signals, p);
      for (const sourceLabel of ["NOAA live feed", "validated demo scenario"]) {
        const brief = buildMissionBrief(assessment, p, sourceLabel);
        assert.ok(brief.headline.length > 0, "headline is empty");
        assert.ok(brief.body.length > 0, "body is empty");
        assert.ok(
          brief.evidence.length >= 4,
          `expected >=4 evidence items, got ${brief.evidence.length}`,
        );
        assert.ok(brief.evidence.some((e) => e.includes(sourceLabel)),
          `evidence trace should include source label "${sourceLabel}"`);
      }
    });
  }
}
