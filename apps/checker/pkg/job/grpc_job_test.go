package job_test

import (
	"context"
	"encoding/json"
	"net"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func grpcJobServer(t *testing.T, status grpc_health_v1.HealthCheckResponse_ServingStatus, delay time.Duration) (string, func() int) {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	calls := 0
	server := grpc.NewServer(grpc.UnaryInterceptor(
		func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
			calls++
			if delay > 0 {
				select {
				case <-time.After(delay):
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			return handler(ctx, req)
		},
	))

	healthServer := health.NewServer()
	healthServer.SetServingStatus("", status)
	grpc_health_v1.RegisterHealthServer(server, healthServer)

	go func() {
		_ = server.Serve(listener)
	}()
	t.Cleanup(server.Stop)

	return listener.Addr().String(), func() int { return calls }
}

func closedGRPCPort(t *testing.T) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	return addr
}

func TestGRPCJobServing(t *testing.T) {
	target, _ := grpcJobServer(t, grpc_health_v1.HealthCheckResponse_SERVING, 0)

	data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
		Id:      "1",
		Uri:     target,
		TlsMode: "plaintext",
		Timeout: 5000,
		Retry:   3,
	}, "ams")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if data.RequestStatus != "success" {
		t.Fatalf(`expected "success", got %q`, data.RequestStatus)
	}
	if data.ServingStatus != "SERVING" {
		t.Fatalf("expected SERVING, got %q", data.ServingStatus)
	}
	if data.Error != 0 {
		t.Fatalf("expected error 0, got %d", data.Error)
	}
	assertStamped(t, data)
}

// ValidateIngestGRPCRequest rejects a non-positive timestamp, so a result that
// forgets to stamp them is silently dropped at ingest.
func assertStamped(t *testing.T, data *job.GRPCPrivateRegionData) {
	t.Helper()

	if data.Timestamp <= 0 {
		t.Fatalf("Timestamp must be stamped, got %d", data.Timestamp)
	}
	if data.CronTimestamp <= 0 {
		t.Fatalf("CronTimestamp must be stamped, got %d", data.CronTimestamp)
	}
	if data.ID == "" {
		t.Fatal("ID must be stamped")
	}
}

func TestGRPCJobNotServingIsProbedOnce(t *testing.T) {
	target, calls := grpcJobServer(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, 0)

	data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
		Id:      "1",
		Uri:     target,
		TlsMode: "plaintext",
		Timeout: 5000,
		Retry:   3,
	}, "ams")
	if err != nil {
		t.Fatalf("NOT_SERVING is an answer, not a job failure: %v", err)
	}

	if data.RequestStatus != "error" {
		t.Fatalf(`expected "error", got %q`, data.RequestStatus)
	}
	if data.Error != 1 {
		t.Fatalf("expected error 1, got %d", data.Error)
	}
	if got := calls(); got != 1 {
		t.Fatalf("a definitive answer must be probed once, got %d probes", got)
	}
	assertStamped(t, data)
}

func TestGRPCJobDegraded(t *testing.T) {
	// Loopback rounds to 0 ms, so the threshold can only be crossed by a server
	// that actually takes time to answer.
	target, _ := grpcJobServer(t, grpc_health_v1.HealthCheckResponse_SERVING, 40*time.Millisecond)

	degradedAt := int64(10)
	data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
		Id:         "1",
		Uri:        target,
		TlsMode:    "plaintext",
		Timeout:    5000,
		Retry:      3,
		DegradedAt: &degradedAt,
	}, "ams")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if data.RequestStatus != "degraded" {
		t.Fatalf(`expected "degraded", got %q`, data.RequestStatus)
	}
	if data.Error != 0 {
		t.Fatalf("a degraded check is not an error, got %d", data.Error)
	}
}

// A transport failure that exhausts its retries still has to produce a stamped
// row: returning (nil, err) would leave the scheduler nothing to forward.
func TestGRPCJobTransportFailureStillStamps(t *testing.T) {
	data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
		Id:      "1",
		Uri:     closedGRPCPort(t),
		TlsMode: "plaintext",
		Timeout: 300,
		Retry:   1,
	}, "ams")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if data.RequestStatus != "error" {
		t.Fatalf(`expected "error", got %q`, data.RequestStatus)
	}
	if data.Error != 1 {
		t.Fatalf("expected error 1, got %d", data.Error)
	}
	if data.Message == "" {
		t.Fatal("a failed check must carry its diagnosis")
	}
	assertStamped(t, data)
}

// The phases that completed before the failure are what separate a DNS problem
// from a TLS one once the row is in Tinybird.
func TestGRPCJobKeepsPartialTiming(t *testing.T) {
	data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
		Id:      "1",
		Uri:     closedGRPCPort(t),
		TlsMode: "plaintext",
		Timeout: 300,
		Retry:   1,
	}, "ams")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var timing map[string]int64
	if err := json.Unmarshal([]byte(data.Timing), &timing); err != nil {
		t.Fatalf("timing must be valid json, got %q: %v", data.Timing, err)
	}
	if _, ok := timing["dnsStart"]; !ok {
		t.Fatalf("expected the HTTP phase shape, got %v", timing)
	}
}

func TestGRPCJobRespectsContextCancellation(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	if _, err := job.NewJobRunner().GRPCJob(ctx, &v1.GRPCMonitor{
		Id:      "1",
		Uri:     closedGRPCPort(t),
		TlsMode: "plaintext",
		Timeout: 5000,
		Retry:   5,
	}, "ams"); err == nil {
		t.Fatal("expected the cancelled context to end the job")
	}
}
