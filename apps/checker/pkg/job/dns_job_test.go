package job_test

import (
	"context"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

func TestDNSJob_Success(t *testing.T) {
	monitor := &v1.DNSMonitor{
		Uri:     "openstatus.dev",
		Timeout: 5000,
		Retry:   1,
	}

	data, err := job.NewJobRunner().DNSJob(context.Background(), monitor)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data.RequestStatus != "success" {
		t.Errorf("expected RequestStatus 'success', got '%s'", data.RequestStatus)
	}
	if data.Error != 0 {
		t.Errorf("expected Error 0, got %d", data.Error)
	}
	if len(data.Records["A"]) == 0 {
		t.Errorf("expected at least one A record, got %v", data.Records)
	}
	if data.Timestamp <= 0 {
		t.Errorf("expected a positive timestamp, got %d", data.Timestamp)
	}
}

// A resolver failure has to come back as a reportable result, not an error:
// returning an error drops the datapoint and the outage goes unalerted.
func TestDNSJob_LookupFailureIsReported(t *testing.T) {
	monitor := &v1.DNSMonitor{
		Uri:     "openstatus-does-not-resolve.invalid",
		Timeout: 5000,
		Retry:   1,
	}

	data, err := job.NewJobRunner().DNSJob(context.Background(), monitor)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data.RequestStatus != "error" {
		t.Errorf("expected RequestStatus 'error', got '%s'", data.RequestStatus)
	}
	if data.Error != 1 {
		t.Errorf("expected Error 1, got %d", data.Error)
	}
	if data.Message == "" {
		t.Errorf("expected a failure message to forward to the platform")
	}
}

func TestDNSJob_FailedAssertionIsReported(t *testing.T) {
	monitor := &v1.DNSMonitor{
		Uri:     "openstatus.dev",
		Timeout: 5000,
		Retry:   1,
		RecordAssertions: []*v1.RecordAssertion{
			{
				Record:     "A",
				Comparator: v1.RecordComparator_RECORD_COMPARATOR_EQUAL,
				Target:     "203.0.113.1",
			},
		},
	}

	data, err := job.NewJobRunner().DNSJob(context.Background(), monitor)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data.RequestStatus != "error" {
		t.Errorf("expected RequestStatus 'error', got '%s'", data.RequestStatus)
	}
	if data.Error != 1 {
		t.Errorf("expected Error 1, got %d", data.Error)
	}
	// The records still have to reach Tinybird so the failure can be debugged.
	if len(data.Records["A"]) == 0 {
		t.Errorf("expected the resolved records to be reported, got %v", data.Records)
	}
}
