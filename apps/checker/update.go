package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"

	"github.com/rs/zerolog/log"
)

type UpdateData struct {
	MonitorId     string `json:"monitorId"`
	Status        string `json:"status"`
	Message       string `json:"message,omitempty"`
	Region        string `json:"region"`
	CronTimestamp int64  `json:"cronTimestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
}

type Client interface {
	UpdateStatus(ctx context.Context, updateData UpdateData) error
}

type client struct {
	httpClient *http.Client
}

func NewClient(httpClient *http.Client) Client {
	return client{
		httpClient: httpClient,
	}
}

const baseURL = "https://openstatus-api.fly.dev/updateStatus"

func (c client) UpdateStatus(ctx context.Context, updateData UpdateData) error {

	basic := "Basic " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)

	if err := json.NewEncoder(payloadBuf).Encode(updateData); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL, payloadBuf)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
		return err
	}

	req.Header.Set("Authorization", basic)
	req.Header.Set("Content-Type", "application/json")

	if _, err := c.httpClient.Do(req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
		return err
	}

	defer req.Body.Close()
	return nil
	// Should we add a retry mechanism here?
}
