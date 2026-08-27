"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BrainCircuit,
  Check,
  CircleDot,
  CloudSun,
  Database,
  ExternalLink,
  Gauge,
  Info,
  Orbit,
  Radio,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Sparkles,
  Sun,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildMissionBrief,
  calculateRisk,
  type MissionProfile,
  type SpaceWeatherSignals,
} from "@/lib/risk-engine";

type ForecastWindow = { time: string; kp: number };
type WeatherPayload = {
  mode: "live" | "demo";
  observedAt: string;
  signals: SpaceWeatherSignals;
  forecast: ForecastWindow[];
};

const fallbackData: WeatherPayload = {
  mode: "demo",
  observedAt: "",
  signals: { kp: 3.4, protonFlux: 0.82, xrayFlux: 4.6e-7 },
  forecast: [3.4, 4.1, 3.8, 2.9, 2.4, 2.1, 2.8, 3.2].map((kp, index) => ({
    time: new Date(Date.UTC(2026, 7, 27, index * 3)).toISOString(),
    kp,
  })),
};

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: false,
      }).format(date);
};

const decisionClass = (decision: string) =>
  decision === "GO" ? "go" : decision === "HOLD" ? "hold" : "conditional";

async function getWeatherPayload() {
  const response = await fetch("/api/space-weather", { cache: "no-store" });
  if (!response.ok) throw new Error("Space-weather service unavailable");
  return (await response.json()) as WeatherPayload;
}

