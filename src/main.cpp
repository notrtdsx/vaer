#include <curl/curl.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

using json = nlohmann::json;

namespace {

struct Location {
  std::string name;
  double longitude = 0.0;
  double latitude = 0.0;
  bool has_coords = false;
};

struct Config {
  bool use_utc = false;
  bool show_uv = false;
  bool show_beaufort = true;
  bool show_dewpoint = false;
  bool show_humidity = true;
  bool show_cloud = false;
  bool show_sun_protection = false;
  bool show_wear = false;
  int skin_type = 0;
  std::string temperature_format = "celsius";
  Location location;
};

struct GeocodedLocation {
  std::string display_name;
  double lat = 0.0;
  double lon = 0.0;
  bool ok = false;
};

struct ForecastEntry {
  std::string time_rfc3339;
  double air_temperature = 0.0;
  double wind_speed = 0.0;
  double cloud_area = 0.0;
  double humidity = 0.0;
  double dew_point = 0.0;
  double uv_index = 0.0;
  std::string symbol_code;
  double precip = 0.0;
  bool has_next1 = false;
};

struct SunriseData {
  std::string sunrise_time;
  std::string sunset_time;
  bool ok = false;
};

constexpr const char* kUserAgent = "vaer/0.1";
constexpr const char* kNominatimUrl = "https://nominatim.openstreetmap.org/search";
constexpr const char* kForecastUrl = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
constexpr const char* kSunriseUrl = "https://api.met.no/weatherapi/sunrise/3.0/sun";

std::string ToLower(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
    return static_cast<char>(std::tolower(c));
  });
  return value;
}

std::string Trim(std::string value) {
  auto not_space = [](unsigned char c) { return !std::isspace(c); };
  value.erase(value.begin(), std::find_if(value.begin(), value.end(), not_space));
  value.erase(std::find_if(value.rbegin(), value.rend(), not_space).base(), value.end());
  return value;
}

std::string StripQuotes(const std::string& value) {
  if (value.size() >= 2 && ((value.front() == '"' && value.back() == '"') ||
                            (value.front() == '\'' && value.back() == '\''))) {
    return value.substr(1, value.size() - 2);
  }
  return value;
}

bool ParseBool(const std::string& value, bool* out) {
  std::string lowered = ToLower(Trim(value));
  if (lowered == "true") {
    *out = true;
    return true;
  }
  if (lowered == "false") {
    *out = false;
    return true;
  }
  return false;
}

bool ParseInt(const std::string& value, int* out) {
  try {
    *out = std::stoi(Trim(value));
    return true;
  } catch (...) {
    return false;
  }
}

bool ParseDouble(const std::string& value, double* out) {
  try {
    *out = std::stod(Trim(value));
    return true;
  } catch (...) {
    return false;
  }
}

std::optional<std::string> ReadFile(const std::string& path) {
  std::ifstream file(path);
  if (!file.is_open()) {
    return std::nullopt;
  }
  std::ostringstream buffer;
  buffer << file.rdbuf();
  return buffer.str();
}

std::string GetConfigPath() {
  const char* xdg = std::getenv("XDG_CONFIG_HOME");
  if (xdg && *xdg) {
    return std::string(xdg) + "/vaer/vaer.toml";
  }
  const char* home = std::getenv("HOME");
  if (home && *home) {
    return std::string(home) + "/.config/vaer/vaer.toml";
  }
  return "vaer.toml";
}

