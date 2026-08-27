const NOAA_ENDPOINTS = {
  kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
  forecast:
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
  protons:
    "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json",
  xrays: "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json",
};

type JsonRecord = Record<string, unknown>;

const numeric = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickLatest = (rows: JsonRecord[], predicate: (row: JsonRecord) => boolean) => {
  const filtered = rows.filter(predicate);
  return filtered.at(-1) ?? rows.at(-1);
};

async function readJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 180, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
  if (!response.ok) throw new Error(`NOAA responded ${response.status}`);
  return response.json();
}

function parseKpTable(table: unknown) {
  if (!Array.isArray(table) || table.length < 2 || !Array.isArray(table[0])) {
    throw new Error("Unexpected Kp payload");
  }
  const [headers, ...rows] = table as unknown[][];
  const timeIndex = headers.findIndex((item) => String(item).toLowerCase().includes("time"));
  const kpIndex = headers.findIndex((item) => String(item).toLowerCase() === "kp");
  return rows.map((row) => ({
    time: String(row[timeIndex] ?? ""),
    kp: numeric(row[kpIndex], 2.7),
  }));
}

function demoForecast() {
  const now = Date.now();
  const values = [3.4, 4.1, 3.8, 2.9, 2.4, 2.1, 2.8, 3.2];
  return values.map((kp, index) => ({
    time: new Date(now + index * 3 * 60 * 60 * 1000).toISOString(),
    kp,
  }));
}

export async function GET() {
  try {
    const [kpPayload, forecastPayload, protonPayload, xrayPayload] =
      await Promise.all([
        readJson(NOAA_ENDPOINTS.kp),
        readJson(NOAA_ENDPOINTS.forecast),
        readJson(NOAA_ENDPOINTS.protons),
        readJson(NOAA_ENDPOINTS.xrays),
      ]);

    const observedKp = parseKpTable(kpPayload);
    const forecast = parseKpTable(forecastPayload).slice(0, 8);
    const protonRows = protonPayload as JsonRecord[];
    const xrayRows = xrayPayload as JsonRecord[];
    const proton = pickLatest(
      protonRows,
      (row) => String(row.energy).includes(">=10"),
    );
    const xray = pickLatest(
      xrayRows,
      (row) => String(row.energy).includes("0.1-0.8"),
    );

    return Response.json({
      mode: "live",
      observedAt: String(
        xray?.time_tag ?? proton?.time_tag ?? observedKp.at(-1)?.time ?? new Date().toISOString(),
      ),
      signals: {
        kp: observedKp.at(-1)?.kp ?? 2.7,
        protonFlux: numeric(proton?.flux, 0.82),
        xrayFlux: numeric(xray?.flux, 4.6e-7),
      },
      forecast: forecast.length ? forecast : demoForecast(),
    });
  } catch {
    return Response.json({
      mode: "demo",
      observedAt: new Date().toISOString(),
      signals: { kp: 3.4, protonFlux: 0.82, xrayFlux: 4.6e-7 },
      forecast: demoForecast(),
    });
  }
}
