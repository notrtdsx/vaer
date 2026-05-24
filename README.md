# vaer

simple, text-only weather in Node.js. inspired by [Lyn](https://git.sr.ht/~timharek/lyn).

> *Vær* is the Norwegian word for weather, used in everyday speech to describe the conditions outside: temperature, wind, clouds, and precipitation.

## Requirements

- Node.js 24.16.0
- npm (for installing globally)

## Install

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

## Example output

```
12:00  12.3°C
weather: clearsky_day
wind: 4.5 m/s
precip: 0.00 mm
humidity: 54%
clouds: 12%
dew point: 8.1°C
UV: low (0.0)
```

The `wear` command prints short clothing suggestions based on temperature, wind, precipitation and UV.

## Notes

- The CLI entry is `vaer` (installed from the `bin/vaer` wrapper).
- The project uses the Met.no APIs; please respect their usage policy.
