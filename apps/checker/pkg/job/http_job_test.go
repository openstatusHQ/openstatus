package job_test

import (
	"context"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

// Save original checker.Http for restoration

func TestHTTPJob_Success(t *testing.T) {

	// Mock checker.Http to simulate success

	monitor := &v1.HTTPMonitor{
		Url:     "https://openstat.us",
		Method:  "GET",
		Timeout: 10000,
		Retry:   2,
	}

	data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data.RequestStatus != "success" {
		t.Errorf("expected RequestStatus 'success', got '%s'", data.RequestStatus)
	}
	if data.Error != 0 {
		t.Errorf("expected Error 0, got %d", data.Error)
	}
}

func TestHTTPJob_Failure(t *testing.T) {

	monitor := &v1.HTTPMonitor{
		Url:     "https://localhost:1234",
		Method:  "GET",
		Timeout: 1000,
		Retry:   1,
	}

	data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if data != nil {
		t.Errorf("expected data to be nil on error, got %+v", data)
	}
}
