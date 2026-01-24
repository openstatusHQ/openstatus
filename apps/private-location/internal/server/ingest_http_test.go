package server_test

import (
	"context"
	"log"
	"net/http"
	"os"
	"testing"

	"connectrpc.com/connect"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

func testDB() *sqlx.DB {

	f, err := os.CreateTemp("", "db")
	if err != nil {
		log.Fatalln(err)
	}
	db, err := sqlx.Connect("sqlite3", f.Name())
	if err != nil {
		log.Fatalln(err)
	}
	dat, err := os.ReadFile("./db_testdata")
	db.MustExec(string(dat))

	return db
}

type interceptorHTTPClient struct {
	f func(req *http.Request) (*http.Response, error)
}

func (i *interceptorHTTPClient) RoundTrip(req *http.Request) (*http.Response, error) {
	return i.f(req)
}

func (i *interceptorHTTPClient) GetHTTPClient() *http.Client {
	return &http.Client{
		Transport: i,
	}
}

func getTBClient(ctx context.Context) tinybird.Client {
	interceptor := &interceptorHTTPClient{
		f: func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusAccepted,
			}, nil
		},
	}

	client := tinybird.NewClient(interceptor.GetHTTPClient(), "apiKey")
	return client
}

func TestIngestHTTP_Unauthenticated(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{})
	// No token header
	resp, err := h.IngestHTTP(context.Background(), req)
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

func TestIngestHTTP_DBError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{})
	req.Header().Set("openstatus-token", "token123")
	req.Msg.Id = "monitor1"
	req.Msg.MonitorId = "nonexistent"
	req.Msg.Timestamp = 1234567890
	resp, err := h.IngestHTTP(context.Background(), req)
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

func TestIngestHTTP_MonitorNotExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")
	req.Msg.Id = "monitor1"
	req.Msg.MonitorId = "nonexistent"
	req.Msg.Timestamp = 1234567890
	resp, err := h.IngestHTTP(context.Background(), req)
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

func TestIngestHTTP_MonitorExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")
	req.Msg.Id = "monitor1"
	req.Msg.MonitorId = "5"
	req.Msg.Timestamp = 1234567890
	resp, err := h.IngestHTTP(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if resp == nil {
		t.Errorf("expected not nil response, got %v", resp)
	}
}

func TestIngestHTTP_ValidationError_EmptyMonitorID(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		MonitorId: "",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestHTTP(context.Background(), req)
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

func TestIngestHTTP_ValidationError_InvalidTimestamp(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		MonitorId: "5",
		Timestamp: 0,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestHTTP(context.Background(), req)
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

func TestIngestHTTP_ValidationError_NegativeLatency(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		MonitorId: "5",
		Latency:   -100,
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestHTTP(context.Background(), req)
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

func TestIngestHTTP_WithFullData(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		Id:            "request-1",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       150,
		CronTimestamp: 1234567800,
		Url:           "https://example.com/api",
		StatusCode:    200,
		Timing:        "150ms",
		Body:          `{"status": "ok"}`,
		Headers:       `{"Content-Type": "application/json"}`,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestHTTP(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}

func TestIngestHTTP_WithError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		Id:            "request-1",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       0,
		CronTimestamp: 1234567800,
		Url:           "https://example.com/api",
		Error:         1,
		Message:       "Connection timeout",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestHTTP(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}
