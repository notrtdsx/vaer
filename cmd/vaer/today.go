package main

import (
	"fmt"
	"log"
	"strconv"
	"time"
	"vaer/internal/config"
	"vaer/pkg/met"
	"vaer/pkg/nominatim"

	"github.com/spf13/cobra"
)

var todayCmd = &cobra.Command{
	Use:   "today [location]",
	Short: "Get today's weather forecast for a location",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var location string
		if len(args) > 0 {
			location = args[0]
		} else {
			cfg, err := config.Load()
			if err != nil {
				log.Fatal(err)
			}
			if cfg.Location.Name != "" {
				location = cfg.Location.Name
			} else {
				fmt.Println("Please specify a location or set a default in your config file.")
				return
			}
		}

		nominatimClient := nominatim.New()
		locations, err := nominatimClient.Search(location)
		if err != nil {
			log.Fatal(err)
		}

		if len(locations) == 0 {
			fmt.Println("Location not found.")
			return
		}

		lat, err := strconv.ParseFloat(locations[0].Lat, 64)
		if err != nil {
			log.Fatal(err)
		}
		lon, err := strconv.ParseFloat(locations[0].Lon, 64)
		if err != nil {
			log.Fatal(err)
		}

		hour, _ := cmd.Flags().GetInt("hour")
		metClient := met.New()

		if hour != 0 {
			fmt.Printf("Getting today's weather for %s at %d:00...\n", locations[0].DisplayName, hour)
			forecast, err := metClient.GetLocationForecast(lat, lon)
			if err != nil {
				log.Fatal(err)
			}
			cfg, err := config.Load()
			if err != nil {
				log.Fatal(err)
			}
			table.RenderHourlyForecast(forecast, time.Now(), hour, cfg.ShowCloud, cfg.ShowHumidity, cfg.ShowDewpoint, cfg.ShowBeaufort, cfg.ShowUV)
		} else {
			fmt.Printf("Getting today's weather for %s...\n", locations[0].DisplayName)
			date := time.Now().Format("2006-01-02")
			sun, err := metClient.GetSunrise(lat, lon, date)
			if err != nil {
				log.Fatal(err)
			}

			sunriseTime, _ := time.Parse(time.RFC3339, sun.Properties.Sunrise.Time)
			sunsetTime, _ := time.Parse(time.RFC3339, sun.Properties.Sunset.Time)

			fmt.Printf("Sunrise: %s\n", sunriseTime.Local().Format("15:04"))
			fmt.Printf("Sunset:  %s\n", sunsetTime.Local().Format("15:04"))
		}
	},
}

func init() {
	todayCmd.Flags().Int("hour", 0, "Specify the hour for the forecast")
	rootCmd.AddCommand(todayCmd)
}
