package nominatim

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

const (
	nominatimURL = "https://nominatim.openstreetmap.org/search"
)

type Client struct {
	client *http.Client
}

func New() *Client {
	return &Client{
		client: &http.Client{},
	}
}

type Location struct {
	Lat       string `json:"lat"`
	Lon       string `json:"lon"`
	DisplayName string `json:"display_name"`
}

func (c *Client) Search(query string) ([]Location, error) {
	url := fmt.Sprintf("%s?q=%s&format=json&limit=1", nominatimURL, url.QueryEscape(query))
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

	var locations []Location
	if err := json.NewDecoder(resp.Body).Decode(&locations); err != nil {
		return nil, err
	}

	return locations, nil
}
