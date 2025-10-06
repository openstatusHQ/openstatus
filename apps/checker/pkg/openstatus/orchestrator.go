package openstatus

import (
	"encoding/json"
	"io"
	"net/http"
)

func GetMonitors(key string) []Monitor {

	httpClient := http.DefaultClient

	url := "https://private-location.openstatus.dev/monitors"

	req, _ := http.NewRequest(http.MethodGet, url, nil)
	res, err := httpClient.Do(req)
	if err != nil {
		return nil
	}

	if res.StatusCode != http.StatusOK {
		return nil
	}
	var monitors []Monitor
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	err = json.Unmarshal(body, &monitors)

	if err != nil {
		return nil
	}

	return monitors
}
