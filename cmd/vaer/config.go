package main

import (
	"fmt"
	"github.com/notrtdsx/vaer/internal/config"

	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "View current configuration",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Load()
		if err != nil {
			fmt.Println("Error loading config:", err)
			return
		}
		fmt.Printf("use_utc: %v\n", cfg.UseUTC)
		fmt.Printf("show_uv: %v\n", cfg.ShowUV)
		fmt.Printf("show_beaufort: %v\n", cfg.ShowBeaufort)
		fmt.Printf("show_dewpoint: %v\n", cfg.ShowDewpoint)
		fmt.Printf("show_humidity: %v\n", cfg.ShowHumidity)
		fmt.Printf("show_cloud: %v\n", cfg.ShowCloud)
		fmt.Printf("show_sun_protection: %v\n", cfg.ShowSunProtection)
		fmt.Printf("show_wear: %v\n", cfg.ShowWear)
		fmt.Printf("skin_type: %d\n", cfg.SkinType)
		fmt.Printf("temperature_format: %s\n", cfg.TemperatureFormat)
		if cfg.Location.Name != "" {
			fmt.Printf("location.name: %s\n", cfg.Location.Name)
			fmt.Printf("location.longitude: %f\n", cfg.Location.Longitude)
			fmt.Printf("location.latitude: %f\n", cfg.Location.Latitude)
		}
	},
}

func init() {
	rootCmd.AddCommand(configCmd)
}
