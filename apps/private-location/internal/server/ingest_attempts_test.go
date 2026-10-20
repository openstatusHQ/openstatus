package server_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"sync"
	"testing"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const finalCronTimestamp = 1234567800

type tinybirdRecorder struct {
	mu     sync.Mutex
	events map[string][]map[string]json.RawMessage
}

func newTinybirdRecorder(t *testing.T) (*tinybirdRecorder, tinybird.Client) {
	t.Helper()
	rec := &tinybirdRecorder{events: map[string][]map[string]json.RawMessage{}}
	interceptor := &interceptorHTTPClient{
		f: func(req *http.Request) (*http.Response, error) {
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			var row map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(body, &row))

			rec.mu.Lock()
			name := req.URL.Query().Get("name")
			rec.events[name] = append(rec.events[name], row)
			rec.mu.Unlock()

			return &http.Response{StatusCode: http.StatusAccepted}, nil
		},
	}

	return rec, tinybird.NewClient(interceptor.GetHTTPClient(), "apiKey")
}

func (r *tinybirdRecorder) rows(dataSource string) []map[string]json.RawMessage {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.events[dataSource]
}

func authed[T any](msg *T) *connect.Request[T] {
	req := connect.NewRequest(msg)
	req.Header().Set("openstatus-token", "my-secret-key")

	return req
}

func assertAttemptRows(t *testing.T, rows []map[string]json.RawMessage, ids ...string) {
	t.Helper()
	require.Len(t, rows, len(ids))
	for i, row := range rows {
		assert.JSONEq(t, `"`+ids[i]+`"`, string(row["id"]))
		assert.JSONEq(t, `"error"`, string(row["requestStatus"]))
		assert.Equal(t, json.RawMessage(`1`), row["error"])
		assert.Equal(t, json.RawMessage(`1234567800`), row["cronTimestamp"], "attempts join the final row on its cronTimestamp")
		assert.Equal(t, json.RawMessage(strconv.Itoa(i+1)), row["attempt"])
		assert.NotContains(t, row, "attempts")
	}
}

func TestIngestHTTP_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := server.NewPrivateLocationServer(testDB(), client)

	_, err := h.IngestHTTP(context.Background(), authed(&private_locationv1.IngestHTTPRequest{
		Id: "final", MonitorId: "5", Timestamp: 1234567890, CronTimestamp: finalCronTimestamp, StatusCode: 200,
		RequestStatus: "success",
		Attempts: []*private_locationv1.HTTPAttempt{
			{Id: "a1", Timestamp: 1234567810, StatusCode: 503, RequestStatus: "error", Error: 1, Body: "down"},
			{Id: "a2", Timestamp: 1234567850, StatusCode: 502, RequestStatus: "error", Error: 1},
		},
	}))
	require.NoError(t, err)

	attempts := rec.rows(tinybird.DatasourceHTTPAttempt)
	assertAttemptRows(t, attempts, "a1", "a2")
	assert.Equal(t, json.RawMessage(`503`), attempts[0]["statusCode"])
	assert.JSONEq(t, `"down"`, string(attempts[0]["body"]))
	assert.Equal(t, json.RawMessage(`1234567810`), attempts[0]["timestamp"])

	final := rec.rows(tinybird.DatasourceHTTP)
	require.Len(t, final, 1)
	assert.Equal(t, json.RawMessage(`3`), final[0]["attempts"])
}

func TestIngestHTTP_NoAttemptsFromAnOldAgent(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := server.NewPrivateLocationServer(testDB(), client)

	_, err := h.IngestHTTP(context.Background(), authed(&private_locationv1.IngestHTTPRequest{
		Id: "final", MonitorId: "5", Timestamp: 1234567890, CronTimestamp: finalCronTimestamp,
	}))
	require.NoError(t, err)

	assert.Empty(t, rec.rows(tinybird.DatasourceHTTPAttempt))
	final := rec.rows(tinybird.DatasourceHTTP)
	require.Len(t, final, 1)
	assert.Equal(t, json.RawMessage(`1`), final[0]["attempts"])
}

func TestIngestTCP_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := server.NewPrivateLocationServer(testDB(), client)

	_, err := h.IngestTCP(context.Background(), authed(&private_locationv1.IngestTCPRequest{
		Id: "final", MonitorId: "5", Timestamp: 1234567890, CronTimestamp: finalCronTimestamp,
		Attempts: []*private_locationv1.TCPAttempt{
			{Id: "a1", Timestamp: 1234567810, RequestStatus: "error", Error: 1, Message: "refused"},
		},
	}))
	require.NoError(t, err)

	attempts := rec.rows(tinybird.DatasourceTCPAttempt)
	assertAttemptRows(t, attempts, "a1")
	assert.JSONEq(t, `"refused"`, string(attempts[0]["errorMessage"]))
	assert.Equal(t, json.RawMessage(`2`), rec.rows(tinybird.DatasourceTCP)[0]["attempts"])
}

