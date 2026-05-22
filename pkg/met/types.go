package met

type Forecast struct {
	Properties struct {
		Timeseries []struct {
			Time string `json:"time"`
			Data struct {
				Instant struct {
					Details struct {
						AirTemperature float64 `json:"air_temperature"`
						WindSpeed      float64 `json:"wind_speed"`
						WindDirection  float64 `json:"wind_from_direction"`
						CloudArea      float64 `json:"cloud_area_fraction"`
						Humidity       float64 `json:"relative_humidity"`
						DewPoint       float64 `json:"dew_point_temperature"`
						UVIndex        float64 `json:"ultraviolet_index_clear_sky"`
					} `json:"details"`
				} `json:"instant"`
				Next1Hours *struct {
					Summary struct {
						SymbolCode string `json:"symbol_code"`
					} `json:"summary"`
					Details struct {
						PrecipitationAmount float64 `json:"precipitation_amount"`
					} `json:"details"`
				} `json:"next_1_hours"`
			} `json:"data"`
		} `json:"timeseries"`
	} `json:"properties"`
}

type Sunrise struct {
	Properties struct {
		Sunrise struct {
			Time string `json:"time"`
		} `json:"sunrise"`
		Sunset struct {
			Time string `json:"time"`
		} `json:"sunset"`
	} `json:"properties"`
}
