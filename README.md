# HelioShield AI

[![CI](https://github.com/deshrajvermay9517-png/helioshield-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/deshrajvermay9517-png/helioshield-ai/actions/workflows/ci.yml)

> Explainable AI that turns space-weather signals into safer, evidence-backed launch decisions.

HelioShield AI is a working proof of concept for the **August 2026 AI Builders Challenge with IBM Bob** under the **Advance Space Exploration with AI** theme.

**Live demo:** https://helioshield-ai.universboss9517.chatgpt.site

**GitHub repository:** https://github.com/deshrajvermay9517-png/helioshield-ai

It ingests public NOAA Space Weather Prediction Center signals, combines them with mission sensitivity, estimates launch risk with a transparent probabilistic model, explains the strongest risk drivers, and recommends a safer launch window. If NOAA is temporarily unavailable, the app switches to a clearly labelled demo-safe dataset so every judge can complete the product flow.

## Problem statement

Mission teams receive large volumes of specialized space-weather telemetry, but the operational question is simple and time-critical: **is this mission profile safe to launch now, and why?** Raw Kp, solar-proton, and X-ray measurements are difficult to interpret together, affect missions differently, and can create either hidden risk or unnecessary delays.

## Solution

HelioShield transforms those signals into a human-reviewable mission decision:

- **Mission-aware risk scoring** for satellite, lunar cargo, and crewed LEO profiles.
- **Explainable recommendations** with feature-level evidence and thresholds.
- **24-hour window comparison** to identify the lowest-risk launch opportunity.
- **Counterfactual scenario lab** for testing changing Kp, proton, and X-ray conditions.
- **Human-in-the-loop boundary** that keeps final authority with mission control.
- **Resilient demonstration mode** when live data cannot be reached.

## AI approach and architecture

The HS-XR v0.3 prototype is a transparent logistic classifier calibrated to published NOAA alert thresholds. It normalizes three signal families, applies mission-profile sensitivity, and outputs a risk probability and one of three decisions: `GO`, `CONDITIONAL`, or `HOLD`.

The explanation layer ranks feature contributions and generates an evidence-grounded mission brief. The forecast evaluator runs the same model across NOAA Kp forecast windows to produce a counterfactual recommendation.

```mermaid
flowchart LR
    A[NOAA SWPC feeds] --> B[Resilient data adapter]
    B --> C[HS-XR risk model]
    D[Mission profile] --> C
    C --> E[Risk + decision]
    C --> F[Evidence trace]
    C --> G[Window optimizer]
    E --> H[Mission console]
    F --> H
    G --> H
```

The model is intentionally inspectable and is **not flight-certified**. Operational use would require historical back-testing, calibration with mission outcomes, agency review, and redundant data sources.

## Selected challenge theme

**August Challenge — Advance Space Exploration with AI**

The project fits the theme by converting data-heavy space-weather feeds into actionable mission insight, improving safety and reliability while making complex space data understandable to both technical and non-technical stakeholders.

## How IBM Bob was used

IBM Bob was the primary development tool for the hardening and validation pass on this
repository, carried out on the `bob-hardening` branch. The work is recorded in
[`helioshield-hardening-plan.md`](helioshield-hardening-plan.md) and covers the
following prompts and outcomes:

**Prompt 1 — Plan mode** (`helioshield-hardening-plan.md`)\
Bob was asked to inspect `README.md`, `docs/ARCHITECTURE.md`, `docs/MODEL-CARD.md`,
`app/api/space-weather/route.ts`, `lib/risk-engine.ts`, and `app/page.tsx`, then
produce a concrete hardening plan without changing any files. Bob identified the
single-catch-all NOAA fetch as the primary resilience gap, the absence of data
freshness handling, the lack of model-equation verification tests, and zero direct
test coverage for the API adapter. The resulting plan was reviewed and approved before
any code was changed.

**Prompt 2 — Agent mode** (material implementation)\
Bob implemented all five sub-tasks from the approved plan on the `bob-hardening` branch:

1. **NOAA payload validation** — `app/api/space-weather/route.ts` was rewritten to
   validate each feed's HTTP status, `content-type` header, and payload shape
   independently using `validateTable` and `validateRecordArray` helpers. Errors are
   caught per-feed with `fetchKp` / `fetchRecords` wrappers.

2. **Per-signal degradation** — a failed feed now falls back only that signal to its
   default value. The response carries `mode: "live" | "partial" | "demo"` and a
   `degradedFeeds: string[]` list. The original all-or-nothing `try/catch` that
   replaced every signal on any failure was removed.

3. **Data freshness** — the route computes `ageMinutes` from `observedAt` vs wall
   clock and sets `dataQuality: "fresh" | "stale" | "unknown"` using a
   `STALE_THRESHOLD_MINUTES = 30` named constant. The source-pill in the mission
   console renders "NOAA live · stale data" or "NOAA partial (… degraded)" as
   appropriate. The evidence trace carries the stale age or degraded feed names.

4. **Model validation tests** — `tests/risk-engine-model.test.mjs` (new, 26 tests)
   verifies the published HS-XR v0.3 equation against three hand-calculated reference
   points, all six tone-transition boundaries (Kp, proton, X-ray), all three decision
   thresholds, the confidence clamp, the crewed ≥ lunar ≥ satellite risk ordering,
   and `buildMissionBrief` output for every decision × profile × source-label
   combination.

5. **API adapter tests** — `tests/space-weather-api.test.mjs` (new, 7 tests) covers
   all-feeds-healthy, per-feed HTTP 500 degradation, malformed-JSON degradation,
   all-feeds-fail demo fallback, stale-timestamp detection, and failed-forecast
   fallback — all without live network I/O, using `globalThis.fetch` mocking.

**Verified results on the `bob-hardening` branch:**

- `node --test tests/risk-engine.test.mjs tests/risk-engine-model.test.mjs tests/space-weather-api.test.mjs` — **37 pass, 0 fail**
- ESLint on changed and new files — **0 errors, 0 warnings**
- TypeScript (`tsc --noEmit`) — **0 new errors** introduced; 4 pre-existing
  Cloudflare Worker typing errors on `db/index.ts` and `worker/index.ts` were
  present on `main` before this session and are unchanged
- `npm run build` requires the ChatGPT Sites Linux CI environment (`bash`, `vinext`,
  GNU `timeout`) and cannot be run on the local Windows machine; the build is
  verified by the CI pipeline on push

The two tests that require the `dist/` build artefact (`rendered-html.test.mjs` and
the CSS scan in `ui-components.test.mjs`) were already failing on `main` for the same
reason before this session; no regression was introduced.

## Product flow

1. Choose a mission profile.
2. Refresh NOAA observations or continue in labelled demo-safe mode.
3. Inspect the risk probability, decision, and evidence trace.
4. Select forecast windows to compare risk.
5. Open **Scenario lab** and stress-test the launch envelope.

## Data sources

- [NOAA Planetary K-index](https://www.swpc.noaa.gov/products/planetary-k-index)
- [NOAA GOES Proton Flux](https://www.swpc.noaa.gov/products/goes-proton-flux)
- [NOAA GOES X-ray Flux](https://www.swpc.noaa.gov/products/goes-x-ray-flux)
- [NOAA SWPC Data Access](https://www.swpc.noaa.gov/content/data-access)

## Technology

- Next.js-compatible Vinext + React + TypeScript
- Cloudflare Worker server runtime
- NOAA SWPC JSON data feeds
- Transparent logistic risk model and counterfactual window optimizer
- Shadcn/Radix accessible controls
- IBM Bob for the required development, review, testing, and documentation pass

## Full-stack scope

HelioShield is a **frontend-heavy full-stack prototype**, not a frontend-only mockup.

- **Frontend:** the React mission console, explainable score cards, forecast-window selector, and Scenario Lab in `app/page.tsx`.
- **Backend:** the server-side `/api/space-weather` route fetches and normalizes NOAA feeds, keeps upstream calls away from the browser, and returns a safe labelled fallback when a feed is unavailable.
- **Shared intelligence:** `lib/risk-engine.ts` computes the mission-aware probability, decision, evidence contributions, and safer window.
- **Persistence:** no database, account system, or stored personal data is needed for this proof of concept.
- **Hosting:** the production build runs on a Cloudflare Worker-compatible runtime through ChatGPT Sites.

## Local setup

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
npm test
```

No API key is required. The server route fetches public NOAA data and automatically returns labelled demo-safe values if the source is unavailable.

## Repository map

```text
app/page.tsx                          Mission console and interactions
app/api/space-weather/route.ts        NOAA adapter — per-feed validation, freshness, partial mode
lib/risk-engine.ts                    Explainable probability model
tests/risk-engine.test.mjs            Behavioural risk-engine tests
tests/risk-engine-model.test.mjs      Model-equation and threshold validation tests (new)
tests/space-weather-api.test.mjs      API adapter unit tests with fetch mocking (new)
tests/rendered-html.test.mjs          Full-worker HTML smoke test (requires CI build)
tests/ui-components.test.mjs          CSS and component tests (requires CI build)
helioshield-hardening-plan.md         Bob Plan-mode hardening plan
docs/ARCHITECTURE.md                  Technical design and decisions
docs/MODEL-CARD.md                    Model behavior, thresholds, limits
docs/IBM-BOB-HANDOFF.md              IBM Bob workflow record
docs/DEMO-SCRIPT.md                   Timed public-video script
docs/SUBMISSION.md                    Copy-ready challenge submission
docs/SUBMISSION-CHECKLIST.md          Exact remaining owner actions
```

## Responsible AI

- Inputs and thresholds are visible.
- Demo data is explicitly labelled.
- Every decision includes evidence.
- The UI states that the tool is decision support, not certification.
- Mission control retains final authority.

## Team

**Deshraj Verma** — Student developer, B.Tech CSE, IILM University

## License

MIT — see [`LICENSE`](LICENSE).
