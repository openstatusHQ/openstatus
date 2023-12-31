package checker

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/request"
)

type PingData struct {
	WorkspaceID   string `json:"workspaceId"`
	MonitorID     string `json:"monitorId"`
	Timestamp     int64  `json:"timestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Latency       int64  `json:"latency"`
	CronTimestamp int64  `json:"cronTimestamp"`
	URL           string `json:"url"`
	Region        string `json:"region"`
	Message       string `json:"message,omitempty"`
}

func SendToTinyBird(pingData PingData) {
	url := "https://api.tinybird.co/v0/events?name=ping_response__v5"
	fmt.Printf("📈  Sending data to Tinybird for %+v \n", pingData)
	bearer := "Bearer " + os.Getenv("TINYBIRD_TOKEN")
	payloadBuf := new(bytes.Buffer)
	json.NewEncoder(payloadBuf).Encode(pingData)
	req, err := http.NewRequest("POST", url, payloadBuf)
	req.Header.Set("Authorization", bearer)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: time.Second * 10}
	_, err = client.Do(req)
	if err != nil {
		fmt.Println(err)
		panic(err)
	}
	// Should we add a retry mechanism here?

}

func Ping(client *http.Client, inputData request.CheckerRequest) (PingData, error) {

	region := os.Getenv("FLY_REGION")
	request, err := http.NewRequest(inputData.Method, inputData.URL, bytes.NewReader([]byte(inputData.Body)))
	if err != nil {
		return PingData{}, fmt.Errorf("Unable to create request: %w", err)
	}

	request.Header.Set("User-Agent", "OpenStatus/1.0")

	// Setting headers
	for _, header := range inputData.Headers {
		if header.Key != "" && header.Value != "" {
			request.Header.Set(header.Key, header.Value)
		}
	}

	start := time.Now()
	response, err := client.Do(request)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		if urlErr, ok := err.(*url.Error); ok {
			if urlErr.Timeout() {
				return PingData{
					Latency:     latency,
					MonitorID:   inputData.MonitorID,
					Region:      region,
					WorkspaceID: inputData.WorkspaceID,
					Timestamp:   time.Now().UTC().UnixMilli(),
					URL:         inputData.URL,
					Message:     fmt.Sprintf("Timeout after %d ms", latency),
				}, nil
			}
		}

		return PingData{}, fmt.Errorf("Error with monitor %s: %w", inputData.URL, err)
	}
	defer response.Body.Close()

	_, err = io.ReadAll(response.Body)

	if err != nil {
		return PingData{}, fmt.Errorf("Error while reading body from %s: %w", inputData.URL, err)
	}
	return PingData{
		Latency:       latency,
		StatusCode:    response.StatusCode,
		MonitorID:     inputData.MonitorID,
		Region:        region,
		WorkspaceID:   inputData.WorkspaceID,
		Timestamp:     time.Now().UTC().UnixMilli(),
		CronTimestamp: inputData.CronTimestamp,
		URL:           inputData.URL,
	}, nil
}
