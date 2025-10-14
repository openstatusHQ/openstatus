package job

import (
	"context"

	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

type statusCode int

func (s statusCode) IsSuccessful() bool {
	return s >= 200 && s < 300
}

type HttpPrivateRegionData struct {
	ID            string `json:"id"`
	URL           string `json:"url"`
	Message       string `json:"message,omitempty"`
	Timing        string `json:"timing,omitempty"`
	Headers       string `json:"headers,omitempty"`
	Body          string `json:"body,omitempty"`
	RequestStatus string `json:"requestStatus,omitempty"`
	Latency       int64  `json:"latency"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Timestamp     int64  `json:"timestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Error         uint8  `json:"error"`
}


type JobRunner interface {
	TCPJob(ctx context.Context, monitor *v1.TCPMonitor) (*TCPPrivateRegionData, error)
	HTTPJob(ctx context.Context, monitor *v1.HTTPMonitor) (*HttpPrivateRegionData, error)
}

type jobRunner struct {}

func NewJobRunner() JobRunner {
	return &jobRunner{}
}
