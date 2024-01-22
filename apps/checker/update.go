package checker

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	cloudtasks "cloud.google.com/go/cloudtasks/apiv2"
	taskspb "cloud.google.com/go/cloudtasks/apiv2/cloudtaskspb"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
)

type UpdateData struct {
	MonitorId     string `json:"monitorId"`
	Message       string `json:"message,omitempty"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Region        string `json:"region"`
	CronTimestamp int64  `json:"cronTimestamp"`
}

func UpdateStatus(ctx context.Context, updateData UpdateData) (*taskspb.Task, error)   {

	 jsonCred := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	creds, err := google.CredentialsFromJSON(ctx, []byte(jsonCred))
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	client, err := cloudtasks.NewClient(ctx, option.WithCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("NewClient: %w", err)
	}
	defer client.Close()

	queuePath := os.Getenv("QUEUE_PATH")

	url := "https://openstatus-api.fly.dev/updateStatus"
	basic := "Basic " + os.Getenv("CRON_SECRET")


	req := &taskspb.CreateTaskRequest{
		Parent: queuePath,
		Task: &taskspb.Task{
			// https://godoc.org/google.golang.org/genproto/googleapis/cloud/tasks/v2#HttpRequest
			MessageType: &taskspb.Task_HttpRequest{
				HttpRequest: &taskspb.HttpRequest{
					HttpMethod: taskspb.HttpMethod_POST,
					Url:        url,
					Headers: map[string]string{
						"Authorization": basic,
						"Content-Type":  "application/json",
					},
				},
			},
		},
	}

	// Add a payload message if one is present.
	payload, err := json.Marshal(updateData)
	if err != nil {
		return nil, fmt.Errorf("json.Marshal: %w", err)
	}
	req.Task.GetHttpRequest().Body = payload

	createdTask, err := client.CreateTask(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("cloudtasks.CreateTask: %w", err)
	}

	return createdTask, nil


	// client := &http.Client{Timeout: time.Second * 10}
	// if _, err = client.Do(req); err != nil {
	// 	log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
	// }
	// push to queue to avoid exhausting the API server
	// Should we add a retry mechanism here
	return nil, nil
}
