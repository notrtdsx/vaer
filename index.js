#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const USER_AGENT = "vaer/0.1";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const SUNRISE_URL = "https://api.met.no/weatherapi/sunrise/3.0/sun";

function toLower(value) {
  return value.toLowerCase();
}

function trim(value) {
  return value.trim();
}

function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseBool(value) {
  const lowered = toLower(trim(value));
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  return undefined;
}

function parseIntValue(value) {
  const parsed = Number.parseInt(trim(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseFloatValue(value) {
  const parsed = Number.parseFloat(trim(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getConfigPath() {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) {
    return path.join(xdg, "vaer", "vaer.toml");
  }
  const home = process.env.HOME;
  if (home && home.length > 0) {
    return path.join(home, ".config", "vaer", "vaer.toml");
  }
  return "vaer.toml";
}

function loadConfig() {
  const cfg = {
    use_utc: false,
    show_uv: false,
    show_beaufort: true,
    show_dewpoint: false,
    show_humidity: true,
    show_cloud: false,
    show_sun_protection: false,
    show_wear: false,
    skin_type: 0,
    temperature_format: "celsius",
    location: {
      name: "",
      longitude: 0.0,
      latitude: 0.0,
      has_coords: false
    }
  };

  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return cfg;
  }

  const content = fs.readFileSync(configPath, "utf8");
  const lines = content.split(/\r?\n/);
  let section = "";

  for (const raw of lines) {
    const hashIndex = raw.indexOf("#");
    const line = trim(hashIndex >= 0 ? raw.slice(0, hashIndex) : raw);
    if (!line) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      section = toLower(trim(line.slice(1, -1)));
      continue;
    }

    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = toLower(trim(line.slice(0, eq)));
    const value = trim(line.slice(eq + 1));

    if (!section) {
      if (key === "use_utc") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.use_utc = parsed;
      } else if (key === "show_uv") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.show_uv = parsed;
      } else if (key === "show_beaufort") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.show_beaufort = parsed;
      } else if (key === "show_dewpoint") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.show_dewpoint = parsed;
      } else if (key === "show_humidity") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.show_humidity = parsed;
      } else if (key === "show_cloud") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.show_cloud = parsed;
      } else if (key === "show_sun_protection") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.show_sun_protection = parsed;
      } else if (key === "show_wear") {
        const parsed = parseBool(value);
        if (parsed !== undefined) cfg.show_wear = parsed;
      } else if (key === "skin_type") {
        const parsed = parseIntValue(value);
        if (parsed !== undefined) cfg.skin_type = parsed;
      } else if (key === "temperature_format") {
        cfg.temperature_format = toLower(stripQuotes(value));
      }
    } else if (section === "location") {
      if (key === "name") {
        cfg.location.name = stripQuotes(value);
      } else if (key === "longitude") {
        const parsed = parseFloatValue(value);
        if (parsed !== undefined) {
          cfg.location.longitude = parsed;
          cfg.location.has_coords = true;
        }
      } else if (key === "latitude") {
        const parsed = parseFloatValue(value);
        if (parsed !== undefined) {
          cfg.location.latitude = parsed;
          cfg.location.has_coords = true;
        }
      }
    }
  }

  return cfg;
}

async function httpGet(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT
    }
  });
  if (!response.ok) {
    return null;
  }
  return response.text();
}

async function lookupLocation(query) {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const body = await httpGet(url);
  if (!body) return null;
  const data = JSON.parse(body);
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  return {
    display_name: first.display_name || "",
    lat: Number.parseFloat(first.lat || "0"),
    lon: Number.parseFloat(first.lon || "0")
  };
}

function parseForecast(data) {
  const entries = [];
  const timeseries = data?.properties?.timeseries;
  if (!Array.isArray(timeseries)) return entries;

  for (const ts of timeseries) {
    const details = ts?.data?.instant?.details || {};
    const next1 = ts?.data?.next_1_hours || {};
    entries.push({
      time_rfc3339: ts.time || "",
      air_temperature: details.air_temperature ?? 0.0,
      wind_speed: details.wind_speed ?? 0.0,
      cloud_area: details.cloud_area_fraction ?? 0.0,
      humidity: details.relative_humidity ?? 0.0,
      dew_point: details.dew_point_temperature ?? 0.0,
      uv_index: details.ultraviolet_index_clear_sky ?? 0.0,
      symbol_code: next1?.summary?.symbol_code || "",
      precip: next1?.details?.precipitation_amount ?? 0.0
    });
  }
  return entries;
}

