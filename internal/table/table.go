package table

import (
	"fmt"
	"os"
	"time"
	"github.com/notrtdsx/vaer/internal/beaufort"
	"github.com/notrtdsx/vaer/internal/uv"
	"github.com/notrtdsx/vaer/pkg/met"

	"github.com/olekukonko/tablewriter"
)

func RenderForecast(forecast *met.Forecast, limit int, showCloud, showHumidity, showDewpoint, showBeaufort, showUV bool) {
	table := tablewriter.NewWriter(os.Stdout)
	header := []string{"Time", "Summary", "Temp", "Wind", "Precip"}
	if showCloud {
		header = append(header, "Cloud")
	}
	if showHumidity {
		header = append(header, "Humidity")
	}
	if showDewpoint {
		header = append(header, "Dew Point")
	}
	if showBeaufort {
		header = append(header, "Beaufort")
	}
	if showUV {
		header = append(header, "UV Index")
	}
	table.SetHeader(header)

	for i, ts := range forecast.Properties.Timeseries {
		if limit > 0 && i >= limit {
			break
		}
		t, _ := time.Parse(time.RFC3339, ts.Time)
		summary := ""
		precip := 0.0
		if ts.Data.Next1Hours != nil {
			summary = ts.Data.Next1Hours.Summary.SymbolCode
			precip = ts.Data.Next1Hours.Details.PrecipitationAmount
		}
		row := []string{
			t.Format("15:04"),
			summary,
			fmt.Sprintf("%.1f°C", ts.Data.Instant.Details.AirTemperature),
			fmt.Sprintf("%.1f m/s", ts.Data.Instant.Details.WindSpeed),
			fmt.Sprintf("%.1f mm", precip),
		}
		if showCloud {
			row = append(row, fmt.Sprintf("%.1f%%", ts.Data.Instant.Details.CloudArea))
		}
		if showHumidity {
			row = append(row, fmt.Sprintf("%.1f%%", ts.Data.Instant.Details.Humidity))
		}
		if showDewpoint {
			row = append(row, fmt.Sprintf("%.1f°C", ts.Data.Instant.Details.DewPoint))
		}
		if showBeaufort {
			_, desc := beaufort.ToBeaufort(ts.Data.Instant.Details.WindSpeed)
			row = append(row, desc)
		}
		if showUV {
			row = append(row, uv.GetUVIndex(ts.Data.Instant.Details.UVIndex))
		}
		table.Append(row)
	}
	table.Render()
}

func RenderHourlyForecast(forecast *met.Forecast, day time.Time, hour int, showCloud, showHumidity, showDewpoint, showBeaufort, showUV bool) {
	table := tablewriter.NewWriter(os.Stdout)
	header := []string{"Time", "Summary", "Temp", "Wind", "Precip"}
	if showCloud {
		header = append(header, "Cloud")
	}
	if showHumidity {
		header = append(header, "Humidity")
	}
	if showDewpoint {
		header = append(header, "Dew Point")
	}
	if showBeaufort {
		header = append(header, "Beaufort")
	}
	if showUV {
		header = append(header, "UV Index")
	}
	table.SetHeader(header)

	for _, ts := range forecast.Properties.Timeseries {
		t, _ := time.Parse(time.RFC3339, ts.Time)
		if t.Day() == day.Day() && t.Hour() == hour {
			summary := ""
			precip := 0.0
			if ts.Data.Next1Hours != nil {
				summary = ts.Data.Next1Hours.Summary.SymbolCode
				precip = ts.Data.Next1Hours.Details.PrecipitationAmount
			}
			row := []string{
				t.Format("15:04"),
				summary,
				fmt.Sprintf("%.1f°C", ts.Data.Instant.Details.AirTemperature),
				fmt.Sprintf("%.1f m/s", ts.Data.Instant.Details.WindSpeed),
				fmt.Sprintf("%.1f mm", precip),
			}
			if showCloud {
				row = append(row, fmt.Sprintf("%.1f%%", ts.Data.Instant.Details.CloudArea))
			}
			if showHumidity {
				row = append(row, fmt.Sprintf("%.1f%%", ts.Data.Instant.Details.Humidity))
			}
			if showDewpoint {
				row = append(row, fmt.Sprintf("%.1f°C", ts.Data.Instant.Details.DewPoint))
			}
			if showBeaufort {
				_, desc := beaufort.ToBeaufort(ts.Data.Instant.Details.WindSpeed)
				row = append(row, desc)
			}
			if showUV {
				row = append(row, uv.GetUVIndex(ts.Data.Instant.Details.UVIndex))
			}
			table.Append(row)
			break
		}
	}
	table.Render()
}

