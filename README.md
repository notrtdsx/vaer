# vaer

`vaer` is a command-line weather application inspired by [lyn](https://git.sr.ht/~timharek/lyn), providing weather information directly in your terminal. It uses public APIs from [MET Norway](https://www.met.no/) and [Nominatim](https://nominatim.org/) for weather data and location search.

## Install CLI

To install the `vaer` command-line tool, use the following `go install` command:

```bash
go install github.com/notrtdsx/vaer/cmd/vaer@latest
```

## Configuration

`vaer` uses a TOML configuration file located at `$XDG_CONFIG_HOME/vaer/vaer.toml` (e.g., `~/.config/vaer/vaer.toml` on Linux). You can set a default location and other preferences.

Example `vaer.toml`:

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

With a default location configured, you can run commands without specifying a location:

```bash
vaer now
vaer forecast
```

## Usage

```bash
# Get help
vaer --help

# Current forecast for a location
vaer now bergen

# Or with a space
vaer now "new york"

# Use default location from config
vaer now

# Forecast for multiple hours
vaer forecast "new york"

# Today's weather, or at a specific hour
vaer today bergen
vaer today bergen --hour 14

# Tomorrow's weather at a specific hour
vaer tomorrow bergen --hour 08

# Get clothing advice
vaer wear bergen

# View current config
vaer config
```

## Data Attribution

Weather data from [MET Norway](https://www.met.no/), licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Location data from [Nominatim](https://nominatim.org/), provided by [OpenStreetMap](https://www.openstreetmap.org/).
