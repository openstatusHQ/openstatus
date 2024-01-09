package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
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

func SendToTinyBird(ctx context.Context, pingData PingData) {
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
		log.Ctx(ctx).Error().Err(err).Msg("Error while sending data to Tinybird")
	}
	// Should we add a retry mechanism here?

}

func Ping(ctx context.Context, client *http.Client, inputData request.CheckerRequest) (PingData, error) {
	logger := log.Ctx(ctx).With().Str("monitor", inputData.URL).Logger()

	region := os.Getenv("FLY_REGION")
	req, err := http.NewRequestWithContext(ctx, inputData.Method, inputData.URL, bytes.NewReader([]byte(inputData.Body)))
	if err != nil {
		logger.Error().Err(err).Msg("error while creating req")
		return PingData{}, fmt.Errorf("unable to create req: %w", err)
	}

	req.Header.Set("User-Agent", "OpenStatus/1.0")

	// Setting headers
	for _, header := range inputData.Headers {
		if header.Key != "" && header.Value != "" {
			req.Header.Set(header.Key, header.Value)
		}
	}

	start := time.Now()
	response, err := client.Do(req)
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

		logger.Error().Err(err).Msg("error while pinging")
		return PingData{}, fmt.Errorf("error with monitor %s: %w", inputData.URL, err)
	}
	defer response.Body.Close()

	if _, err := io.ReadAll(response.Body); err != nil {
		logger.Error().Err(err).Str("monitor", inputData.URL).Msg("error while reading body")
		return PingData{}, fmt.Errorf("error while reading body from %s: %w", inputData.URL, err)
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
