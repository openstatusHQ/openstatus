package server_test

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/jmoiron/sqlx"
	"github.com/libsql/sqlite-antlr4-parser/sqliteparserutils"
	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	"github.com/openstatushq/openstatus/apps/private-location/internal/workflows"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
	"github.com/stretchr/testify/require"
)

func testDB() *sqlx.DB {

	f, err := os.CreateTemp("", "db")
	if err != nil {
		log.Fatalln(err)
	}
	db, err := database.Open("file:"+f.Name(), "")
	if err != nil {
		log.Fatalln(err)
	}
	// libSQL enforces foreign keys by default and the fixture isn't insert-ordered.
	// The pragma is per-connection, so pin the pool to a single connection.
	db.SetMaxOpenConns(1)
	db.MustExec("PRAGMA foreign_keys = OFF")

	dat, err := os.ReadFile("./db_testdata")
	if err != nil {
		log.Fatalln(err)
	}
	// libSQL executes a single statement per call, so run the fixture one statement at a time.
	stmts, info := sqliteparserutils.SplitStatement(string(dat))
	if info.IncompleteCreateTriggerStatement || info.IncompleteMultilineComment {
		log.Fatalln("db_testdata ends with an incomplete statement")
	}
	for _, stmt := range stmts {
		db.MustExec(stmt)
	}

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

func TestIngestHTTP_UnknownToken(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{})
	req.Header().Set("openstatus-token", "token123")
	req.Msg.Id = "monitor1"
	req.Msg.MonitorId = "nonexistent"
	req.Msg.Timestamp = 1234567890
	resp, err := h.IngestHTTP(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for unknown token, got nil")
	}
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("expected unauthenticated code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

// TestIngestHTTP_DBError keeps a genuine database failure at 500: only the
// not-found lookups moved off CodeInternal.
func TestIngestHTTP_DBError(t *testing.T) {
	db := testDB()
	h := server.NewPrivateLocationServer(db, getTBClient(context.Background()))
	require.NoError(t, db.Close())

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		Id:        "monitor1",
		MonitorId: "5",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

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
		t.Fatalf("expected error for missing monitor, got nil")
	}
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("expected not found code, got %v", connect.CodeOf(err))
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

// TestIngestHTTP_DuplicateTokenStillIngests guards the joined lookup:
// private_location.token is not unique, so an unlinked location sharing the
// token must not shadow a monitor that is genuinely linked. The token-only half
// of the lookup would pick the first (unlinked) row and 404 a valid monitor.
func TestIngestHTTP_DuplicateTokenStillIngests(t *testing.T) {
	db := testDB()
	// Inserted first so a token-only lookup returns the unlinked location.
	db.MustExec("INSERT INTO private_location (id, name, token, workspace_id, created_at, updated_at) VALUES (100, 'Wrong', 'dup-token', 3, 1760358329, 1760358329), (101, 'Right', 'dup-token', 3, 1760358329, 1760358329)")
	db.MustExec("INSERT INTO monitor (id, workspace_id, url, name) VALUES (50, 3, 'https://example.com', 'Dup monitor')")
	db.MustExec("INSERT INTO private_location_to_monitor (private_location_id, monitor_id, created_at) VALUES (101, 50, 1760358329)")

	h := server.NewPrivateLocationServer(db, getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		Id:        "dup-1",
		MonitorId: "50",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "dup-token")

	resp, err := h.IngestHTTP(context.Background(), req)
	require.NoError(t, err)
	require.NotNil(t, resp)
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

// TestIngestHTTP_ForwardsErrorAndMessage guards against the probe's error flag
// and failure message being dropped on the way to Tinybird and alerting: the
// `error` column stayed 0 for every private check and alerts had empty bodies.
func TestIngestHTTP_ForwardsErrorAndMessage(t *testing.T) {
	var capturedBody []byte
	interceptor := &interceptorHTTPClient{
		f: func(req *http.Request) (*http.Response, error) {
			if req.Body != nil {
				capturedBody, _ = io.ReadAll(req.Body)
			}
			return &http.Response{StatusCode: http.StatusAccepted}, nil
		},
	}
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(interceptor.GetHTTPClient(), "apiKey"))
	workflowsClient := recordingWorkflows{called: make(chan workflows.Payload, 1)}
	h.WorkflowsClient = workflowsClient

	const message = "Request failed with status code 500"
	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		Id:            "request-err",
		MonitorId:     "5",
		Timestamp:     1234567890,
		CronTimestamp: 1234567800,
		Url:           "https://example.com/api",
		RequestStatus: "error",
		StatusCode:    500,
		Error:         1,
		Message:       message,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	_, err := h.IngestHTTP(context.Background(), req)
	require.NoError(t, err)

	var event struct {
		Error   uint8  `json:"error"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(capturedBody, &event))
	require.Equal(t, uint8(1), event.Error)
	require.Equal(t, message, event.Message)

	select {
	case payload := <-workflowsClient.called:
		require.Equal(t, "error", payload.Status)
		require.Equal(t, message, payload.Message)
	case <-time.After(2 * time.Second):
		t.Fatal("expected the failed check to be forwarded to the workflows service")
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
