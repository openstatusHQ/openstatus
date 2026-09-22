package workflows

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func getBaseURL() string {
	if url := os.Getenv("WORKFLOWS_URL"); url != "" {
		return url
	}
	return "https://openstatus-workflows.fly.dev"
}

type Payload struct {
	MonitorID         string `json:"monitorId"`
	PrivateLocationID string `json:"privateLocationId"`
	Status            string `json:"status"`
	Message           string `json:"message,omitempty"`
	CronTimestamp     int64  `json:"cronTimestamp"`
	Latency           int64  `json:"latency,omitempty"`
	StatusCode        int    `json:"statusCode,omitempty"`
}

type Client interface {
	Report(ctx context.Context, payload Payload) error
}

type client struct {
	httpClient *http.Client
	cronSecret string
	baseURL    string
}

func NewClient(httpClient *http.Client, cronSecret string) Client {
	return client{
		httpClient: httpClient,
		cronSecret: cronSecret,
		baseURL:    getBaseURL(),
	}
}

func (c client) Report(ctx context.Context, payload Payload) error {
	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(payload); err != nil {
		return fmt.Errorf("unable to encode payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/updateStatusPrivate", bytes.NewReader(body.Bytes()))
	if err != nil {
		return fmt.Errorf("unable to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+c.cronSecret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("unable to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}
