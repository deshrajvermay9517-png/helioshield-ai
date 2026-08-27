# HelioShield AI — Hardening & Validation Plan

## Overview

This plan hardens the NOAA data adapter, improves partial-feed failure behavior,
validates the explainable risk model, expands automated test coverage, and preserves
the existing working UI and Cloudflare Worker deployment — all without changing the
challenge submission scope or flight-safety boundary.

The work is split into five independently reviewable sub-tasks, ordered so each
one builds on the previous.

---

## Safety & judging-criteria context

**Safety boundary (non-negotiable across all sub-tasks):**
Every change must keep the explicit "prototype / not flight-certified" labels intact
in the UI, MODEL-CARD.md, and ARCHITECTURE.md. The human-in-the-loop disclaimer in
`app/page.tsx` must never be removed or weakened.

**August AI Builders Challenge judging criteria addressed:**
- Technical execution → sub-tasks 1 and 2 (adapter hardening, partial failure)
- Feasibility & real-world impact → sub-task 3 (model validation proves the math)
- Innovation → sub-tasks 2 and 4 (per-signal degradation, freshness in evidence trace)
- Responsible AI → sub-task 3 (confidence bounds are honest), sub-task 5 (UI preserved)
- Demo clarity → sub-task 4 (tests green in front of a judge; freshness label visible)

---

## Sub-task 1 — Harden the NOAA payload adapter

**Status:** `[ ] pending`

### Intent

`app/api/space-weather/route.ts` currently uses a single `try/catch` around all four
`Promise.all` fetches. Any single bad response, including a 200 with unexpected JSON,
silently falls through to the demo fallback with no indication of what failed. The goal
is to add explicit runtime shape validation so that:

- malformed payloads are rejected before they reach `parseKpTable` or the signal map;
- clearly labeled `null` is returned per-feed rather than corrupting a sibling signal;
- error context (which feed, why) is captured without being exposed to the browser.

### Expected Outcomes

- `parseKpTable` receives only well-shaped arrays; a malformed payload throws a typed
  error with the feed name in the message.
- `readJson` validates HTTP status and content-type header before calling `.json()`.
- A non-array proton or x-ray payload returns `null` for that feed and falls back to
  the default value, not to full demo mode.
- The response always contains `mode: "live"` when at least one real signal was obtained.

### Todo List

1. Add a `validateArray(payload, feedName)` helper that throws a descriptive error if
   the value is not a non-empty array.
2. Extend `readJson` to assert `content-type` contains `application/json` before parsing.
3. Wrap each of the four feed parsers individually so a failure in one does not abort
   the others.
4. Return `mode: "partial"` (new value) alongside `mode: "live"` | `"demo"` when one
   or more feeds degraded to their default value.
5. Expose which feeds degraded in the response object (e.g. `degradedFeeds: string[]`)
   so the evidence trace can display it.

### Relevant Context

- [`app/api/space-weather/route.ts`](app/api/space-weather/route.ts:53) — `GET` handler,
  `readJson`, `parseKpTable`, `pickLatest`.
- [`app/page.tsx`](app/page.tsx:46-50) — `WeatherPayload` type must be extended to
  include the new `mode` value and `degradedFeeds` field.
- Architecture note: runs in a Cloudflare Worker; `console.error` is the only safe
  logging surface (no file system, no external log sink).

---

## Sub-task 2 — Add data freshness validation and stale-data labelling

**Status:** `[ ] pending`

### Intent

The API currently returns `observedAt` as a timestamp string but the UI never checks
whether that timestamp is recent. During a NOAA maintenance window, the 180-second
Cloudflare edge cache could serve a 3-minute-old snapshot indefinitely. The goal is
to detect and surface stale data so operators have a clear signal quality indicator.

### Expected Outcomes

- The API computes an `ageMinutes` field on every response, derived from the best
  available timestamp vs. `Date.now()`.
- If `ageMinutes` exceeds a defined threshold (suggest 30 minutes for NOAA operational
  feeds), the response sets `dataQuality: "stale"`.
- `app/page.tsx` renders a visible stale-data warning in the source-pill header element
  when `dataQuality === "stale"`, distinct from demo mode.
- The evidence trace in `buildMissionBrief` includes the age or quality flag when stale.

### Todo List

1. In the API route, parse `observedAt` to a `Date` and compute `ageMinutes`.
2. Add `dataQuality: "fresh" | "stale" | "unknown"` to the response shape.
3. Set `dataQuality: "unknown"` for demo mode (no real timestamp) and `"stale"` when
   `ageMinutes > 30` in live or partial mode.