func TestIngestDNS_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := server.NewPrivateLocationServer(testDB(), client)

	_, err := h.IngestDNS(context.Background(), authed(&private_locationv1.IngestDNSRequest{
		Id: "final", MonitorId: "5", Timestamp: 1234567890, CronTimestamp: finalCronTimestamp,
		Attempts: []*private_locationv1.DNSAttempt{{
			Id: "a1", Timestamp: 1234567810, RequestStatus: "error", Error: 1,
			Records: map[string]*private_locationv1.Records{"A": {Record: []string{"1.2.3.4"}}},
		}},
	}))
	require.NoError(t, err)

	attempts := rec.rows(tinybird.DatasourceDNSAttempt)
	assertAttemptRows(t, attempts, "a1")
	assert.JSONEq(t, `"{\"A\":[\"1.2.3.4\"]}"`, string(attempts[0]["records"]))
	assert.Equal(t, json.RawMessage(`2`), rec.rows(tinybird.DatasourceDNS)[0]["attempts"])
}

func TestIngestICMP_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := server.NewPrivateLocationServer(testDB(), client)

	_, err := h.IngestICMP(context.Background(), authed(&private_locationv1.IngestICMPRequest{
		Id: "final", MonitorId: "5", Timestamp: 1234567890, CronTimestamp: finalCronTimestamp,
		Attempts: []*private_locationv1.ICMPAttempt{
			{Id: "a1", Timestamp: 1234567810, RequestStatus: "error", Error: 1, PacketsSent: 3},
		},
	}))
	require.NoError(t, err)

	attempts := rec.rows(tinybird.DatasourceICMPAttempt)
	assertAttemptRows(t, attempts, "a1")
	assert.Equal(t, json.RawMessage(`3`), attempts[0]["packetsSent"])
	assert.Equal(t, json.RawMessage(`2`), rec.rows(tinybird.DatasourceICMP)[0]["attempts"])
}

func TestIngestGRPC_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := server.NewPrivateLocationServer(testDB(), client)

	_, err := h.IngestGRPC(context.Background(), authed(&private_locationv1.IngestGRPCRequest{
		Id: "final", MonitorId: "5", Timestamp: 1234567890, CronTimestamp: finalCronTimestamp,
		Attempts: []*private_locationv1.GRPCAttempt{
			{Id: "a1", Timestamp: 1234567810, RequestStatus: "error", Error: 1, GrpcCode: 14},
		},
	}))
	require.NoError(t, err)

	attempts := rec.rows(tinybird.DatasourceGRPCAttempt)
	assertAttemptRows(t, attempts, "a1")
	assert.Equal(t, json.RawMessage(`14`), attempts[0]["grpcCode"])
	assert.Equal(t, json.RawMessage(`2`), rec.rows(tinybird.DatasourceGRPC)[0]["attempts"])
}

func TestIngest_AttemptValidation(t *testing.T) {
	_, client := newTinybirdRecorder(t)
	h := server.NewPrivateLocationServer(testDB(), client)

	tooMany := make([]*private_locationv1.HTTPAttempt, 255)
	for i := range tooMany {
		tooMany[i] = &private_locationv1.HTTPAttempt{Timestamp: 1234567810}
	}

	tests := []struct {
		name string
		call func() error
	}{
		{"too many attempts", func() error {
			_, err := h.IngestHTTP(context.Background(), authed(&private_locationv1.IngestHTTPRequest{
				MonitorId: "5", Timestamp: 1234567890, Attempts: tooMany,
			}))

			return err
		}},
		{"attempt without timestamp", func() error {
			_, err := h.IngestTCP(context.Background(), authed(&private_locationv1.IngestTCPRequest{
				MonitorId: "5", Timestamp: 1234567890, Attempts: []*private_locationv1.TCPAttempt{{}},
			}))

			return err
		}},
		{"attempt with negative latency", func() error {
			_, err := h.IngestDNS(context.Background(), authed(&private_locationv1.IngestDNSRequest{
				MonitorId: "5", Timestamp: 1234567890,
				Attempts: []*private_locationv1.DNSAttempt{{Timestamp: 1, Latency: -1}},
			}))

			return err
		}},
		{"attempt with invalid grpc code", func() error {
			_, err := h.IngestGRPC(context.Background(), authed(&private_locationv1.IngestGRPCRequest{
				MonitorId: "5", Timestamp: 1234567890,
				Attempts: []*private_locationv1.GRPCAttempt{{Timestamp: 1, GrpcCode: 99}},
			}))

			return err
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(tt.call()))
		})
	}
}
