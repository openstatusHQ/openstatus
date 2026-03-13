package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/rs/zerolog/log"
	"google.golang.org/api/option"

	"cloud.google.com/go/auth"
	cloudtasks "cloud.google.com/go/cloudtasks/apiv2"
	taskspb "cloud.google.com/go/cloudtasks/apiv2/cloudtaskspb"
)

type UpdateData struct {
	MonitorId     string `json:"monitorId"`
	Status        string `json:"status"`
	Message       string `json:"message,omitempty"`
	Region        string `json:"region"`
	CronTimestamp int64  `json:"cronTimestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Latency       int64  `json:"latency,omitempty"`
}

func UpdateStatus(ctx context.Context, updateData UpdateData) error {
	url := os.Getenv("OPENSTATUS_WORKFLOWS_URL")
	if url == "" {
		url = "https://openstatus-workflows.fly.dev"
	}
	url = strings.TrimRight(url, "/") + "/updateStatus"
	basic := "Basic " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)

	if os.Getenv("SELF_HOST") == "true" || os.Getenv("OPENSTATUS_WORKFLOWS_URL") != "" {
		if err := json.NewEncoder(payloadBuf).Encode(updateData); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("error while encoding update payload")
			return err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, payloadBuf)
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("error while creating update request")
			return err
		}
		req.Header.Set("Authorization", basic)
		req.Header.Set("Content-Type", "application/json")

		res, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("error while posting update status directly")
			return err
		}
		defer res.Body.Close()

		if res.StatusCode < 200 || res.StatusCode >= 300 {
			return fmt.Errorf("direct updateStatus failed with status %d", res.StatusCode)
		}

		return nil
	}

	c := os.Getenv("GCP_PRIVATE_KEY")
	c = strings.ReplaceAll(c, "\\n", "\n")
	opts := &auth.Options2LO{
		Email:        os.Getenv("GCP_CLIENT_EMAIL"),
		PrivateKey:   []byte(c),
		PrivateKeyID: os.Getenv("GCP_PRIVATE_KEY_ID"),
		Scopes: []string{
			"https://www.googleapis.com/auth/cloud-platform",
		},
		TokenURL: "https://oauth2.googleapis.com/token",
	}

	tp, err := auth.New2LOTokenProvider(opts)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while creating token provider")
		return err
	}

	creds := auth.NewCredentials(&auth.CredentialsOptions{
		TokenProvider: tp,
	})

	client, err := cloudtasks.NewClient(ctx, option.WithAuthCredentials(creds))
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while creating cloud tasks client")

	}
	defer client.Close()

	if err := json.NewEncoder(payloadBuf).Encode(updateData); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
		return err
	}
	projectID := os.Getenv("GCP_PROJECT_ID")
	queuePath := fmt.Sprintf("projects/%s/locations/europe-west1/queues/alerting", projectID)
	req := &taskspb.CreateTaskRequest{
		Parent: queuePath,
		Task: &taskspb.Task{
			// https://godoc.org/google.golang.org/genproto/googleapis/cloud/tasks/v2#HttpRequest
			MessageType: &taskspb.Task_HttpRequest{
				HttpRequest: &taskspb.HttpRequest{
					HttpMethod: taskspb.HttpMethod_POST,
					Url:        url,
					Headers:    map[string]string{"Authorization": basic, "Content-Type": "application/json"},
				},
			},
		},
	}

	// Add a payload message if one is present.
	req.Task.GetHttpRequest().Body = payloadBuf.Bytes()

	_, err = client.CreateTask(ctx, req)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while creating the cloud task")
		return fmt.Errorf("cloudtasks.CreateTask: %w", err)
	}

	return nil
}
