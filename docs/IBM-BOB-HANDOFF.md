# Required IBM Bob completion pass

The challenge requires IBM Bob to be the primary development tool. This file makes the remaining work concrete and auditable. Complete it **inside IBM Bob before publishing the GitHub repository or submitting**.

## Evidence to keep

- screenshot of Bob Plan mode and approved plan;
- screenshot of Bob Agent mode making material repository changes;
- Bob-generated test/build output;
- commit(s) containing the Bob-authored or Bob-refactored work;
- concise list of prompts and accepted changes in the README.

Do not fabricate screenshots, prompts, or claims.

## Prompt 1 — Plan mode

```text
You are the technical lead for HelioShield AI, an August AI Builders Challenge project.
Inspect README.md, docs/ARCHITECTURE.md, docs/MODEL-CARD.md, app/api/space-weather/route.ts,
lib/risk-engine.ts, and app/page.tsx. Create a concrete plan to harden the NOAA adapter,
validate the explainable risk model, improve test coverage, and preserve the current UI.
Call out safety boundaries and challenge judging criteria. Do not change files yet.
```

Approve the plan only after it contains repository-specific tasks.

## Prompt 2 — Agent mode (material implementation)

```text
Implement the approved HelioShield plan. At minimum:
1. add runtime validation for every NOAA payload and data freshness;
2. make partial upstream failure degrade per signal instead of replacing every signal;
3. add tests for quiet, threshold, severe, and mission-profile risk ordering;
4. expose any new freshness or quality information in the evidence trace;
5. keep the no-secret deployment and accessible interactions intact.
Run the tests and production build, fix failures, and summarize every changed file.
```

## Prompt 3 — Ask mode (review)

```text
Review this repository as an IBM hackathon judge. Evaluate technical execution,
innovation, challenge fit, feasibility, real-world impact, responsible AI, and demo clarity.
Identify the three highest-impact changes still needed. Cite exact files and functions.
```

Implement only specific, valid findings.

## Prompt 4 — Documentation pass

```text
Update README.md and docs/MODEL-CARD.md so they accurately describe the final code.
Add a truthful "How IBM Bob was used" record with the exact planning, implementation,
testing, and documentation tasks completed in this session. Do not invent metrics or claims.
```

## Final checklist

- [ ] Bob Plan mode completed and screenshot saved
- [ ] Bob Agent mode made material code/test changes
- [ ] `npm test` passes in Bob
- [ ] `npm run build` passes in Bob
- [ ] README Bob section describes actual work
- [ ] Bob evidence is visible in the demo video or repository
- [ ] No placeholder wording remains
