# vaer

simple, text-only weather in Node.js.

## Requirements

- Node.js 18+

## Install (local)

```bash
npm install -g .
```

## Usage

```bash
vaer now [location]
vaer forecast [location] [--limit N]
vaer today [location] [--hour H]
vaer tomorrow [location] [--hour H]
vaer wear [location]
vaer config
```

## Output format

Forecast output is text-only:

```
12:00  12.3C
summary: clearsky_day
wind: 4.5 m/s
precip: 0.0 mm
humidity: 54.0%
cloud: 12.0%
dew point: 8.1C
uv: Low
beaufort: 4.5 m/s
```

## Configuration

Config file: `$XDG_CONFIG_HOME/vaer/vaer.toml` (or `~/.config/vaer/vaer.toml`).

Example:

```toml
use_utc = false
show_uv = true
show_beaufort = true
show_dewpoint = true
show_humidity = true
show_cloud = true
temperature_format = "celsius"

[location]
name = "Oslo, Norway"
longitude = 10.7522
latitude = 59.9139
```
