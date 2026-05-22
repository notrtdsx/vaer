package config

import (
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type Config struct {
	UseUTC            bool   `mapstructure:"use_utc"`
	ShowUV            bool   `mapstructure:"show_uv"`
	ShowBeaufort      bool   `mapstructure:"show_beaufort"`
	ShowDewpoint      bool   `mapstructure:"show_dewpoint"`
	ShowHumidity      bool   `mapstructure:"show_humidity"`
	ShowCloud         bool   `mapstructure:"show_cloud"`
	ShowSunProtection bool   `mapstructure:"show_sun_protection"`
	ShowWear          bool   `mapstructure:"show_wear"`
	SkinType          int    `mapstructure:"skin_type"`
	TemperatureFormat string `mapstructure:"temperature_format"`
	Location          struct {
		Name      string  `mapstructure:"name"`
		Longitude float64 `mapstructure:"longitude"`
		Latitude  float64 `mapstructure:"latitude"`
	} `mapstructure:"location"`
}

func Load() (*Config, error) {
	var cfg Config
	configPath := os.Getenv("XDG_CONFIG_HOME")
	if configPath == "" {
		configPath = filepath.Join(os.Getenv("HOME"), ".config")
	}

	viper.SetConfigName("vaer")
	viper.SetConfigType("toml")
	viper.AddConfigPath(filepath.Join(configPath, "vaer"))
	viper.AddConfigPath(".")

	viper.SetDefault("use_utc", false)
	viper.SetDefault("show_uv", false)
	viper.SetDefault("show_beaufort", true)
	viper.SetDefault("show_dewpoint", false)
	viper.SetDefault("show_humidity", true)
	viper.SetDefault("show_cloud", false)
	viper.SetDefault("show_sun_protection", false)
	viper.SetDefault("show_wear", false)
	viper.SetDefault("skin_type", 0)
	viper.SetDefault("temperature_format", "celsius")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