Config LoadConfig() {
  Config cfg;
  std::string path = GetConfigPath();
  auto content = ReadFile(path);
  if (!content.has_value()) {
    return cfg;
  }

  std::istringstream stream(*content);
  std::string line;
  std::string section;
  while (std::getline(stream, line)) {
    auto comment_pos = line.find('#');
    if (comment_pos != std::string::npos) {
      line = line.substr(0, comment_pos);
    }
    line = Trim(line);
    if (line.empty()) {
      continue;
    }

    if (line.front() == '[' && line.back() == ']') {
      section = Trim(line.substr(1, line.size() - 2));
      section = ToLower(section);
      continue;
    }

    auto eq_pos = line.find('=');
    if (eq_pos == std::string::npos) {
      continue;
    }

    std::string key = ToLower(Trim(line.substr(0, eq_pos)));
    std::string value = Trim(line.substr(eq_pos + 1));

    if (section.empty()) {
      if (key == "use_utc") {
        ParseBool(value, &cfg.use_utc);
      } else if (key == "show_uv") {
        ParseBool(value, &cfg.show_uv);
      } else if (key == "show_beaufort") {
        ParseBool(value, &cfg.show_beaufort);
      } else if (key == "show_dewpoint") {
        ParseBool(value, &cfg.show_dewpoint);
      } else if (key == "show_humidity") {
        ParseBool(value, &cfg.show_humidity);
      } else if (key == "show_cloud") {
        ParseBool(value, &cfg.show_cloud);
      } else if (key == "show_sun_protection") {
        ParseBool(value, &cfg.show_sun_protection);
      } else if (key == "show_wear") {
        ParseBool(value, &cfg.show_wear);
      } else if (key == "skin_type") {
        ParseInt(value, &cfg.skin_type);
      } else if (key == "temperature_format") {
        cfg.temperature_format = ToLower(StripQuotes(value));
      }
    } else if (section == "location") {
      if (key == "name") {
        cfg.location.name = StripQuotes(value);
      } else if (key == "longitude") {
        if (ParseDouble(value, &cfg.location.longitude)) {
          cfg.location.has_coords = true;
        }
      } else if (key == "latitude") {
        if (ParseDouble(value, &cfg.location.latitude)) {
          cfg.location.has_coords = true;
        }
      }
    }
  }

  return cfg;
}

size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
  size_t total = size * nmemb;
  auto* buffer = static_cast<std::string*>(userp);
  buffer->append(static_cast<char*>(contents), total);
  return total;
}

std::optional<std::string> HttpGet(const std::string& url) {
  CURL* curl = curl_easy_init();
  if (!curl) {
    return std::nullopt;
  }

  std::string response;
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_USERAGENT, kUserAgent);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
  curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);

  CURLcode res = curl_easy_perform(curl);
  curl_easy_cleanup(curl);

  if (res != CURLE_OK) {
    return std::nullopt;
  }
  return response;
}

std::string UrlEncode(const std::string& value) {
  CURL* curl = curl_easy_init();
  if (!curl) {
    return value;
  }
  char* encoded = curl_easy_escape(curl, value.c_str(), static_cast<int>(value.size()));
  std::string result = encoded ? encoded : value;
  if (encoded) {
    curl_free(encoded);
  }
  curl_easy_cleanup(curl);
  return result;
}

GeocodedLocation LookupLocation(const std::string& query) {
  std::ostringstream url;
  url << kNominatimUrl << "?q=" << UrlEncode(query) << "&format=json&limit=1";

  auto body = HttpGet(url.str());
  if (!body.has_value()) {
    return {};
  }

  auto data = json::parse(*body, nullptr, false);
  if (!data.is_array() || data.empty()) {
    return {};
  }

  auto first = data.at(0);
  GeocodedLocation result;
  result.display_name = first.value("display_name", "");
  result.lat = std::stod(first.value("lat", "0"));
  result.lon = std::stod(first.value("lon", "0"));
  result.ok = !result.display_name.empty();
  return result;
}

std::vector<ForecastEntry> ParseForecast(const json& data) {
  std::vector<ForecastEntry> entries;
  if (!data.contains("properties")) {
    return entries;
  }
  const auto& timeseries = data["properties"]["timeseries"];
  if (!timeseries.is_array()) {
    return entries;
  }

  for (const auto& ts : timeseries) {
    ForecastEntry entry;
    entry.time_rfc3339 = ts.value("time", "");
    const auto& details = ts["data"]["instant"]["details"];
    entry.air_temperature = details.value("air_temperature", 0.0);
    entry.wind_speed = details.value("wind_speed", 0.0);
    entry.cloud_area = details.value("cloud_area_fraction", 0.0);
    entry.humidity = details.value("relative_humidity", 0.0);
    entry.dew_point = details.value("dew_point_temperature", 0.0);
    entry.uv_index = details.value("ultraviolet_index_clear_sky", 0.0);

    if (ts["data"].contains("next_1_hours")) {
      const auto& next1 = ts["data"]["next_1_hours"];
      entry.symbol_code = next1["summary"].value("symbol_code", "");
      entry.precip = next1["details"].value("precipitation_amount", 0.0);
      entry.has_next1 = true;
    }

    entries.push_back(entry);
  }
  return entries;
}

