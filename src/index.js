#!/usr/bin/env node

const USER_AGENT = "vaer/0.1";
const GEOCODING_URL = "https://photon.komoot.io/api";
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
  const url = `${GEOCODING_URL}?q=${encodeURIComponent(query)}&limit=1`;
  const body = await httpGet(url);
  if (!body) return null;
  const data = JSON.parse(body);
  const features = data?.features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const first = features[0];
  const props = first?.properties || {};
  const parts = [props.name, props.state, props.country].filter(Boolean);
  const coords = first?.geometry?.coordinates;
  const lon = Array.isArray(coords) ? Number.parseFloat(coords[0]) : NaN;
  const lat = Array.isArray(coords) ? Number.parseFloat(coords[1]) : NaN;
  return {
    display_name: parts.join(", "),
    lat: Number.isNaN(lat) ? 0 : lat,
    lon: Number.isNaN(lon) ? 0 : lon
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

function formatTime(value, useUtc) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  const hours = useUtc ? date.getUTCHours() : date.getHours();
  const minutes = useUtc ? date.getUTCMinutes() : date.getMinutes();
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dateKeyFromDate(date, useUtc) {
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
  const month = useUtc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = useUtc ? date.getUTCDate() : date.getDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKeyFromIso(value, useUtc) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateKeyFromDate(date, useUtc);
}

function hourFromIso(value, useUtc) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return -1;
  return useUtc ? date.getUTCHours() : date.getHours();
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

function printForecastEntries(entries, limit) {
  let count = 0;
  for (const entry of entries) {
    if (limit > 0 && count >= limit) break;
    const lines = [];
    lines.push(`${formatTime(entry.time_rfc3339, USE_UTC)}  ${formatTemperature(entry.air_temperature)}`);
    if (entry.symbol_code) {
      lines.push(`summary: ${entry.symbol_code}`);
    }
    lines.push(`wind: ${entry.wind_speed.toFixed(1)} m/s`);
    lines.push(`precip: ${entry.precip.toFixed(1)} mm`);
    if (SHOW_HUMIDITY) {
      lines.push(`humidity: ${entry.humidity.toFixed(1)}%`);
    }
    if (SHOW_CLOUD) {
      lines.push(`cloud: ${entry.cloud_area.toFixed(1)}%`);
    }
    if (SHOW_DEWPOINT) {
      lines.push(`dew point: ${formatTemperature(entry.dew_point)}`);
    }
    if (SHOW_UV) {
      lines.push(`uv: ${uvIndexLabel(entry.uv_index)}`);
    }
    if (SHOW_BEAUFORT) {
      lines.push(`beaufort: ${entry.wind_speed.toFixed(1)} m/s`);
    }
    console.log(lines.join("\n"));
    console.log("");
    count += 1;
  }
}

function filterForecastByDate(entries, date, useUtc) {
  return entries.filter((entry) => dateKeyFromIso(entry.time_rfc3339, useUtc) === date);
}

function todayDate(useUtc) {
  return dateKeyFromDate(new Date(), useUtc);
}

function tomorrowDate(useUtc) {
  const next = new Date();
  if (useUtc) {
    next.setUTCDate(next.getUTCDate() + 1);
  } else {
    next.setDate(next.getDate() + 1);
  }
  return dateKeyFromDate(next, useUtc);
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
}

function resolveLocation(args) {
  if (args.length > 0) return args[0];
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }

  const cmd = toLower(args.command);

  if (["now", "forecast", "today", "tomorrow", "wear"].includes(cmd)) {
    const location = resolveLocation(args.positionals);
    if (!location) {
      console.log("Please specify a location.");
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

        const targetDate = cmd === "today" ? todayDate(USE_UTC) : tomorrowDate(USE_UTC);
        const filtered = forecast.filter((entry) => {
          const date = dateKeyFromIso(entry.time_rfc3339, USE_UTC);
          const entryHour = hourFromIso(entry.time_rfc3339, USE_UTC);
          return date === targetDate && entryHour === hour;
        });

        printForecastEntries(filtered, 1);
        return;
      }

      console.log(`Getting ${cmd === "today" ? "today's" : "tomorrow's"} weather for ${geo.display_name}...`);
      const date = cmd === "today" ? todayDate(USE_UTC) : tomorrowDate(USE_UTC);
      const sunrise = await fetchSunrise(geo.lat, geo.lon, date);
      if (!sunrise || !sunrise.sunrise_time || !sunrise.sunset_time) {
        console.log("No sunrise data available.");
        return;
      }

      const forecast = await fetchForecast(geo.lat, geo.lon);
      if (!forecast) {
        console.log("No weather data available.");
        return;
      }

      console.log(`Sunrise: ${formatTime(sunrise.sunrise_time, USE_UTC)}`);
      console.log(`Sunset:  ${formatTime(sunrise.sunset_time, USE_UTC)}`);
      console.log("");
      const filtered = filterForecastByDate(forecast, date, USE_UTC);
      if (filtered.length === 0) {
        console.log("No forecast entries available for that date.");
        return;
      }
      printForecastEntries(filtered, 8);
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

      printForecastEntries(forecast, limit);
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
