package main

import (
	"fmt"
	"log"
	"strconv"
	"vaer/internal/clothing"
	"vaer/internal/config"
	"vaer/pkg/met"
	"vaer/pkg/nominatim"

	"github.com/spf13/cobra"
)

var wearCmd = &cobra.Command{
	Use:   "wear [location]",
	Short: "Get clothing advice for a location",
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

		fmt.Printf("Getting clothing advice for %s (%.4f, %.4f)...\n", locations[0].DisplayName, lat, lon)

		metClient := met.New()
		forecast, err := metClient.GetLocationForecast(lat, lon)
		if err != nil {
			log.Fatal(err)
		}

		if len(forecast.Properties.Timeseries) > 0 {
			ts := forecast.Properties.Timeseries[0]
			precip := 0.0
			if ts.Data.Next1Hours != nil {
				precip = ts.Data.Next1Hours.Details.PrecipitationAmount
			}
			advice := clothing.GetClothingAdvice(
				ts.Data.Instant.Details.AirTemperature,
				ts.Data.Instant.Details.WindSpeed,
				precip,
				ts.Data.Instant.Details.Humidity,
				ts.Data.Instant.Details.UVIndex,
			)
			fmt.Println(advice)
		} else {
			fmt.Println("No weather data available.")
		}
	},
}

func init() {
	rootCmd.AddCommand(wearCmd)
}
