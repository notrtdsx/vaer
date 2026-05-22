# vaer

Command-line weather app in C++ with a single Linux binary.

## Build

```bash
cmake -S . -B build
cmake --build build
```

The resulting binary is at `build/vaer`.

## Install

```bash
chmod +x install.sh
./install.sh
```

If you run it as root, it installs to `/usr/local/bin`. Otherwise it installs to `~/.local/bin`.

## Arch Linux (PKGBUILD)

```bash
makepkg -f
sudo pacman -U vaer2-*.pkg.tar.*
```

## Static binary notes

To build a fully static binary, you will need static versions of libcurl and its TLS dependencies installed. Example (varies by distro):

```bash
cmake -S . -B build -DCMAKE_EXE_LINKER_FLAGS="-static"
cmake --build build
```

If static linking fails, install the distro-specific `libcurl` static packages and try again.

## Usage

```bash
vaer now [location]
vaer forecast [location] [--limit N]
vaer today [location] [--hour H]
vaer tomorrow [location] [--hour H]
vaer wear [location]
vaer config
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

This version always shows local time and Celsius temperatures.