4. Extend `WeatherPayload` in `app/page.tsx` to include `ageMinutes` and `dataQuality`.
5. Add a `"stale"` branch in the source-pill rendering logic next to the existing
   `"live"` and `"demo"` branches (CSS class + label).
6. Pass the stale flag into `buildMissionBrief` via its `sourceLabel` argument so the
   evidence trace is self-describing.

### Relevant Context

- [`app/api/space-weather/route.ts`](app/api/space-weather/route.ts:76-87) — response
  object construction block.
- [`app/page.tsx`](app/page.tsx:175-178) — source-pill rendering.
- [`lib/risk-engine.ts`](lib/risk-engine.ts:131-152) — `buildMissionBrief` `sourceLabel`
  parameter.
- The 30-minute threshold is conservative relative to NOAA's ~1-minute feed cadence;
  it should be a named constant, not a magic number.

---

## Sub-task 3 — Validate the explainable risk model

**Status:** `[ ] pending`

### Intent

`lib/risk-engine.ts` contains the HS-XR v0.3 model equation documented in
`docs/ARCHITECTURE.md`. There are currently no tests that verify the published
coefficient math, the NOAA alert-threshold crossing points, or the `confidence`
formula edge cases. Validating these does not require changing the model — it
creates a reproducible record that the implementation matches the documented design.

### Expected Outcomes

- Tests confirm that the published GO/CONDITIONAL/HOLD threshold crossings occur at
  the correct `probability` values (35 and 65).
- Tests confirm that Kp ≥ 5 produces a `"high"` tone for geomagnetic contribution,
  Kp 4–4.9 produces `"medium"`, and Kp < 4 produces `"low"`.
- Tests confirm that proton flux ≥ 10 pfu triggers the S1-level explanation text.
- Tests confirm that X-ray flux ≥ 1e-5 triggers the M-class explanation text.
- Tests confirm the `confidence` range is always 76–94.
- Tests confirm that `buildMissionBrief` produces non-empty `headline`, `body`, and
  at least four `evidence` items for every combination of decision × profile.
- The model equation itself (intercept, weights, normalizations) is verified against at
  least three hand-calculated reference points from the ARCHITECTURE.md formula.

### Todo List

1. Add a new test file `tests/risk-engine-model.test.mjs` (keep it separate from the
   existing behavioral tests).
2. Add three reference-point tests: one quiet (Kp=1, pfu=0.1, xray=1e-8), one threshold
   (Kp=5, pfu=10, xray=1e-5 for each mission profile), one severe.
3. Add tone-transition boundary tests at exactly Kp=4, Kp=5, proton=5, proton=10,
   xray=1e-6, xray=1e-5.
4. Add `confidence` clamp tests: inputs that should produce 94, 76, and a mid-range value.
5. Add `buildMissionBrief` coverage: all three decisions, all three profiles, both
   source label variants.
6. Update `tests/risk-engine.test.mjs` with the crewed > lunar > satellite ordering
   assertion (currently only crewed ≥ satellite is tested).

### Relevant Context

- [`lib/risk-engine.ts`](lib/risk-engine.ts:48-129) — `calculateRisk` implementation.
- [`lib/risk-engine.ts`](lib/risk-engine.ts:131-152) — `buildMissionBrief`.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md:22-41) — published model equation and
  decision thresholds.
- [`tests/risk-engine.test.mjs`](tests/risk-engine.test.mjs) — existing four tests
  (behavioral, not model-math).
- The test runner is Node.js built-in `node:test`; imports use Vite SSR loader via
  `vite.ssrLoadModule`. Match the existing test file pattern exactly.

---

## Sub-task 4 — Expand automated test coverage for the API adapter

**Status:** `[ ] pending`

### Intent

`app/api/space-weather/route.ts` has zero direct test coverage. The only adapter
exercise today is the end-to-end `rendered-html.test.mjs` which tests the full worker
build rather than the adapter logic. The goal is to add a unit-level test file that
exercises the adapter's normalization, partial-failure degradation (from sub-task 1),
freshness logic (from sub-task 2), and demo-mode fallback without requiring a live
NOAA connection.

### Expected Outcomes

- A new file `tests/space-weather-api.test.mjs` that uses `globalThis.fetch` mocking
  via `node:test`'s `mock.method` to intercept NOAA calls without network access.
- Tests cover: all four feeds healthy → `mode: "live"`, `dataQuality: "fresh"`.
- Tests cover: one feed returns HTTP 500 → response degrades that signal to default,
  `mode: "partial"`, `degradedFeeds` lists the failed feed name.
