package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"

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

	url := "https://openstatus-workflows.fly.dev/updateStatus"
	basic := "Basic " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)

	opts := &auth.Options2LO{
		Email:      os.Getenv("GCP_CLIENT_EMAIL"),
		PrivateKey: []byte(os.Getenv("GCP_PRIVATE_KEY")),
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
