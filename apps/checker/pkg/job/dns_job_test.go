package job_test

import (
	"context"
	"errors"
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

// An assertion the probe can't interpret — typically a comparator or record
// type added by a newer server than this checker build — must still produce a
// datapoint. Dropping it leaves the monitor blank while looking healthy.
func TestDNSJob_UnsupportedAssertionIsReported(t *testing.T) {
	tests := []struct {
		name      string
		assertion *v1.RecordAssertion
	}{
		{
			name: "unknown comparator",
			assertion: &v1.RecordAssertion{
				Record:     "A",
				Comparator: v1.RecordComparator(9999),
				Target:     "1.2.3.4",
			},
		},
		{
			name: "unspecified comparator",
			assertion: &v1.RecordAssertion{
				Record:     "A",
				Comparator: v1.RecordComparator_RECORD_COMPARATOR_UNSPECIFIED,
				Target:     "1.2.3.4",
			},
		},
		{
			name: "unknown record type",
			assertion: &v1.RecordAssertion{
				Record:     "SOA",
				Comparator: v1.RecordComparator_RECORD_COMPARATOR_EQUAL,
				Target:     "ns1.openstatus.dev",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			monitor := &v1.DNSMonitor{
				Uri:              "openstatus.dev",
				Timeout:          5000,
				Retry:            1,
				RecordAssertions: []*v1.RecordAssertion{tt.assertion},
			}

			data, err := job.NewJobRunner().DNSJob(context.Background(), monitor)
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if data == nil {
				t.Fatal("expected a reportable datapoint, got nil")
			}
			if data.RequestStatus != "error" {
				t.Errorf("expected RequestStatus 'error', got '%s'", data.RequestStatus)
			}
			if data.Error != 1 {
				t.Errorf("expected Error 1, got %d", data.Error)
			}
			if data.Message == "" {
				t.Errorf("expected a message explaining the misconfiguration")
			}
		})
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

// The retry budget running out mid-loop must still report the pending failure:
// backoff.Retry drops the operation result on context expiry, which would
// otherwise leave a resolver outage silently un-ingested.
func TestDNSJob_LookupFailureIsReportedWhenRetryBudgetExpires(t *testing.T) {
	monitor := &v1.DNSMonitor{
		Uri: "openstatus-does-not-resolve.invalid",
		// Shorter than the backoff between attempts, so the deadline fires
		// while retries are still pending.
		Timeout: 1,
		Retry:   3,
	}

	data, err := job.NewJobRunner().DNSJob(context.Background(), monitor)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data == nil {
		t.Fatal("expected a reportable datapoint, got nil")
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

// A cancelled parent is us shutting down, not an outage — it must not be
// reported as one.
func TestDNSJob_CallerCancellationIsNotReportedAsOutage(t *testing.T) {
	monitor := &v1.DNSMonitor{
		Uri:     "openstatus-does-not-resolve.invalid",
		Timeout: 5000,
		Retry:   3,
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	data, err := job.NewJobRunner().DNSJob(ctx, monitor)
	if err == nil {
		t.Fatalf("expected an error, got data %v", data)
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected a context.Canceled error, got %v", err)
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
