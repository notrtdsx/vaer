#!/usr/bin/env node

const USER_AGENT = "vaer/0.1";
const GEOCODE_API = "https://photon.komoot.io/api";
const WEATHER_API = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const SUN_API = "https://api.met.no/weatherapi/sunrise/3.0/sun";

const DEFAULTS = {
  useUtc: false,
  showHumidity: true,
  showCloud: true,
  showDew: false,
  showUv: true
};

function normalizeString(s = "") {
  return String(s).trim().toLowerCase();
}

function parseNumber(value, fallback = undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  return res.text();
}

async function geocode(place) {
  const url = `${GEOCODE_API}?q=${encodeURIComponent(place)}&limit=1`;
  const txt = await getText(url);
  if (!txt) return null;
  const json = JSON.parse(txt);
  const feat = Array.isArray(json.features) && json.features[0];
  if (!feat) return null;
  const props = feat.properties || {};
  const coords = feat.geometry?.coordinates || [];
  return {
    name: [props.name, props.state, props.country].filter(Boolean).join(", ") || props.name || place,
    lat: parseNumber(coords[1], 0),
    lon: parseNumber(coords[0], 0)
  };
}

function extractForecast(payload) {
  const series = payload?.properties?.timeseries;
  if (!Array.isArray(series)) return [];
  return series.map((ts) => {
    const inst = ts.data?.instant?.details || {};
    const next1 = ts.data?.next_1_hours || {};
    return {
      time: ts.time || "",
      temp: inst.air_temperature ?? 0,
      wind: inst.wind_speed ?? 0,
      clouds: inst.cloud_area_fraction ?? 0,
      humidity: inst.relative_humidity ?? 0,
      dew: inst.dew_point_temperature ?? 0,
      uv: inst.ultraviolet_index_clear_sky ?? 0,
      symbol: next1.summary?.symbol_code || "",
      precip: next1.details?.precipitation_amount ?? 0
    };
  });
}

