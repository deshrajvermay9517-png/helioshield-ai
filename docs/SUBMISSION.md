# Copy-ready challenge submission

## Project name

HelioShield AI

## Tagline

Explainable AI for safer, evidence-backed launch decisions.

## Short description

HelioShield turns NOAA space-weather signals and mission context into explainable launch risk, safer windows, and actionable controls.

## Selected challenge

August Challenge — Advance Space Exploration with AI

## Problem

Space-weather telemetry is data-rich but operationally difficult to interpret under time pressure. Geomagnetic disturbance, solar radiation, and flare activity affect mission profiles differently. Teams need a fast way to understand combined risk, the evidence behind it, and whether waiting creates a safer opportunity.

## Solution

HelioShield AI is a mission-safety copilot that ingests public NOAA signals, applies a transparent mission-aware probability model, and returns a GO, CONDITIONAL, or HOLD recommendation. It explains every driver, finds the lowest-risk forecast window, and includes a Scenario Lab for counterfactual planning. A labelled demo-safe mode keeps the prototype reviewable when upstream data is unavailable.

## What makes it innovative

Most dashboards stop at visualization. HelioShield closes the gap between telemetry and action: it makes one mission-specific recommendation, shows the complete evidence trace, and calculates a safer alternative. Its counterfactual lab lets operators understand how and why the decision changes rather than trusting a black box.

## AI approach

HS-XR v0.3 is a transparent logistic risk model calibrated around NOAA alert thresholds. It normalizes Planetary Kp, >=10 MeV proton flux, and GOES X-ray flux, then adjusts the inference for satellite, lunar-cargo, or crewed-LEO sensitivity. A feature-contribution layer ranks the drivers and generates an evidence-grounded mission brief. The same model evaluates forecast windows to recommend the lowest-risk option.

## Feasibility and impact

The prototype requires no proprietary sensor network or API key. It uses public operational data, runs at the edge, degrades safely, and can be extended with mission telemetry, debris conjunctions, and launch-site weather. In production, it could reduce analyst workload, surface hidden risk earlier, and make mission decisions easier to audit and communicate.

## Responsible AI

HelioShield exposes inputs, thresholds, data mode, model limitations, and evidence. It never claims flight certification or autonomous authority. Mission control retains the final decision.

## Public links

- Demo: https://helioshield-ai.universboss9517.chatgpt.site
- GitHub: https://github.com/deshrajvermay9517-png/helioshield-ai
- Video (maximum 3 minutes): `[ADD PUBLIC VIDEO URL]`

## Team

Deshraj Verma — B.Tech CSE student, IILM University

## IBM Bob usage

`[REPLACE WITH THE TRUE COMPLETED BOB WORK FROM docs/IBM-BOB-HANDOFF.md]`

## Suggested tags

AI · SpaceTech · Explainable AI · Decision Support · NOAA · Mission Safety · React · TypeScript · IBM Bob
