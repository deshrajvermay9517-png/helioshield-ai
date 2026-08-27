// NOAA SWPC public JSON feed endpoints — no API key required.
const NOAA_ENDPOINTS = {
  kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
  forecast:
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
  protons:
    "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json",
  xrays: "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json",
} as const;

// How many minutes old an observation can be before it is labelled stale.
const STALE_THRESHOLD_MINUTES = 30;

type JsonRecord = Record<string, unknown>;

// ─── helpers ──────────────────────────────────────────────────────────────────

const numeric = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickLatest = (
  rows: JsonRecord[],
  predicate: (row: JsonRecord) => boolean,
): JsonRecord | undefined => {
  const filtered = rows.filter(predicate);
  return filtered.at(-1) ?? rows.at(-1);
};

/** Fetch a URL and return the parsed JSON, or throw a descriptive error. */
async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 180, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

  if (!response.ok) {
    throw new Error(`NOAA ${new URL(url).pathname} responded ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
    throw new Error(
      `NOAA ${new URL(url).pathname} returned unexpected content-type: ${contentType}`,
    );
  }

  return response.json();
}

/** Validate that a payload is a non-empty two-dimensional array (NOAA table format). */
function validateTable(payload: unknown, feedName: string): unknown[][] {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) {
    throw new Error(`Unexpected shape for NOAA ${feedName} payload`);
  }
  return payload as unknown[][];
}

/** Validate that a payload is a non-empty array of records (NOAA JSON format). */
function validateRecordArray(payload: unknown, feedName: string): JsonRecord[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`Empty or non-array NOAA ${feedName} payload`);
  }
  return payload as JsonRecord[];
}

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseKpTable(table: unknown[][]): Array<{ time: string; kp: number }> {
  const [headers, ...rows] = table;
  const timeIndex = (headers as unknown[]).findIndex((item) =>
    String(item).toLowerCase().includes("time"),
  );
  const kpIndex = (headers as unknown[]).findIndex(
    (item) => String(item).toLowerCase() === "kp",
  );
  return rows.map((row) => ({
    time: String(row[timeIndex] ?? ""),
    kp: numeric(row[kpIndex], 2.7),
  }));
}

function demoForecast(): Array<{ time: string; kp: number }> {
  const now = Date.now();
  const values = [3.4, 4.1, 3.8, 2.9, 2.4, 2.1, 2.8, 3.2];
  return values.map((kp, index) => ({
    time: new Date(now + index * 3 * 60 * 60 * 1000).toISOString(),
    kp,
  }));
}

// ─── per-feed fetch helpers (return null on failure) ─────────────────────────

type FeedResult<T> = { value: T; ok: true } | { ok: false; feedName: string };

async function fetchKp(
  endpoint: string,
  feedName: string,
): Promise<FeedResult<Array<{ time: string; kp: number }>>> {
  try {
    const payload = await readJson(endpoint);
    const table = validateTable(payload, feedName);
    return { ok: true, value: parseKpTable(table) };
  } catch (err) {
    console.error(`[HelioShield] Feed degraded — ${feedName}:`, err);
    return { ok: false, feedName };
  }
}

async function fetchRecords(
  endpoint: string,
  feedName: string,
): Promise<FeedResult<JsonRecord[]>> {
  try {
    const payload = await readJson(endpoint);
    const records = validateRecordArray(payload, feedName);
    return { ok: true, value: records };
  } catch (err) {
    console.error(`[HelioShield] Feed degraded — ${feedName}:`, err);
    return { ok: false, feedName };
  }
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const [kpResult, forecastResult, protonResult, xrayResult] = await Promise.all([
    fetchKp(NOAA_ENDPOINTS.kp, "kp"),
    fetchKp(NOAA_ENDPOINTS.forecast, "forecast"),
    fetchRecords(NOAA_ENDPOINTS.protons, "protons"),
    fetchRecords(NOAA_ENDPOINTS.xrays, "xrays"),
  ]);

  const degradedFeeds: string[] = [];
  if (!kpResult.ok) degradedFeeds.push(kpResult.feedName);
  if (!forecastResult.ok) degradedFeeds.push(forecastResult.feedName);
  if (!protonResult.ok) degradedFeeds.push(protonResult.feedName);
  if (!xrayResult.ok) degradedFeeds.push(xrayResult.feedName);

  // If every feed failed, return fully-labelled demo mode.
  if (degradedFeeds.length === 4) {
    return Response.json({
      mode: "demo",
      observedAt: new Date().toISOString(),
      ageMinutes: 0,
      dataQuality: "unknown",
      degradedFeeds,
      signals: { kp: 3.4, protonFlux: 0.82, xrayFlux: 4.6e-7 },
      forecast: demoForecast(),
    });
  }

  const observedKp = kpResult.ok ? kpResult.value : [];
  const forecast = forecastResult.ok
    ? forecastResult.value.slice(0, 8)
    : demoForecast();

  const protonRows = protonResult.ok ? protonResult.value : [];
  const xrayRows = xrayResult.ok ? xrayResult.value : [];

  const proton =
    protonRows.length > 0
      ? pickLatest(protonRows, (row) => String(row.energy).includes(">=10"))
      : undefined;
  const xray =
    xrayRows.length > 0
      ? pickLatest(xrayRows, (row) => String(row.energy).includes("0.1-0.8"))
      : undefined;

  const bestTimestamp = String(
    xray?.time_tag ?? proton?.time_tag ?? observedKp.at(-1)?.time ?? new Date().toISOString(),
  );

  // ── freshness check ────────────────────────────────────────────────────────
  const observedDate = new Date(bestTimestamp);
  const ageMinutes = Number.isNaN(observedDate.getTime())
    ? null
    : Math.round((Date.now() - observedDate.getTime()) / 60_000);

  const dataQuality =
    ageMinutes === null
      ? "unknown"
      : ageMinutes > STALE_THRESHOLD_MINUTES
        ? "stale"
        : "fresh";

  const mode = degradedFeeds.length > 0 ? "partial" : "live";

  return Response.json({
    mode,
    observedAt: bestTimestamp,
    ageMinutes: ageMinutes ?? 0,
    dataQuality,
    degradedFeeds,
    signals: {
      kp: observedKp.at(-1)?.kp ?? 2.7,
      protonFlux: numeric(proton?.flux, 0.82),
      xrayFlux: numeric(xray?.flux, 4.6e-7),
    },
    forecast: forecast.length ? forecast : demoForecast(),
  });
}
