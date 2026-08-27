/**
 * tests/space-weather-api.test.mjs
 *
 * Unit tests for app/api/space-weather/route.ts.
 *
 * All tests mock globalThis.fetch so no real NOAA network I/O occurs.
 * The route module is loaded via the Vite SSR loader to match how it
 * runs inside the Cloudflare Worker — consistent with other test files.
 */
import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
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

// Load the route handler once; fetch is called at invoke-time, not import-time.
const { GET } = await vite.ssrLoadModule("/app/api/space-weather/route.ts");

// ─── canonical fixture data ───────────────────────────────────────────────────

// A recent timestamp so freshness tests pass cleanly
const freshTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago

const KP_TABLE = JSON.stringify([
  ["time_tag", "Kp"],
  [freshTimestamp, "2.7"],
  [freshTimestamp, "3.1"],
]);

const FORECAST_TABLE = JSON.stringify([
  ["time_tag", "Kp"],
  [new Date(Date.now() + 1 * 3600 * 1000).toISOString(), "3.4"],
  [new Date(Date.now() + 4 * 3600 * 1000).toISOString(), "4.1"],
  [new Date(Date.now() + 7 * 3600 * 1000).toISOString(), "3.8"],
]);

const PROTON_ROWS = JSON.stringify([
  { time_tag: freshTimestamp, energy: ">=10 MeV", flux: 0.82 },
]);

const XRAY_ROWS = JSON.stringify([
  { time_tag: freshTimestamp, energy: "0.1-0.8 nm", flux: 4.6e-7 },
]);

// ─── mock helpers ─────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

/**
 * Build a mock fetch that maps URL path substrings to response bodies.
 * Pass null as the body to simulate an HTTP 500 for that URL.
 * Unmatched URLs always return HTTP 500.
 */
