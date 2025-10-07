package openstatus

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type RawMonitor struct {
	ID              int
	Active          bool
	WorkspaceID     int64 `json:"workspace_id"`
	JobType         string
	Periodicity     string
	URL             string
	Headers         json.RawMessage
	Body            string
	Method          string
	Timeout         int64
	DegradedAfter   int64 `json:"degraded_after"`
	Assertions      json.RawMessage
	Retry           int64
	FollowRedirects bool `json:"follow_redirects"`
}

func GetMonitors(key string) []RawMonitor {

	httpClient := http.DefaultClient

	url := "http://localhost:8080/monitors"

	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Add("openstatus-token", key)

	res, err := httpClient.Do(req)
	if err != nil {
		return nil
	}

	if res.StatusCode != http.StatusOK {
		return nil
	}
	var monitors []RawMonitor
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	err = json.Unmarshal(body, &monitors)

	if err != nil {
		fmt.Println(err)
		return nil
	}

	return monitors
}