async function fetchForecast(lat, lon) {
  const url = `${FORECAST_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const body = await httpGet(url);
  if (!body) return null;
  const data = JSON.parse(body);
  return parseForecast(data);
}

function parseSunrise(data) {
  const props = data?.properties;
  return {
    sunrise_time: props?.sunrise?.time || "",
    sunset_time: props?.sunset?.time || ""
  };
}

async function fetchSunrise(lat, lon, date) {
  const url = `${SUNRISE_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&date=${date}`;
  const body = await httpGet(url);
  if (!body) return null;
  const data = JSON.parse(body);
  return parseSunrise(data);
}

function formatTimeLocal(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatTemperature(value) {
  return `${value.toFixed(1)}C`;
}

function uvIndexLabel(value) {
  if (value < 3.0) return "Low";
  if (value < 6.0) return "Moderate";
  if (value < 8.0) return "High";
  if (value < 11.0) return "Very High";
  return "Extreme";
}

function clothingAdvice(temp, wind, precip, humidity, uv) {
  let advice = "Clothing advice:\n";
  if (temp < 0.0) {
    advice += "- Very cold: Wear a heavy winter coat, gloves, a hat, and a scarf.\n";
  } else if (temp < 10.0) {
    advice += "- Cold: A warm jacket or coat is recommended.\n";
  } else if (temp < 20.0) {
    advice += "- Mild: A light jacket or sweater should be sufficient.\n";
  } else {
    advice += "- Warm: Light clothing, such as a t-shirt and shorts, is appropriate.\n";
  }

  if (wind > 10.0) {
    advice += "- Windy: Consider a windbreaker.\n";
  }
  if (precip > 0.0) {
    advice += "- Rainy: Don't forget your umbrella or a waterproof jacket.\n";
  }
  if (humidity > 70.0) {
    advice += "- Humid: Wear light, breathable fabrics.\n";
  }
  if (uv >= 8.0) {
    advice += "- High UV Index: Protect your skin with sunscreen, a hat, and sunglasses.\n";
  }
  return advice;
}

function printForecastEntries(entries, limit, cfg) {
  let count = 0;
  for (const entry of entries) {
    if (limit > 0 && count >= limit) break;
    const lines = [];
    lines.push(`${formatTimeLocal(entry.time_rfc3339)}  ${formatTemperature(entry.air_temperature)}`);
    if (entry.symbol_code) {
      lines.push(`summary: ${entry.symbol_code}`);
    }
    lines.push(`wind: ${entry.wind_speed.toFixed(1)} m/s`);
    lines.push(`precip: ${entry.precip.toFixed(1)} mm`);
    if (cfg.show_humidity) {
      lines.push(`humidity: ${entry.humidity.toFixed(1)}%`);
    }
    if (cfg.show_cloud) {
      lines.push(`cloud: ${entry.cloud_area.toFixed(1)}%`);
    }
    if (cfg.show_dewpoint) {
      lines.push(`dew point: ${formatTemperature(entry.dew_point)}`);
    }
    if (cfg.show_uv) {
      lines.push(`uv: ${uvIndexLabel(entry.uv_index)}`);
    }
    if (cfg.show_beaufort) {
      lines.push(`beaufort: ${entry.wind_speed.toFixed(1)} m/s`);
    }
    console.log(lines.join("\n"));
    console.log("");
    count += 1;
  }
}

function todayDateUtc() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function tomorrowDateUtc() {
  const now = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function extractHour(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseArgs(argv) {
  const result = {
    command: "",
    positionals: [],
    flags: {},
    help: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      result.help = true;
      continue;
    }
    if (!result.command && !arg.startsWith("-")) {
      result.command = arg;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq >= 0) {
        result.flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result.flags[arg.slice(2)] = argv[i + 1];
        i += 1;
      } else {
        result.flags[arg.slice(2)] = "true";
      }
      continue;
    }
    result.positionals.push(arg);
  }

  if (!result.command) {
    result.help = true;
  }
  return result;
}

function printUsage() {
  console.log("vaer - weather CLI\n");
  console.log("Usage:");
  console.log("  vaer now [location]");
  console.log("  vaer forecast [location] [--limit N]");
  console.log("  vaer today [location] [--hour H]");
  console.log("  vaer tomorrow [location] [--hour H]");
  console.log("  vaer wear [location]");
  console.log("  vaer config");
}

function resolveLocation(cfg, args) {
  if (args.length > 0) return args[0];
  if (cfg.location.name) return cfg.location.name;
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }

  const cfg = loadConfig();
  const cmd = toLower(args.command);

  if (cmd === "config") {
    console.log(`use_utc: ${cfg.use_utc}`);
    console.log(`show_uv: ${cfg.show_uv}`);
    console.log(`show_beaufort: ${cfg.show_beaufort}`);
    console.log(`show_dewpoint: ${cfg.show_dewpoint}`);
    console.log(`show_humidity: ${cfg.show_humidity}`);
    console.log(`show_cloud: ${cfg.show_cloud}`);
    console.log(`show_sun_protection: ${cfg.show_sun_protection}`);
    console.log(`show_wear: ${cfg.show_wear}`);
    console.log(`skin_type: ${cfg.skin_type}`);
    console.log(`temperature_format: ${cfg.temperature_format}`);
    if (cfg.location.name) {
      console.log(`location.name: ${cfg.location.name}`);
      console.log(`location.longitude: ${cfg.location.longitude}`);
      console.log(`location.latitude: ${cfg.location.latitude}`);
    }
    return;
  }

  if (["now", "forecast", "today", "tomorrow", "wear"].includes(cmd)) {
    const location = resolveLocation(cfg, args.positionals);
    if (!location) {
      console.log("Please specify a location or set a default in your config file.");
      return;
    }

    const geo = await lookupLocation(location);
    if (!geo || !geo.display_name) {
      console.log("Location not found.");
      return;
    }

    if (cmd === "wear") {
      console.log(`Getting clothing advice for ${geo.display_name} (${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)})...`);
      const forecast = await fetchForecast(geo.lat, geo.lon);
      if (!forecast || forecast.length === 0) {
        console.log("No weather data available.");
        return;
      }
      const ts = forecast[0];
      console.log(clothingAdvice(ts.air_temperature, ts.wind_speed, ts.precip, ts.humidity, ts.uv_index));
      return;
    }

    if (cmd === "today" || cmd === "tomorrow") {
      let hour = 0;
      if (args.flags.hour) {
        hour = extractHour(args.flags.hour, 0);
      }

      if (hour !== 0) {
        console.log(`Getting ${cmd === "today" ? "today's" : "tomorrow's"} weather for ${geo.display_name} at ${hour}:00...`);
        const forecast = await fetchForecast(geo.lat, geo.lon);
        if (!forecast) {
          console.log("No weather data available.");
          return;
        }

        const targetDate = cmd === "today" ? todayDateUtc() : tomorrowDateUtc();
        const filtered = forecast.filter((entry) => {
          const date = entry.time_rfc3339.slice(0, 10);
          const entryHour = Number.parseInt(entry.time_rfc3339.slice(11, 13), 10);
          return date === targetDate && entryHour === hour;
        });

        printForecastEntries(filtered, 1, cfg);
        return;
      }

      console.log(`Getting ${cmd === "today" ? "today's" : "tomorrow's"} weather for ${geo.display_name}...`);
      const date = cmd === "today" ? todayDateUtc() : tomorrowDateUtc();
      const sunrise = await fetchSunrise(geo.lat, geo.lon, date);
      if (!sunrise || !sunrise.sunrise_time || !sunrise.sunset_time) {
        console.log("No sunrise data available.");
        return;
      }

      console.log(`Sunrise: ${formatTimeLocal(sunrise.sunrise_time)}`);
      console.log(`Sunset:  ${formatTimeLocal(sunrise.sunset_time)}`);
      return;
    }

    if (cmd === "now" || cmd === "forecast") {
      let limit = cmd === "now" ? 1 : 12;
      if (args.flags.limit) {
        limit = extractHour(args.flags.limit, limit);
      }

      console.log(`Getting ${cmd === "now" ? "current" : "forecast"} weather for ${geo.display_name}...`);
      const forecast = await fetchForecast(geo.lat, geo.lon);
      if (!forecast) {
        console.log("No weather data available.");
        return;
      }

      printForecastEntries(forecast, limit, cfg);
      return;
    }
  }

  console.log("Unknown command.\n");
  printUsage();
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
