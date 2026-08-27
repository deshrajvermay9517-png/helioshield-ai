# HelioShield AI — 2:45 demo script

Target length: **2 minutes 45 seconds**. Record at 1080p, keep the cursor visible, and use the live site. If the header says Demo-safe mode, say so explicitly.

## 0:00–0:18 — The problem

**Screen:** Full dashboard, no interaction.

**Narration:** “Space missions depend on specialized weather signals, but launch teams need a fast, defensible answer: should this mission launch now, and why? HelioShield AI turns raw space-weather telemetry into an explainable, mission-aware decision.”

## 0:18–0:38 — Data and challenge fit

**Screen:** Point to the source status, signal cards, and data-source links.

**Narration:** “The system ingests NOAA Planetary Kp, GOES proton flux, X-ray flux, and the Kp forecast. If an upstream feed fails, it enters a clearly labelled demo-safe mode, so the interface never hides data quality.”

## 0:38–1:08 — AI decision

**Screen:** Choose Satellite deployment, then Crewed LEO. Pause on the changing score and decision.

**Narration:** “Our transparent HS-XR model combines those signals with mission sensitivity. The same environment can be acceptable for a satellite but require tighter controls for a crewed mission. Every output includes probability, decision, confidence, the strongest risk driver, and a recommended control.”

## 1:08–1:30 — Explainability

**Screen:** Point to the evidence trace and signal explanations.

**Narration:** “HelioShield is designed for trust. Operators can see the exact measurements behind the decision, why each matters, and whether the data is live or simulated. The system advises; mission control always retains final authority.”

## 1:30–1:55 — Safer launch window

**Screen:** Click two forecast-window cards, ending on the BEST card.

**Narration:** “The window optimizer runs the same model across the forecast and recommends the lowest-risk opportunity. Selecting any window immediately recalculates the whole mission brief, turning a warning into an actionable alternative.”

## 1:55–2:22 — Scenario lab

**Screen:** Open Scenario lab. Raise Kp past 5 and proton flux past 10, then lower them.

**Narration:** “In Scenario Lab, planners can stress-test the launch envelope. Raising Kp and radiation crosses published operational thresholds and moves the decision from GO to CONDITIONAL or HOLD. This counterfactual view helps teams plan mitigations before conditions change.”

## 2:22–2:38 — IBM Bob

**Screen:** Show a brief Bob screenshot or Bob-generated commit/test evidence, then return to the app.

**Narration template—replace brackets with facts:** “IBM Bob was our development partner for [planning], [material code or test work], and [verification/documentation]. It helped us [specific repository outcome], while we reviewed and approved every change.”

## 2:38–2:45 — Close

**Screen:** Return to risk decision.

**Narration:** “HelioShield AI: from space data to safer mission decisions.”
