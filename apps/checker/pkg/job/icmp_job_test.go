package job_test

import (
	"context"
	"strings"
	"testing"

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
	if data.RequestStatus != "active" {
		t.Errorf("expected RequestStatus 'active', got '%s'", data.RequestStatus)
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
