package server_test

import (
	"context"
	"net/http"
	"testing"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

func TestIngestDNS_Unauthenticated(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{})
	// No token header
	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for missing token, got nil")
	}
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("expected unauthenticated code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_ValidationError_EmptyID(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for validation failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected invalid argument code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_ValidationError_InvalidTimestamp(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "dns-123",
		Timestamp: 0, // Invalid - must be positive
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for validation failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected invalid argument code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_ValidationError_NegativeLatency(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "dns-123",
		Latency:   -100,
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for validation failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected invalid argument code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_DBError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "nonexistent-monitor",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "invalid-token")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for db failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Errorf("expected internal code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_MonitorNotExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "nonexistent-monitor",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for monitor not found, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Errorf("expected internal code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_MonitorExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "5",
		Timestamp:     1234567890,
		Latency:       50,
		CronTimestamp: 1234567800,
		Uri:           "dns://example.com",
		Timing:        "50ms",
		Records:       nil,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}

func TestIngestDNS_WithRecords(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "5",
		Timestamp:     1234567890,
		Latency:       50,
		CronTimestamp: 1234567800,
		Uri:           "dns://example.com",
		Timing:        "50ms",
		Records: map[string]*private_locationv1.Records{
			"A": {
				Record: []string{"192.168.1.1", "192.168.1.2"},
			},
			"AAAA": {
				Record: []string{"::1"},
			},
		},
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}

func TestIngestDNS_WithError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "5",
		Timestamp:     1234567890,
		Latency:       0,
		CronTimestamp: 1234567800,
		Uri:           "dns://example.com",
		Error:         1, // Error occurred
		Message:       "DNS resolution failed",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}
