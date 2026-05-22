package met

import (
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	locationForecastURL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
	sunriseURL          = "https://api.met.no/weatherapi/sunrise/3.0/sun"
)

type Client struct {
	client *http.Client
}

func New() *Client {
	return &Client{
		client: &http.Client{},
	}
}

func (c *Client) GetLocationForecast(lat, lon float64) (*Forecast, error) {
	url := fmt.Sprintf("%s?lat=%.4f&lon=%.4f", locationForecastURL, lat, lon)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "vaer/0.1")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data Forecast
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	return &data, nil
}

func (c *Client) GetSunrise(lat, lon float64, date string) (*Sunrise, error) {
	url := fmt.Sprintf("%s?lat=%.4f&lon=%.4f&date=%s", sunriseURL, lat, lon, date)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "vaer/0.1")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data Sunrise
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	return &data, nil
}