export default function Home() {
  const [weather, setWeather] = useState<WeatherPayload>(fallbackData);
  const [profile, setProfile] = useState<MissionProfile>("satellite");
  const [selectedWindow, setSelectedWindow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [simulated, setSimulated] = useState<SpaceWeatherSignals>(fallbackData.signals);

  const loadWeather = async () => {
    try {
      const payload = await getWeatherPayload();
      setWeather(payload);
      setSimulated(payload.signals);
      setSelectedWindow(0);
    } catch {
      setWeather(fallbackData);
      setSimulated(fallbackData.signals);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void getWeatherPayload()
      .then((payload) => {
        if (!active) return;
        setWeather(payload);
        setSimulated(payload.signals);
        setSelectedWindow(0);
      })
      .catch(() => {
        if (!active) return;
        setWeather(fallbackData);
        setSimulated(fallbackData.signals);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedSignals = useMemo(
    () => ({
      ...weather.signals,
      kp: weather.forecast[selectedWindow]?.kp ?? weather.signals.kp,
    }),
    [weather, selectedWindow],
  );
  const assessment = useMemo(
    () => calculateRisk(selectedSignals, profile),
    [selectedSignals, profile],
  );
  const simulation = useMemo(
    () => calculateRisk(simulated, profile),
    [simulated, profile],
  );
  const brief = useMemo(
    () =>
      buildMissionBrief(
        assessment,
        profile,
        weather.mode === "live" ? "NOAA live feed" : "validated demo scenario",
      ),
    [assessment, profile, weather.mode],
  );

  const bestWindowIndex = useMemo(() => {
    const scores = weather.forecast.map((window) =>
      calculateRisk({ ...weather.signals, kp: window.kp }, profile).probability,
    );
    return scores.indexOf(Math.min(...scores));
  }, [weather, profile]);

  return (
    <main className="mission-shell">
      <header className="topbar">
        <a className="brand" href="#mission-control" aria-label="HelioShield AI home">
          <span className="brand-mark"><Orbit aria-hidden="true" /></span>
          <span>
            <strong>HELIO<span>SHIELD</span></strong>
            <small>AI MISSION SAFETY COPILOT</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#mission-control">Mission</a>
          <a href="#model-card">Model card</a>
          <a href="#sources">Sources</a>
        </nav>
        <div className={`source-pill ${weather.mode}`}>
          <span className="pulse-dot" />
          {loading ? "Syncing signals" : weather.mode === "live" ? "NOAA live" : "Demo-safe mode"}
        </div>
      </header>

      <section className="console-heading" id="mission-control">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> EXPLAINABLE MISSION INTELLIGENCE</p>
          <h1>Turn space weather into a launch decision.</h1>
          <p>
            HelioShield fuses mission context with NOAA signals to quantify risk,
            expose every driver, and recommend the safest actionable window.
          </p>
        </div>
        <div className="heading-actions">
          <label htmlFor="mission-profile">Mission profile</label>
          <Select value={profile} onValueChange={(value) => setProfile(value as MissionProfile)}>
            <SelectTrigger id="mission-profile" className="profile-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="satellite">Satellite deployment</SelectItem>
              <SelectItem value="lunar">Lunar cargo</SelectItem>
              <SelectItem value="crewed">Crewed LEO</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setLoading(true);
              void loadWeather();
            }}
            disabled={loading}
            className="sync-button"
          >
            <RefreshCw className={loading ? "spin" : ""} />
            Refresh analysis
          </Button>
        </div>
      </section>

      <div className="mission-grid">
        <section className="panel decision-panel" aria-labelledby="decision-title">
          <div className="panel-kicker">
            <span><Satellite size={15} /> MISSION HS-27</span>
            <span>LAUNCH SITE · SRIHARIKOTA</span>
          </div>
          <div className="decision-layout">
            <div
              className={`risk-orbit ${decisionClass(assessment.decision)}`}
              style={{ "--risk": `${assessment.probability * 3.6}deg` } as React.CSSProperties}
              aria-label={`${assessment.probability}% mission risk`}
            >
              <div className="orbit-ring ring-one" />
              <div className="orbit-ring ring-two" />
              <div className="risk-core">
                <span>MISSION RISK</span>
                <strong>{assessment.probability}<sup>%</sup></strong>
                <small>{assessment.confidence}% model confidence</small>
              </div>
            </div>
            <div className="decision-copy">
              <p className="section-label" id="decision-title">AI LAUNCH RECOMMENDATION</p>
              <div className={`decision-badge ${decisionClass(assessment.decision)}`}>
                {assessment.decision === "GO" ? <Check /> : <TriangleAlert />}
                {assessment.decision}
              </div>
              <h2>{assessment.decisionLabel}</h2>
              <p>{assessment.summary}</p>
              <div className="recommendation-line">
                <ShieldCheck size={18} />
                <span><strong>Recommended control</strong>{assessment.recommendation}</span>
              </div>
            </div>
          </div>
          <div className="signal-grid">
            {assessment.contributions.map((item) => {
              const Icon = item.key === "kp" ? Activity : item.key === "protonFlux" ? Sun : Radio;
              return (
                <article className="signal-card" key={item.key}>
                  <div className={`signal-icon ${item.tone}`}><Icon /></div>
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <span className={`tone-label ${item.tone}`}>{item.tone}</span>
                  <p>{item.explanation}</p>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="panel brief-panel" aria-labelledby="brief-title">
          <div className="panel-title-row">
            <div>
              <p className="section-label"><BrainCircuit size={14} /> AI MISSION BRIEF</p>
              <h2 id="brief-title">Decision, with evidence.</h2>
            </div>
            <span className="model-chip">EXPLAINABLE</span>
          </div>
          <div className={`brief-status ${decisionClass(assessment.decision)}`}>
            <span>{assessment.decision}</span>
            <p>{brief.headline}</p>
          </div>
          <p className="brief-body">{brief.body}</p>
          <div className="evidence-list">
            <span>EVIDENCE TRACE</span>
            {brief.evidence.map((item) => (
              <div key={item}><CircleDot size={14} /><span>{item}</span></div>
            ))}
          </div>
          <div className="human-loop">
            <Users size={18} />
            <div>
              <strong>Human-in-the-loop by design</strong>
              <p>HelioShield advises. Mission control retains final authority.</p>
            </div>
          </div>
        </aside>

        <section className="panel workspace-panel">
          <Tabs defaultValue="forecast">
            <div className="workspace-header">
              <div>
                <p className="section-label">MISSION WORKSPACE</p>
                <h2>Find the safest path forward.</h2>
              </div>
              <TabsList className="workspace-tabs">
                <TabsTrigger value="forecast"><CloudSun /> 24h outlook</TabsTrigger>
                <TabsTrigger value="simulator"><Gauge /> Scenario lab</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="forecast">
              <div className="forecast-summary">
                <div>
                  <span>RECOMMENDED WINDOW</span>
                  <strong>{formatTime(weather.forecast[bestWindowIndex]?.time)} UTC</strong>
                  <p>Lowest modeled risk across the available Kp forecast.</p>
                </div>
                <ArrowDownRight />
                <div>
                  <span>RISK REDUCTION</span>
                  <strong>
                    {Math.max(0, assessment.probability - calculateRisk({ ...weather.signals, kp: weather.forecast[bestWindowIndex]?.kp ?? weather.signals.kp }, profile).probability)} pts
                  </strong>
                  <p>Compared with the currently selected window.</p>
                </div>
              </div>
              <div className="window-track" role="list" aria-label="Forecast launch windows">
                {weather.forecast.map((window, index) => {
                  const risk = calculateRisk({ ...weather.signals, kp: window.kp }, profile);
                  return (
                    <button
                      type="button"
                      role="listitem"
                      key={`${window.time}-${index}`}
                      className={`window-card ${selectedWindow === index ? "selected" : ""} ${decisionClass(risk.decision)}`}
                      onClick={() => setSelectedWindow(index)}
                      aria-label={`Select ${formatTime(window.time)} UTC, ${risk.probability}% risk`}
                    >
                      <span>{index === 0 ? "NOW" : formatTime(window.time).split(",")[0]}</span>
                      <strong>{formatTime(window.time).split(",").at(-1)}</strong>
                      <div className="window-bar"><i style={{ height: `${Math.max(12, risk.probability)}%` }} /></div>
                      <small>{risk.probability}% risk</small>
                      {index === bestWindowIndex && <em>BEST</em>}
                    </button>
                  );
                })}
              </div>
              <p className="data-note"><Info /> Select a window to recalculate the full decision. Proton and X-ray signals are held at the latest observation.</p>
            </TabsContent>

            <TabsContent value="simulator">
              <div className="simulator-grid">
                <div className="controls-stack">
                  <SignalSlider
                    label="Planetary Kp index"
                    value={simulated.kp}
                    min={0}
                    max={9}
                    step={0.1}
                    display={simulated.kp.toFixed(1)}
                    onChange={(value) => setSimulated({ ...simulated, kp: value })}
                  />
                  <SignalSlider
                    label=">=10 MeV proton flux"
                    value={simulated.protonFlux}
                    min={0}
                    max={100}
                    step={0.1}
                    display={`${simulated.protonFlux.toFixed(1)} pfu`}
                    onChange={(value) => setSimulated({ ...simulated, protonFlux: value })}
                  />
                  <SignalSlider
                    label="GOES X-ray flux"
                    value={Math.max(0, Math.min(100, ((Math.log10(Math.max(simulated.xrayFlux, 1e-8)) + 8) / 5) * 100))}
                    min={0}
                    max={100}
                    step={1}
                    display={simulated.xrayFlux.toExponential(1)}
                    onChange={(value) => setSimulated({ ...simulated, xrayFlux: 10 ** (-8 + (value / 100) * 5) })}
                  />
                </div>
                <div className={`simulation-result ${decisionClass(simulation.decision)}`}>
                  <span>COUNTERFACTUAL RESULT</span>
                  <strong>{simulation.probability}<sup>%</sup></strong>
                  <h3>{simulation.decision} · {simulation.decisionLabel}</h3>
                  <p>{simulation.recommendation}</p>
                  <Button variant="outline" onClick={() => setSimulated(weather.signals)}>Reset to observed <RefreshCw /></Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <section className="trust-section" id="model-card">
        <div className="trust-intro">
          <p className="eyebrow"><ShieldCheck size={14} /> BUILT FOR TRUST</p>
          <h2>Not a black box. A decision you can inspect.</h2>
          <p>
            The prototype uses a transparent logistic risk model calibrated to NOAA
            alert thresholds. Every input, weight, and limitation is visible to operators.
          </p>
        </div>
        <div className="trust-cards">
          <article><BrainCircuit /><strong>Explainable inference</strong><p>Feature-level contribution trace for every recommendation.</p></article>
          <article><Database /><strong>Resilient data layer</strong><p>Live NOAA ingestion with an explicitly labeled offline demo mode.</p></article>
          <article><Zap /><strong>Counterfactual planning</strong><p>Change conditions and see the decision update instantly.</p></article>
          <article><ShieldCheck /><strong>Responsible boundary</strong><p>Decision support only—never represented as flight certification.</p></article>
        </div>
        <div className="model-card">
          <div>
            <span>MODEL</span>
            <strong>HS-XR v0.3</strong>
            <small>Threshold-calibrated logistic classifier</small>
          </div>
          <div>
            <span>INPUTS</span>
            <strong>3 + mission profile</strong>
            <small>Kp · proton flux · X-ray flux · sensitivity</small>
          </div>
          <div>
            <span>OUTPUT</span>
            <strong>Risk + evidence</strong>
            <small>GO · CONDITIONAL · HOLD</small>
          </div>
          <div>
            <span>LIMITATION</span>
            <strong>Prototype only</strong>
            <small>Requires agency validation before operations</small>
          </div>
        </div>
      </section>

      <section className="sources-section" id="sources">
        <div>
          <p className="section-label">DATA PROVENANCE</p>
          <h2>Grounded in public operational signals.</h2>
        </div>
        <div className="source-links">
          <a href="https://www.swpc.noaa.gov/products/planetary-k-index" target="_blank" rel="noreferrer">
            <Activity /> <span><strong>Planetary K-index</strong><small>NOAA SWPC</small></span><ExternalLink />
          </a>
          <a href="https://www.swpc.noaa.gov/products/goes-proton-flux" target="_blank" rel="noreferrer">
            <Sun /> <span><strong>GOES proton flux</strong><small>NOAA SWPC</small></span><ExternalLink />
          </a>
          <a href="https://www.swpc.noaa.gov/products/goes-x-ray-flux" target="_blank" rel="noreferrer">
            <Radio /> <span><strong>GOES X-ray flux</strong><small>NOAA SWPC</small></span><ExternalLink />
          </a>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark"><Orbit /></span>
          <span><strong>HELIO<span>SHIELD</span></strong><small>SPACE DATA → MISSION DECISION</small></span>
        </div>
        <p>Built for the August 2026 AI Builders Challenge · Advance Space Exploration with AI</p>
        <a href="#mission-control">Back to mission <ArrowRight /></a>
      </footer>
    </main>
  );
}

function SignalSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="signal-slider">
      <div><label>{label}</label><strong>{display}</strong></div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(next) => onChange(next[0])} />
      <div className="slider-scale"><span>Quiet</span><span>Elevated</span><span>Severe</span></div>
    </div>
  );
}
