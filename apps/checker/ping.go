package checker

import (
	"bytes"
	"context"
	"errors"
	"fmt"
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

func Ping(ctx context.Context, client *http.Client, inputData request.CheckerRequest) (PingData, error) {
	logger := log.Ctx(ctx).With().Str("monitor", inputData.URL).Logger()

	region := os.Getenv("FLY_REGION")
	req, err := http.NewRequestWithContext(ctx, inputData.Method, inputData.URL, bytes.NewReader([]byte(inputData.Body)))
	if err != nil {
		logger.Error().Err(err).Msg("error while creating req")
		return PingData{}, fmt.Errorf("unable to create req: %w", err)
	}

	req.Header.Set("User-Agent", "OpenStatus/1.0")
	for _, header := range inputData.Headers {
		if header.Key != "" && header.Value != "" {
			req.Header.Set(header.Key, header.Value)
		}
	}

	start := time.Now()
	response, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Timeout() {
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

		logger.Error().Err(err).Msg("error while pinging")
		return PingData{}, fmt.Errorf("error with monitorURL %s: %w", inputData.URL, err)
	}
	defer response.Body.Close()

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
