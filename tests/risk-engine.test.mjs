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

const { calculateRisk } = await vite.ssrLoadModule("/lib/risk-engine.ts");

test("quiet conditions remain inside the launch envelope", () => {
  const result = calculateRisk(
    { kp: 1, protonFlux: 0.1, xrayFlux: 1e-8 },
    "satellite",
  );
  assert.equal(result.decision, "GO");
  assert.ok(result.probability < 35);
});

test("severe conditions trigger a hold", () => {
  const result = calculateRisk(
    { kp: 8, protonFlux: 100, xrayFlux: 1e-4 },
    "crewed",
  );
  assert.equal(result.decision, "HOLD");
  assert.ok(result.probability >= 65);
});

test("crewed missions are never scored below satellite missions", () => {
  const signals = { kp: 4, protonFlux: 4, xrayFlux: 8e-7 };
  const satellite = calculateRisk(signals, "satellite");
  const crewed = calculateRisk(signals, "crewed");
  assert.ok(crewed.probability >= satellite.probability);
});

test("each inference produces a complete ranked evidence trace", () => {
  const result = calculateRisk(
    { kp: 5.2, protonFlux: 2, xrayFlux: 2e-6 },
    "lunar",
  );
  assert.equal(result.contributions.length, 3);
  assert.ok(result.contributions[0].impact >= result.contributions[1].impact);
  assert.ok(result.recommendation.length > 20);
});