std::optional<std::vector<ForecastEntry>> FetchForecast(double lat, double lon) {
  std::ostringstream url;
  url << kForecastUrl << "?lat=" << std::fixed << std::setprecision(4) << lat
      << "&lon=" << std::fixed << std::setprecision(4) << lon;

  auto body = HttpGet(url.str());
  if (!body.has_value()) {
    return std::nullopt;
  }

  auto data = json::parse(*body, nullptr, false);
  if (data.is_discarded()) {
    return std::nullopt;
  }

  return ParseForecast(data);
}

SunriseData ParseSunrise(const json& data) {
  SunriseData result;
  if (!data.contains("properties")) {
    return result;
  }
  const auto& props = data["properties"];
  result.sunrise_time = props["sunrise"].value("time", "");
  result.sunset_time = props["sunset"].value("time", "");
  result.ok = !result.sunrise_time.empty() && !result.sunset_time.empty();
  return result;
}

std::optional<SunriseData> FetchSunrise(double lat, double lon, const std::string& date) {
  std::ostringstream url;
  url << kSunriseUrl << "?lat=" << std::fixed << std::setprecision(4) << lat
      << "&lon=" << std::fixed << std::setprecision(4) << lon
      << "&date=" << date;

  auto body = HttpGet(url.str());
  if (!body.has_value()) {
    return std::nullopt;
  }

  auto data = json::parse(*body, nullptr, false);
  if (data.is_discarded()) {
    return std::nullopt;
  }

  return ParseSunrise(data);
}

#ifdef _WIN32
#define timegm _mkgmtime
#endif

std::optional<std::time_t> ParseRfc3339Utc(const std::string& value) {
  if (value.size() < 19) {
    return std::nullopt;
  }
  std::tm tm = {};
  std::istringstream stream(value.substr(0, 19));
  stream >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
  if (stream.fail()) {
    return std::nullopt;
  }
  std::time_t t = timegm(&tm);
  return t;
}

std::string FormatTimeLocal(const std::string& value) {
  auto parsed = ParseRfc3339Utc(value);
  if (!parsed.has_value()) {
    return "--:--";
  }
  std::tm* local = std::localtime(&parsed.value());
  std::ostringstream out;
  out << std::put_time(local, "%H:%M");
  return out.str();
}

std::string FormatTemperature(double value) {
  std::ostringstream out;
  out << std::fixed << std::setprecision(1) << value << "C";
  return out.str();
}

std::string BeaufortDescription(double wind_speed) {
  if (wind_speed < 0.3) return "Calm";
  if (wind_speed < 1.6) return "Light air";
  if (wind_speed < 3.4) return "Light breeze";
  if (wind_speed < 5.5) return "Gentle breeze";
  if (wind_speed < 8.0) return "Moderate breeze";
  if (wind_speed < 10.8) return "Fresh breeze";
  if (wind_speed < 13.9) return "Strong breeze";
  if (wind_speed < 17.2) return "Near gale";
  if (wind_speed < 20.8) return "Gale";
  if (wind_speed < 24.5) return "Strong gale";
  if (wind_speed < 28.5) return "Storm";
  if (wind_speed < 32.7) return "Violent storm";
  return "Hurricane";
}

std::string UVIndexLabel(double uv) {
  if (uv < 3.0) return "Low";
  if (uv < 6.0) return "Moderate";
  if (uv < 8.0) return "High";
  if (uv < 11.0) return "Very High";
  return "Extreme";
}

std::string ClothingAdvice(double temp, double wind, double precip, double humidity, double uv) {
  std::ostringstream out;
  out << "Clothing advice:\n";
  if (temp < 0.0) {
    out << "- Very cold: Wear a heavy winter coat, gloves, a hat, and a scarf.\n";
  } else if (temp < 10.0) {
    out << "- Cold: A warm jacket or coat is recommended.\n";
  } else if (temp < 20.0) {
    out << "- Mild: A light jacket or sweater should be sufficient.\n";
  } else {
    out << "- Warm: Light clothing, such as a t-shirt and shorts, is appropriate.\n";
  }

  if (wind > 10.0) {
    out << "- Windy: Consider a windbreaker.\n";
  }
  if (precip > 0.0) {
    out << "- Rainy: Don't forget your umbrella or a waterproof jacket.\n";
  }
  if (humidity > 70.0) {
    out << "- Humid: Wear light, breathable fabrics.\n";
  }
  if (uv >= 8.0) {
    out << "- High UV Index: Protect your skin with sunscreen, a hat, and sunglasses.\n";
  }
  return out.str();
}

