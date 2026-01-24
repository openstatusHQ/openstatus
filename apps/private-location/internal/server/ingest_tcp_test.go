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

func TestIngestTCP_Unauthenticated(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{})
	// No token header
	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_DBError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{})
	req.Header().Set("openstatus-token", "token123")
	req.Msg.Id = "monitor1"
	req.Msg.Timestamp = 1234567890
	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_ValidationError_EmptyID(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_ValidationError_InvalidTimestamp(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "tcp-123",
		Timestamp: 0,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_ValidationError_NegativeLatency(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "tcp-123",
		Latency:   -100,
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_MonitorNotExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "nonexistent-monitor",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_MonitorExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:            "5",
		Timestamp:     1234567890,
		Latency:       50,
		CronTimestamp: 1234567800,
		Uri:           "tcp://example.com:8080",
		Timing:        "50ms",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}

func TestIngestTCP_WithError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:            "5",
		Timestamp:     1234567890,
		Latency:       0,
		CronTimestamp: 1234567800,
		Uri:           "tcp://example.com:8080",
		Error:         1,
		Message:       "Connection refused",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}
