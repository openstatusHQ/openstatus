package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/rs/zerolog/log"
	"google.golang.org/api/option"

	"github.com/openstatushq/openstatus/apps/checker/pkg/gcp"

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

var (
	tasksClientMu sync.Mutex
	tasksClient   *cloudtasks.Client
)

// cloudTasksClient builds the Cloud Tasks client once and shares it: it holds a
// gRPC connection and a token cache, too heavy to rebuild on every status
// change. A failed build is not cached, so the next call tries again.
func cloudTasksClient() (*cloudtasks.Client, error) {
	tasksClientMu.Lock()
	defer tasksClientMu.Unlock()

	if tasksClient != nil {
		return tasksClient, nil
	}

	creds, err := gcp.Credentials()
	if err != nil {
		return nil, err
	}

	// The client lives as long as the process, so it takes neither the
	// cancellation nor the values (logger, monitor) of the request that built it.
	client, err := cloudtasks.NewClient(context.Background(), option.WithAuthCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("creating cloud tasks client: %w", err)
	}

	tasksClient = client

	return tasksClient, nil
}

// UpdateStatus queues the status change that drives alerting. Callers do not
// act on the returned error, so every failure is logged here: a lost update is
// a missed alert.
func UpdateStatus(ctx context.Context, updateData UpdateData) error {
	// monitor_id is already on the context logger (handlers.withMonitorLogger).
	logger := log.Ctx(ctx).With().Str("status", updateData.Status).Logger()

	url := "https://openstatus-workflows.fly.dev/updateStatus"
	basic := "Basic " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)

	client, err := cloudTasksClient()
	if err != nil {
		logger.Error().Err(err).Msg("error while updating status")

		return err
	}

	if err := json.NewEncoder(payloadBuf).Encode(updateData); err != nil {
		logger.Error().Err(err).Msg("error while updating status")
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
		logger.Error().Err(err).Msg("error while creating the cloud task")
		return fmt.Errorf("cloudtasks.CreateTask: %w", err)
	}

	return nil
}