async function fetchWeather(lat, lon) {
  const url = `${WEATHER_API}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const txt = await getText(url);
  if (!txt) return null;
  const json = JSON.parse(txt);
  return extractForecast(json);
}

function extractSunTimes(payload) {
  const p = payload?.properties || {};
  return {
    sunrise: p.sunrise?.time || "",
    sunset: p.sunset?.time || ""
  };
}

async function fetchSun(lat, lon, date) {
  const url = `${SUN_API}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&date=${date}`;
  const txt = await getText(url);
  if (!txt) return null;
  return extractSunTimes(JSON.parse(txt));
}

function formatClock(iso, useUtc) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--:--";
  const hrs = useUtc ? d.getUTCHours() : d.getHours();
  const mins = useUtc ? d.getUTCMinutes() : d.getMinutes();
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function dayKeyFromIso(iso, useUtc) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = useUtc ? d.getUTCFullYear() : d.getFullYear();
  const m = (useUtc ? d.getUTCMonth() : d.getMonth()) + 1;
  const day = useUtc ? d.getUTCDate() : d.getDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function hourFromIso(iso, useUtc) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return -1;
  return useUtc ? d.getUTCHours() : d.getHours();
}

function uvCategory(v) {
  if (v < 3) return "low";
  if (v < 6) return "moderate";
  if (v < 8) return "high";
  if (v < 11) return "very high";
  return "extreme";
}

function wearSuggestions(temp, wind, precip, humid, uv) {
  let main;
  if (temp <= 0) main = "Very cold — heavy coat, insulated gloves, hat.";
  else if (temp < 10) main = "Cold — warm jacket and layers.";
  else if (temp < 20) main = "Cool — light jacket or sweater.";
  else main = "Warm — t-shirt and light trousers.";

  const notes = [];
  if (wind > 8) notes.push("windy");
  if (precip > 0.1) notes.push("rain likely");
  if (humid > 75) notes.push("humid");
  if (uv >= 8) notes.push("high UV");
  return notes.length ? `${main} (${notes.join(", ")})` : main;
}

function printEntries(list, opts = {}, limit = 0) {
  const useUtc = opts.useUtc ?? DEFAULTS.useUtc;
  let shown = 0;
  for (const e of list) {
    if (limit > 0 && shown >= limit) break;
    const lines = [];
    lines.push(`${formatClock(e.time, useUtc)}  ${e.temp.toFixed(1)}°C`);
    if (e.symbol) lines.push(`weather: ${e.symbol}`);
    lines.push(`wind: ${e.wind.toFixed(1)} m/s`);
    lines.push(`precip: ${e.precip.toFixed(2)} mm`);
    if (opts.showHumidity) lines.push(`humidity: ${e.humidity.toFixed(0)}%`);
    if (opts.showCloud) lines.push(`clouds: ${e.clouds.toFixed(0)}%`);
    if (opts.showDew) lines.push(`dew point: ${e.dew.toFixed(1)}°C`);
    if (opts.showUv) lines.push(`UV: ${uvCategory(e.uv)} (${e.uv.toFixed(1)})`);
    console.log(lines.join("\n"));
    console.log("");
    shown += 1;
  }
}

function todayKey(useUtc) {
  return dayKeyFromIso(new Date().toISOString(), useUtc);
}

function tomorrowKey(useUtc) {
  const now = new Date();
  if (useUtc) now.setUTCDate(now.getUTCDate() + 1);
  else now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseCli(argv) {
  const out = { cmd: "", args: [], flags: {} };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { out.flags.help = true; break; }
    if (!out.cmd && !a.startsWith('-')) { out.cmd = a; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) out.flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) { out.flags[a.slice(2)] = argv[i + 1]; i++; }
      else out.flags[a.slice(2)] = 'true';
      continue;
    }
    out.args.push(a);
  }
  return out;
}

function usage() {
  console.log("vaer - lightweight weather CLI\n");
  console.log("Usage:");
  console.log("  vaer now <location>");
  console.log("  vaer forecast <location> [--limit N]");
  console.log("  vaer today <location> [--hour H]");
  console.log("  vaer tomorrow <location> [--hour H]");
  console.log("  vaer wear <location>");
}

async function run() {
  const cli = parseCli(process.argv);
  if (cli.flags.help || !cli.cmd) { usage(); return; }
  const cmd = normalizeString(cli.cmd);
  if (!['now','forecast','today','tomorrow','wear'].includes(cmd)) { console.log('Unknown command.'); usage(); return; }

  const place = cli.args[0];
  if (!place) { console.log('Please provide a location.'); return; }

  const loc = await geocode(place);
  if (!loc) { console.log('Location not found.'); return; }

  if (cmd === 'wear') {
    const f = await fetchWeather(loc.lat, loc.lon);
    if (!f || f.length === 0) { console.log('No weather data.'); return; }

    // Pick the forecast entry closest to current time
    const nowDate = new Date();
    let best = null;
    let bestDiff = Infinity;
    for (const e of f) {
      const t = Date.parse(e.time);
      if (!Number.isFinite(t)) continue;
      const diff = Math.abs(t - nowDate.getTime());
      if (diff < bestDiff) { bestDiff = diff; best = e; }
    }
    const chosen = best || f[0];
    console.log(`${formatClock(chosen.time, DEFAULTS.useUtc)}  ${wearSuggestions(chosen.temp, chosen.wind, chosen.precip, chosen.humidity, chosen.uv)}`);
    return;
  }

  if (cmd === 'today' || cmd === 'tomorrow') {
    const hour = parseNumber(cli.flags.hour, null);
    const useUtc = DEFAULTS.useUtc;
    const key = cmd === 'today' ? todayKey(useUtc) : tomorrowKey(useUtc);

    if (hour !== null) {
      console.log(`Getting ${cmd} at ${hour}:00 for ${loc.name}`);
      const f = await fetchWeather(loc.lat, loc.lon);
      if (!f) { console.log('No weather data.'); return; }
      const found = f.filter((e) => dayKeyFromIso(e.time, useUtc) === key && hourFromIso(e.time, useUtc) === hour);
      printEntries(found, DEFAULTS, 1);
      return;
    }

    console.log(`${cmd === 'today' ? 'Today' : 'Tomorrow'} for ${loc.name}`);
    const sun = await fetchSun(loc.lat, loc.lon, key);
    if (!sun || !sun.sunrise || !sun.sunset) { console.log('No sun data.'); }
    else {
      console.log(`Sunrise: ${formatClock(sun.sunrise, useUtc)}`);
      console.log(`Sunset:  ${formatClock(sun.sunset, useUtc)}`);
      console.log('');
    }
    const f = await fetchWeather(loc.lat, loc.lon);
    if (!f) { console.log('No weather data.'); return; }
    const dayList = f.filter((e) => dayKeyFromIso(e.time, useUtc) === key);
    if (dayList.length === 0) { console.log('No entries for that day.'); return; }
    printEntries(dayList, DEFAULTS, 8);
    return;
  }

  if (cmd === 'now' || cmd === 'forecast') {
    let limit = cmd === 'now' ? 1 : 12;
    if (cli.flags.limit) limit = parseNumber(cli.flags.limit, limit);
    console.log(`${cmd === 'now' ? 'Now' : 'Forecast'} for ${loc.name}`);
    const f = await fetchWeather(loc.lat, loc.lon);
    if (!f) { console.log('No weather data.'); return; }
    printEntries(f, DEFAULTS, limit);
    return;
  }
}

run().catch((err) => { console.error(err?.message || String(err)); process.exit(1); });
