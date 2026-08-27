# Model card — HS-XR v0.3

## Intended use

Educational proof of concept for comparing how space-weather conditions may affect different launch profiles. It supports exploration, explanation, and early mission planning.

## Out-of-scope use

The model must not be used as flight certification, an autonomous launch authority, or a replacement for agency procedures and domain experts.

## Inputs

| Feature | Range | Meaning |
| --- | ---: | --- |
| Planetary Kp | 0–9 | Global geomagnetic disturbance |
| >=10 MeV proton flux | 0+ pfu | Solar radiation environment |
| GOES X-ray flux | W/m2 | Solar-flare and radio-blackout proxy |
| Mission profile | 3 categories | Relative sensitivity bias |

## Outputs

- 0–100 mission-risk probability
- GO / CONDITIONAL / HOLD recommendation
- ranked feature contribution trace
- strongest-driver explanation
- mitigation or delay recommendation

## Explainability

The model exposes the normalized feature weights used in each inference. The mission brief is generated only from the resulting decision and evidence; it does not introduce unsupported external facts.

## Limitations

- Prototype coefficients are threshold-calibrated rather than trained on labelled mission outcomes.
- NOAA feeds may be unavailable or delayed.
- Kp forecasts do not cover every launch hazard.
- Weather at the physical launch site, vehicle telemetry, debris conjunctions, and mission-specific constraints are not included.
- Confidence is a prototype communication value, not statistical calibration.

## Responsible-AI controls

- human decision authority is explicit;
- data mode is visible;
- fallback data is labelled;
- limitations are present in the product and repository;
- counterfactual controls help users understand model sensitivity.
