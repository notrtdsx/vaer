# vaer

simple, text-only weather in Node.js. inspired by [Lyn](https://git.sr.ht/~timharek/lyn).

> *Vær* is the Norwegian word for weather, used in everyday speech to describe the conditions outside: temperature, wind, clouds, and precipitation.

## Requirements

- Node.js 18+
- npm
## Install (local)

```bash
npm install -g .
```
- Note, do not delete the vaer folder. if it gets deleted, vaer doesnt work.

## Usage

```bash
vaer now [location]
vaer forecast [location] [--limit N]
vaer today [location] [--hour H]
vaer tomorrow [location] [--hour H]
vaer wear [location]
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

