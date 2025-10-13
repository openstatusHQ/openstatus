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
	h := server.NewPrivateLocationServer(testDB(),tinybird.NewClient(http.DefaultClient,""))

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
	h := server.NewPrivateLocationServer(testDB(),tinybird.NewClient(http.DefaultClient,""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{})
	req.Header().Set("openstatus-token", "token123")
	req.Msg.Id = "monitor1"
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
