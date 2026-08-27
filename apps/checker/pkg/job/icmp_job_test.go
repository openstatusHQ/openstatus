package job_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

func TestICMPJob_Success(t *testing.T) {
	monitor := &v1.ICMPMonitor{
		Uri:     "127.0.0.1",
		Timeout: 2000,
		Retry:   1,
	}
	data, err := job.NewJobRunner().ICMPJob(context.Background(), monitor, "test-region")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	// unprivileged Linux CI (no ping_group_range) can't open the socket
	if data.RequestStatus == "error" && strings.Contains(data.Message, "icmp socket error") {
		t.Skipf("icmp sockets unavailable in this environment: %s", data.Message)
	}
	if data.RequestStatus != "success" {
		t.Errorf("expected RequestStatus 'success', got '%s'", data.RequestStatus)
	}
	if data.Error != 0 {
		t.Errorf("expected Error 0, got %d", data.Error)
	}
	if data.PacketsReceived == 0 {
		t.Errorf("expected at least one packet received, got %d", data.PacketsReceived)
	}
}

func TestICMPJob_Failure(t *testing.T) {
	// 192.0.2.1 is TEST-NET-1 (RFC 5737): never answers.
	monitor := &v1.ICMPMonitor{
		Uri:     "192.0.2.1",
		Timeout: 1000,
		Retry:   1,
	}
	data, err := job.NewJobRunner().ICMPJob(context.Background(), monitor, "test-region")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data.RequestStatus != "error" {
		t.Errorf("expected RequestStatus 'error', got '%s'", data.RequestStatus)
	}
	if data.Error != 1 {
		t.Errorf("expected Error 1, got %d", data.Error)
	}
}

// The private-location server rejects an ingest whose timestamp is not strictly
// positive (ValidateIngestICMPRequest), and the scheduler does not retry a
// rejected ingest — so a result without timestamps is silently dropped.
func TestICMPJob_StampsTimestamps(t *testing.T) {
	before := time.Now().UTC().UnixMilli()

	for _, tc := range []struct {
		name string
		uri  string
	}{
		{name: "success", uri: "127.0.0.1"},
		// 192.0.2.1 is TEST-NET-1 (RFC 5737): never answers.
		{name: "failure", uri: "192.0.2.1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			monitor := &v1.ICMPMonitor{Uri: tc.uri, Timeout: 1000, Retry: 1}
			data, err := job.NewJobRunner().ICMPJob(context.Background(), monitor, "test-region")
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if data.RequestStatus == "error" && strings.Contains(data.Message, "icmp socket error") {
				t.Skipf("icmp sockets unavailable in this environment: %s", data.Message)
			}

			after := time.Now().UTC().UnixMilli()

			if data.Timestamp <= 0 {
				t.Errorf("Timestamp must be positive or the ingest is rejected, got %d", data.Timestamp)
			}
			if data.CronTimestamp <= 0 {
				t.Errorf("CronTimestamp must be positive, got %d", data.CronTimestamp)
			}
			if data.Timestamp < before || data.Timestamp > after {
				t.Errorf("Timestamp %d outside the run window [%d, %d]", data.Timestamp, before, after)
			}
			if data.ID == "" {
				t.Error("ID must be set")
			}
			if data.URI != tc.uri {
				t.Errorf("URI = %q, want %q", data.URI, tc.uri)
			}
		})
	}
}

// The Tinybird ICMP aggregations bucket on the literal string — see
// aggregate__icmp_status_45d__v0.pipe and the icmp_uptime_* endpoints, which
// count `requestStatus = 'success'`. A healthy check reported under any other
// label is ingested but invisible to uptime and status.
func TestICMPJob_SuccessUsesTinybirdStatusVocabulary(t *testing.T) {
	monitor := &v1.ICMPMonitor{Uri: "127.0.0.1", Timeout: 2000, Retry: 1}
	data, err := job.NewJobRunner().ICMPJob(context.Background(), monitor, "test-region")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data.RequestStatus == "error" && strings.Contains(data.Message, "icmp socket error") {
		t.Skipf("icmp sockets unavailable in this environment: %s", data.Message)
	}

	// The full vocabulary the pipes recognise; "active" is not part of it.
	switch data.RequestStatus {
	case "success", "degraded", "error":
	default:
		t.Errorf("RequestStatus %q is not counted by the Tinybird ICMP pipes", data.RequestStatus)
	}

	if data.RequestStatus != "success" {
		t.Errorf("a healthy ping must report \"success\", got %q", data.RequestStatus)
	}
}
