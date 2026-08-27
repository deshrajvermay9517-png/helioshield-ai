# HelioShield AI — Architecture

## Design goal

Create a resilient, explainable decision-support surface that a judge can understand in under three minutes and that a mission operator can interrogate instead of blindly trusting.

## Runtime flow

1. The browser requests `/api/space-weather`.
2. The server adapter requests four public NOAA SWPC JSON feeds in parallel:
   - observed Planetary Kp;
   - forecast Planetary Kp;
   - GOES >=10 MeV proton flux;
   - GOES 0.1–0.8 nm X-ray flux.
3. Payloads are normalized into `SpaceWeatherSignals` and forecast windows.
4. If any upstream dependency fails, the adapter returns an explicitly labelled demo payload.
5. `calculateRisk()` transforms signals and mission profile into probability, decision, confidence, evidence contributions, and a control recommendation.
6. The same model evaluates each forecast Kp window and finds the minimum-risk opportunity.
7. The React console updates instantly for mission-profile, forecast-window, and scenario changes.

## Model equation

The prototype computes:

```text
z = -3.9
    + 4.2 * normalized(Kp)
    + 3.0 * normalized(log10(proton flux + 1))
    + 2.6 * normalized(log10(X-ray flux))
    + mission profile bias

risk probability = sigmoid(z)
```

Decision thresholds:

- `GO`: below 35%
- `CONDITIONAL`: 35–64%
- `HOLD`: 65% or above

The coefficients are prototype calibration values selected around NOAA alert thresholds, not learned flight-certification parameters.

## Resilience

- Upstream fetches use a short edge cache.
- Data-shape failures cannot crash the dashboard.
- Demo mode is visible in the header and evidence trace.
- The application requires no private credentials.

## Security and privacy

- No personal data is collected.
- No user input is persisted.
- No API keys are exposed to the browser.
- External source links open with safe `rel="noreferrer"` handling.

## Production roadmap

- Back-test on historical NOAA/NASA events and mission anomalies.
- Add uncertainty calibration and out-of-distribution detection.
- Add multi-source redundancy and data freshness alarms.
- Validate mission-specific thresholds with domain experts.
- Add signed decision logs and role-based approval.