void PrintForecastEntries(const std::vector<ForecastEntry>& entries, int limit) {
  int count = 0;
  for (const auto& entry : entries) {
    if (limit > 0 && count >= limit) {
      break;
    }
    std::ostringstream line;
    line << FormatTimeLocal(entry.time_rfc3339) << " "
         << FormatTemperature(entry.air_temperature) << " "
         << std::fixed << std::setprecision(1) << entry.wind_speed << "m/s "
         << std::fixed << std::setprecision(1) << entry.precip << "mm";
    std::cout << line.str() << "\n";
    ++count;
  }
}

std::string TodayDateUtc() {
  std::time_t now = std::time(nullptr);
  std::tm* utc = std::gmtime(&now);
  std::ostringstream out;
  out << std::put_time(utc, "%Y-%m-%d");
  return out.str();
}

std::string TomorrowDateUtc() {
  std::time_t now = std::time(nullptr) + 24 * 60 * 60;
  std::tm* utc = std::gmtime(&now);
  std::ostringstream out;
  out << std::put_time(utc, "%Y-%m-%d");
  return out.str();
}

int ExtractHour(const std::string& value, int fallback) {
  try {
    return std::stoi(value);
  } catch (...) {
    return fallback;
  }
}

struct ParsedArgs {
  std::string command;
  std::vector<std::string> positionals;
  std::map<std::string, std::string> flags;
  bool help = false;
};

ParsedArgs ParseArgs(int argc, char** argv) {
  ParsedArgs result;
  if (argc <= 1) {
    result.help = true;
    return result;
  }

  for (int i = 1; i < argc; ++i) {
    std::string arg = argv[i];
    if (arg == "-h" || arg == "--help") {
      result.help = true;
      continue;
    }
    if (result.command.empty() && arg.rfind("-", 0) != 0) {
      result.command = arg;
      continue;
    }
    if (arg.rfind("--", 0) == 0) {
      auto eq_pos = arg.find('=');
      if (eq_pos != std::string::npos) {
        result.flags[arg.substr(2, eq_pos - 2)] = arg.substr(eq_pos + 1);
      } else if (i + 1 < argc && argv[i + 1][0] != '-') {
        result.flags[arg.substr(2)] = argv[++i];
      } else {
        result.flags[arg.substr(2)] = "true";
      }
      continue;
    }
    result.positionals.push_back(arg);
  }

  if (result.command.empty()) {
    result.help = true;
  }
  return result;
}

void PrintUsage() {
  std::cout << "vaer - weather CLI\n\n"
            << "Usage:\n"
            << "  vaer now [location]\n"
            << "  vaer forecast [location] [--limit N]\n"
            << "  vaer today [location] [--hour H]\n"
            << "  vaer tomorrow [location] [--hour H]\n"
            << "  vaer wear [location]\n"
            << "  vaer config\n";
}

std::optional<std::string> ResolveLocation(const Config& cfg,
                                           const std::vector<std::string>& args) {
  if (!args.empty()) {
    return args.front();
  }
  if (!cfg.location.name.empty()) {
    return cfg.location.name;
  }
  return std::nullopt;
}

}  // namespace

