package server_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"connectrpc.com/connect"

	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	"github.com/openstatushq/openstatus/apps/private-location/internal/workflows"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
	"github.com/stretchr/testify/require"
)

type attemptsIngester interface {
	IngestTCP(context.Context, *connect.Request[private_locationv1.IngestTCPRequest]) (*connect.Response[private_locationv1.IngestTCPResponse], error)
	IngestHTTP(context.Context, *connect.Request[private_locationv1.IngestHTTPRequest]) (*connect.Response[private_locationv1.IngestHTTPResponse], error)
	IngestDNS(context.Context, *connect.Request[private_locationv1.IngestDNSRequest]) (*connect.Response[private_locationv1.IngestDNSResponse], error)
	IngestICMP(context.Context, *connect.Request[private_locationv1.IngestICMPRequest]) (*connect.Response[private_locationv1.IngestICMPResponse], error)
	IngestGRPC(context.Context, *connect.Request[private_locationv1.IngestGRPCRequest]) (*connect.Response[private_locationv1.IngestGRPCResponse], error)
}

func TestIngest_StoresAttempts(t *testing.T) {
	ingests := []struct {
		name string
		call func(h attemptsIngester, attempts int64) error
	}{
		{
			name: "tcp",
			call: func(h attemptsIngester, attempts int64) error {
				req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
					Id:            "attempts",
					MonitorId:     "6",
					Timestamp:     1234567890,
					CronTimestamp: 1234567800,
					Uri:           "10.0.0.1:5432",
					RequestStatus: "success",
					Attempts:      attempts,
				})
				req.Header().Set("openstatus-token", "my-secret-key")
				_, err := h.IngestTCP(context.Background(), req)
				return err
			},
		},
		{
			name: "http",
			call: func(h attemptsIngester, attempts int64) error {
				req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
					Id:            "attempts",
					MonitorId:     "5",
					Timestamp:     1234567890,
					CronTimestamp: 1234567800,
					Url:           "https://openstat.us",
					RequestStatus: "success",
					Attempts:      attempts,
				})
				req.Header().Set("openstatus-token", "my-secret-key")
				_, err := h.IngestHTTP(context.Background(), req)
				return err
			},
		},
		{
			name: "dns",
			call: func(h attemptsIngester, attempts int64) error {
				req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
					Id:            "attempts",
					MonitorId:     "5",
					Timestamp:     1234567890,
					CronTimestamp: 1234567800,
					Uri:           "openstat.us",
					RequestStatus: "success",
					Attempts:      attempts,
				})
				req.Header().Set("openstatus-token", "my-secret-key")
				_, err := h.IngestDNS(context.Background(), req)
				return err
			},
		},
		{
			name: "icmp",
			call: func(h attemptsIngester, attempts int64) error {
				req := connect.NewRequest(&private_locationv1.IngestICMPRequest{
					Id:            "attempts",
					MonitorId:     "5",
					Timestamp:     1234567890,
					CronTimestamp: 1234567800,
					Uri:           "openstat.us",
					RequestStatus: "success",
					Attempts:      attempts,
				})
				req.Header().Set("openstatus-token", "my-secret-key")
				_, err := h.IngestICMP(context.Background(), req)
				return err
			},
		},
		{
			name: "grpc",
			call: func(h attemptsIngester, attempts int64) error {
				req := connect.NewRequest(&private_locationv1.IngestGRPCRequest{
					Id:            "attempts",
					MonitorId:     "5",
					Timestamp:     1234567890,
					CronTimestamp: 1234567800,
					Uri:           "openstat.us:443",
					RequestStatus: "success",
					Attempts:      attempts,
				})
				req.Header().Set("openstatus-token", "my-secret-key")
				_, err := h.IngestGRPC(context.Background(), req)
				return err
			},
		},
	}

	values := []struct {
		name     string
		attempts int64
		want     int
	}{
		{name: "an old agent sends nothing", attempts: 0, want: 1},
		{name: "a retried check", attempts: 3, want: 3},
	}

	for _, ingest := range ingests {
		for _, value := range values {
			t.Run(ingest.name+"/"+value.name, func(t *testing.T) {
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
				h.WorkflowsClient = recordingWorkflows{called: make(chan workflows.Payload, 1)}

				require.NoError(t, ingest.call(h, value.attempts))

				var event struct {
					Attempts int `json:"attempts"`
				}
				require.NoError(t, json.Unmarshal(capturedBody, &event))
				require.Equal(t, value.want, event.Attempts)
			})
		}
	}
}