- Tests cover: one feed returns malformed JSON → same partial degradation path.
- Tests cover: all feeds fail → `mode: "demo"`, canonical demo signal values.
- Tests cover: `observedAt` timestamp older than 30 minutes → `dataQuality: "stale"`.
- All tests run with `node --test tests/*.test.mjs` without network I/O.

### Todo List

1. Identify the correct import path for the route handler given the Vite SSR loader
   (match `tests/risk-engine.test.mjs` pattern).
2. Write a `mockFetch(responses)` helper that patches `globalThis.fetch` for a single
   test and restores it in `after()`.
3. Implement the healthy-feeds test case.
4. Implement the single-feed-HTTP-error degradation test.
5. Implement the malformed-JSON degradation test.
6. Implement the all-feeds-fail full-demo test.
7. Implement the stale timestamp test (set `observedAt` to `Date.now() - 35 * 60 * 1000`).
8. Ensure all new tests pass alongside the existing suite under `node --test tests/*.test.mjs`.

### Relevant Context

- [`app/api/space-weather/route.ts`](app/api/space-weather/route.ts) — the module under
  test; its `GET` export returns a `Response`.
- [`tests/risk-engine.test.mjs`](tests/risk-engine.test.mjs:1-16) — Vite SSR loader
  setup to replicate.
- The Cloudflare Worker `cf` property on `RequestInit` is a non-standard extension;
  `readJson` should handle environments where it is silently ignored (Node.js `fetch`
  ignores unknown init properties, so no special handling needed).
- No real NOAA network calls must occur in tests; the `mockFetch` approach must be set
  up before the module is imported or the function is called.

---

## Sub-task 5 — Preserve the working UI and deployment

**Status:** `[ ] pending`

### Intent

Sub-tasks 1–4 change the API response shape (`mode`, `degradedFeeds`, `ageMinutes`,
`dataQuality`) and add a new test file. This sub-task ensures that every existing
UI interaction, accessibility attribute, and production build still works after those
changes are applied.

### Expected Outcomes

- `app/page.tsx` `WeatherPayload` type is updated to match the new API shape.
- The source-pill correctly renders `"live"`, `"demo"`, and new `"stale"` / `"partial"`
  states with no TypeScript errors.
- The evidence trace shows the updated source label when data is stale or partial.
- `npm run build` completes with no new TypeScript or lint errors.
- `npm test` (which runs the build and all three test files) passes green.
- The fallback `fallbackData` in `app/page.tsx` is updated to satisfy the new type
  (add `ageMinutes: 0`, `dataQuality: "unknown"`, `degradedFeeds: []`).
- No existing UI sections, interactions, accessible labels, or layout classes are
  removed or broken.

### Todo List

1. Update the `WeatherPayload` type in `app/page.tsx` to include `degradedFeeds`,
   `ageMinutes`, and `dataQuality`.
2. Update `fallbackData` to include the new fields with safe defaults.
3. Add the `"stale"` CSS class and label to the source-pill conditional block.
4. Verify `buildMissionBrief` receives the enriched source label for stale/partial modes.
5. Run `npm run build` and resolve any TypeScript errors caused by the type extension.
6. Run `npm test` end-to-end; confirm all tests in all three files pass.
7. Manually review that the `rendered-html.test.mjs` still passes (it exercises the
   full worker path and will catch any runtime break in the route handler).

### Relevant Context

- [`app/page.tsx`](app/page.tsx:46-61) — `WeatherPayload` type and `fallbackData`.
- [`app/page.tsx`](app/page.tsx:175-178) — source-pill render block.
- [`tests/rendered-html.test.mjs`](tests/rendered-html.test.mjs) — full worker smoke test.
- [`tests/ui-components.test.mjs`](tests/ui-components.test.mjs) — CSS and component
  tests; must not regress.
- Deployment target is a Cloudflare Worker via `vinext`; the build script is
  `scripts/build-verified.sh`. Do not change build tooling.

---

## Non-goals (out of scope for this plan)

- Changing the model coefficients, intercept, or decision thresholds.
- Adding a database, authentication, or persistent storage.
- Replacing NOAA feeds with paid or private data sources.
- Changing the demo-safe values (they are part of the submission identity).
- Modifying `docs/SUBMISSION.md`, `docs/SUBMISSION-CHECKLIST.md`, or the live demo URL.
- Adding any analytics, tracking, or user-data collection.