int main(int argc, char** argv) {
  ParsedArgs args = ParseArgs(argc, argv);
  if (args.help) {
    PrintUsage();
    return 0;
  }

  Config cfg = LoadConfig();
  std::string cmd = ToLower(args.command);

  if (cmd == "config") {
    std::cout << "use_utc: " << (cfg.use_utc ? "true" : "false") << "\n";
    std::cout << "show_uv: " << (cfg.show_uv ? "true" : "false") << "\n";
    std::cout << "show_beaufort: " << (cfg.show_beaufort ? "true" : "false") << "\n";
    std::cout << "show_dewpoint: " << (cfg.show_dewpoint ? "true" : "false") << "\n";
    std::cout << "show_humidity: " << (cfg.show_humidity ? "true" : "false") << "\n";
    std::cout << "show_cloud: " << (cfg.show_cloud ? "true" : "false") << "\n";
    std::cout << "show_sun_protection: " << (cfg.show_sun_protection ? "true" : "false") << "\n";
    std::cout << "show_wear: " << (cfg.show_wear ? "true" : "false") << "\n";
    std::cout << "skin_type: " << cfg.skin_type << "\n";
    std::cout << "temperature_format: " << cfg.temperature_format << "\n";
    if (!cfg.location.name.empty()) {
      std::cout << "location.name: " << cfg.location.name << "\n";
      std::cout << "location.longitude: " << cfg.location.longitude << "\n";
      std::cout << "location.latitude: " << cfg.location.latitude << "\n";
    }
    return 0;
  }

  if (cmd == "now" || cmd == "forecast" || cmd == "today" || cmd == "tomorrow" || cmd == "wear") {
    auto location = ResolveLocation(cfg, args.positionals);
    if (!location.has_value()) {
      std::cout << "Please specify a location or set a default in your config file." << std::endl;
      return 0;
    }

    GeocodedLocation geo = LookupLocation(location.value());
    if (!geo.ok) {
      std::cout << "Location not found." << std::endl;
      return 0;
    }

    if (cmd == "wear") {
      std::cout << "Getting clothing advice for " << geo.display_name << " ("
                << std::fixed << std::setprecision(4) << geo.lat << ", "
                << std::fixed << std::setprecision(4) << geo.lon << ")...\n";
      auto forecast = FetchForecast(geo.lat, geo.lon);
      if (!forecast.has_value() || forecast->empty()) {
        std::cout << "No weather data available." << std::endl;
        return 0;
      }
      const auto& ts = forecast->front();
      std::cout << ClothingAdvice(ts.air_temperature, ts.wind_speed, ts.precip, ts.humidity, ts.uv_index);
      return 0;
    }

    if (cmd == "today" || cmd == "tomorrow") {
      int hour = 0;
      auto it = args.flags.find("hour");
      if (it != args.flags.end()) {
        hour = ExtractHour(it->second, 0);
      }

      if (hour != 0) {
        std::cout << "Getting " << (cmd == "today" ? "today's" : "tomorrow's")
                  << " weather for " << geo.display_name << " at " << hour << ":00...\n";
        auto forecast = FetchForecast(geo.lat, geo.lon);
        if (!forecast.has_value()) {
          std::cout << "No weather data available." << std::endl;
          return 0;
        }

        std::string target_date = (cmd == "today") ? TodayDateUtc() : TomorrowDateUtc();
        std::vector<ForecastEntry> filtered;
        for (const auto& entry : forecast.value()) {
          if (entry.time_rfc3339.size() < 13) {
            continue;
          }
          std::string date = entry.time_rfc3339.substr(0, 10);
          int entry_hour = 0;
          try {
            entry_hour = std::stoi(entry.time_rfc3339.substr(11, 2));
          } catch (...) {
            continue;
          }
          if (date == target_date && entry_hour == hour) {
            filtered.push_back(entry);
            break;
          }
        }

        PrintForecastEntries(filtered, 1);
        return 0;
      }

      std::cout << "Getting " << (cmd == "today" ? "today's" : "tomorrow's")
                << " weather for " << geo.display_name << "...\n";
      std::string date = (cmd == "today") ? TodayDateUtc() : TomorrowDateUtc();
      auto sunrise = FetchSunrise(geo.lat, geo.lon, date);
      if (!sunrise.has_value() || !sunrise->ok) {
        std::cout << "No sunrise data available." << std::endl;
        return 0;
      }

      std::cout << "Sunrise: " << FormatTimeLocal(sunrise->sunrise_time) << "\n";
      std::cout << "Sunset:  " << FormatTimeLocal(sunrise->sunset_time) << "\n";
      return 0;
    }

    if (cmd == "now" || cmd == "forecast") {
      int limit = (cmd == "now") ? 1 : 12;
      auto it = args.flags.find("limit");
      if (it != args.flags.end()) {
        limit = ExtractHour(it->second, limit);
      }

      std::cout << "Getting " << (cmd == "now" ? "current" : "forecast")
                << " weather for " << geo.display_name << "...\n";
      auto forecast = FetchForecast(geo.lat, geo.lon);
      if (!forecast.has_value()) {
        std::cout << "No weather data available." << std::endl;
        return 0;
      }

      PrintForecastEntries(forecast.value(), limit);
      return 0;
    }
  }

  std::cout << "Unknown command.\n\n";
  PrintUsage();
  return 1;
}