function buildMockFetch(urlBodyMap) {
  return async (url) => {
    const urlStr = String(url);
    for (const [key, body] of Object.entries(urlBodyMap)) {
      if (urlStr.includes(key)) {
        if (body === null) {
          return new Response("Internal Server Error", { status: 500 });
        }
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response("Not found", { status: 500 });
  };
}

beforeEach(() => {
  // Restore original fetch before each test so leaks from previous tests
  // are never silently carried forward.
  globalThis.fetch = originalFetch;
});

// ─── test 1: all feeds healthy ────────────────────────────────────────────────

test("all feeds healthy → mode=live, dataQuality=fresh, degradedFeeds=[]", async () => {
  globalThis.fetch = buildMockFetch({
    "noaa-planetary-k-index.json":          KP_TABLE,
    "noaa-planetary-k-index-forecast.json": FORECAST_TABLE,
    "integral-protons-6-hour.json":         PROTON_ROWS,
    "xrays-6-hour.json":                    XRAY_ROWS,
  });

  const response = await GET();
  const body = await response.json();

  assert.equal(body.mode, "live");
  assert.equal(body.dataQuality, "fresh");
  assert.deepEqual(body.degradedFeeds, []);
  assert.ok(typeof body.ageMinutes === "number");
  assert.ok(body.ageMinutes >= 0 && body.ageMinutes <= 10,
    `ageMinutes should be ~5, got ${body.ageMinutes}`);
  assert.ok(Array.isArray(body.forecast) && body.forecast.length > 0);
  assert.ok(typeof body.signals.kp === "number");
  assert.ok(typeof body.signals.protonFlux === "number");
  assert.ok(typeof body.signals.xrayFlux === "number");
});

// ─── test 2: single feed HTTP 500 → partial degradation ──────────────────────

test("xrays feed HTTP 500 → mode=partial, xrays in degradedFeeds, other signals live", async () => {
  globalThis.fetch = buildMockFetch({
    "noaa-planetary-k-index.json":          KP_TABLE,
    "noaa-planetary-k-index-forecast.json": FORECAST_TABLE,
    "integral-protons-6-hour.json":         PROTON_ROWS,
    "xrays-6-hour.json":                    null, // 500
  });

  const response = await GET();
  const body = await response.json();

  assert.equal(body.mode, "partial");
  assert.ok(body.degradedFeeds.includes("xrays"),
    `Expected degradedFeeds to include "xrays", got ${JSON.stringify(body.degradedFeeds)}`);
  // Other signals should still be live values
  assert.ok(typeof body.signals.kp === "number");
  // xrayFlux falls back to default
  assert.equal(body.signals.xrayFlux, 4.6e-7);
});

// ─── test 3: protons feed HTTP 500 → partial degradation ─────────────────────

test("protons feed HTTP 500 → mode=partial, protons in degradedFeeds", async () => {
  globalThis.fetch = buildMockFetch({
    "noaa-planetary-k-index.json":          KP_TABLE,
    "noaa-planetary-k-index-forecast.json": FORECAST_TABLE,
    "integral-protons-6-hour.json":         null, // 500
    "xrays-6-hour.json":                    XRAY_ROWS,
  });

  const response = await GET();
  const body = await response.json();

  assert.equal(body.mode, "partial");
  assert.ok(body.degradedFeeds.includes("protons"),
    `Expected "protons" in degradedFeeds, got ${JSON.stringify(body.degradedFeeds)}`);
  assert.equal(body.signals.protonFlux, 0.82); // default value
});

// ─── test 4: malformed JSON → partial degradation ────────────────────────────

test("kp feed returns malformed JSON array → partial degradation for kp", async () => {
  globalThis.fetch = buildMockFetch({
    // Only one row — fails validateTable (needs at least 2)
    "noaa-planetary-k-index.json":          JSON.stringify([["time_tag", "Kp"]]),
    "noaa-planetary-k-index-forecast.json": FORECAST_TABLE,
    "integral-protons-6-hour.json":         PROTON_ROWS,
    "xrays-6-hour.json":                    XRAY_ROWS,
  });

  const response = await GET();
  const body = await response.json();

  assert.equal(body.mode, "partial");
  assert.ok(body.degradedFeeds.includes("kp"),
    `Expected "kp" in degradedFeeds, got ${JSON.stringify(body.degradedFeeds)}`);
  // Kp falls back to default 2.7
  assert.equal(body.signals.kp, 2.7);
});

// ─── test 5: all feeds fail → full demo mode ──────────────────────────────────

test("all feeds fail → mode=demo, canonical demo signals", async () => {
  globalThis.fetch = buildMockFetch({}); // no URL matches → all 500

  const response = await GET();
  const body = await response.json();

  assert.equal(body.mode, "demo");
  assert.equal(body.signals.kp, 3.4);
  assert.equal(body.signals.protonFlux, 0.82);
  assert.equal(body.signals.xrayFlux, 4.6e-7);
  assert.equal(body.dataQuality, "unknown");
  assert.equal(body.degradedFeeds.length, 4);
});

// ─── test 6: stale timestamp → dataQuality=stale ─────────────────────────────

test("observedAt older than 30 min → dataQuality=stale", async () => {
  const staleTimestamp = new Date(Date.now() - 35 * 60 * 1000).toISOString();

  const staleKpTable = JSON.stringify([
    ["time_tag", "Kp"],
    [staleTimestamp, "3.1"],
  ]);
  const staleXray = JSON.stringify([
    { time_tag: staleTimestamp, energy: "0.1-0.8 nm", flux: 4.6e-7 },
  ]);
  const staleProton = JSON.stringify([
    { time_tag: staleTimestamp, energy: ">=10 MeV", flux: 0.82 },
  ]);

  globalThis.fetch = buildMockFetch({
    "noaa-planetary-k-index.json":          staleKpTable,
    "noaa-planetary-k-index-forecast.json": FORECAST_TABLE,
    "integral-protons-6-hour.json":         staleProton,
    "xrays-6-hour.json":                    staleXray,
  });

  const response = await GET();
  const body = await response.json();

  assert.equal(body.mode, "live");
  assert.equal(body.dataQuality, "stale",
    `Expected stale, got ${body.dataQuality} (ageMinutes: ${body.ageMinutes})`);
  assert.ok(body.ageMinutes >= 35,
    `Expected ageMinutes >= 35, got ${body.ageMinutes}`);
});

// ─── test 7: forecast feed fails → partial, falls back to demo forecast ───────

test("forecast feed fails → mode=partial, returns demo forecast shape", async () => {
  globalThis.fetch = buildMockFetch({
    "noaa-planetary-k-index.json":          KP_TABLE,
    "noaa-planetary-k-index-forecast.json": null, // 500
    "integral-protons-6-hour.json":         PROTON_ROWS,
    "xrays-6-hour.json":                    XRAY_ROWS,
  });

  const response = await GET();
  const body = await response.json();

  assert.equal(body.mode, "partial");
  assert.ok(body.degradedFeeds.includes("forecast"));
  assert.ok(Array.isArray(body.forecast) && body.forecast.length > 0,
    "forecast should fall back to demo values, not be empty");
  // Verify forecast shape
  for (const w of body.forecast) {
    assert.ok(typeof w.time === "string");
    assert.ok(typeof w.kp === "number");
  }
});
