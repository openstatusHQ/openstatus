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
	MonitorId     string `json:"monitorId"`
	Status        string `json:"status"`
	Message       string `json:"message,omitempty"`
	Region        string `json:"region"`
	CronTimestamp int64  `json:"cronTimestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
}

func UpdateStatus(ctx context.Context, updateData UpdateData) {
	url := "https://openstatus-api.fly.dev/updateStatus"
	basic := "Basic " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)
	if err := json.NewEncoder(payloadBuf).Encode(updateData); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
		return
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, payloadBuf)
	req.Header.Set("Authorization", basic)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: time.Second * 10}
	if _, err := client.Do(req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
	}
	defer req.Body.Close()
	// Should we add a retry mechanism here?
}
