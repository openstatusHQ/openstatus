package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog/log"
)

type UpdateData struct {
	MonitorId  string `json:"monitorId"`
	Message    string `json:"message,omitempty"`
	StatusCode int    `json:"statusCode,omitempty"`
	Region     string `json:"region"`
}

func UpdateStatus(ctx context.Context, updateData UpdateData) {
	url := "https://openstatus-api.fly.dev/updateStatus"
	basic := "Basic " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)
	json.NewEncoder(payloadBuf).Encode(updateData)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, payloadBuf)
	req.Header.Set("Authorization", basic)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: time.Second * 10}
	if _, err = client.Do(req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
	}
	// push to queue to avoid exhausting the API server
	// Should we add a retry mechanism here?
}
