package main

import (
	"fmt"
	"log"
	"strconv"
	"vaer/internal/config"
	"vaer/internal/table"
	"vaer/pkg/met"
	"vaer/pkg/nominatim"

	"github.com/spf13/cobra"
)

var nowCmd = &cobra.Command{
	Use:   "now [location]",
	Short: "Get the current weather for a location",
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

		fmt.Printf("Getting current weather for %s (%.4f, %.4f)...\n", locations[0].DisplayName, lat, lon)

		metClient := met.New()
		forecast, err := metClient.GetLocationForecast(lat, lon)
		if err != nil {
			log.Fatal(err)
		}

		cfg, err := config.Load()
		if err != nil {
			log.Fatal(err)
		}

		table.RenderForecast(forecast, 1, cfg.ShowCloud, cfg.ShowHumidity, cfg.ShowDewpoint, cfg.ShowBeaufort, cfg.ShowUV)
	},
}

func init() {
	rootCmd.AddCommand(nowCmd)
}
