package checker_test

import (
	"strings"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/checker"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func TestCheckGRPCServing(t *testing.T) {
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_SERVING,
		},
	})

	res, err := checker.CheckGRPC(5000, target, "", checker.GRPCTLSModePlaintext, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Completed || !res.Healthy {
		t.Fatalf("expected a healthy completed check, got %+v", res)
	}
	if res.ServingStatus != checker.ServingStatusServing {
		t.Fatalf("expected SERVING, got %q", res.ServingStatus)
	}
	if res.GRPCCode != int64(codes.OK) {
		t.Fatalf("expected code OK, got %d", res.GRPCCode)
	}
	if res.Timing.FirstByteStart == 0 || res.Timing.FirstByteDone == 0 {
		t.Fatalf("expected the call phase to be timed, got %+v", res.Timing)
	}
	if res.Timing.TlsHandshakeStart != 0 || res.Timing.TlsHandshakeDone != 0 {
		t.Fatalf("plaintext must not record a TLS phase, got %+v", res.Timing)
	}
}

func TestCheckGRPCNamedService(t *testing.T) {
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"checkout.v1.CheckoutService": grpc_health_v1.HealthCheckResponse_SERVING,
		},
	})

	res, err := checker.CheckGRPC(5000, target, "checkout.v1.CheckoutService", checker.GRPCTLSModePlaintext, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Healthy {
		t.Fatalf("expected the named service to be healthy, got %+v", res)
	}
}

func TestCheckGRPCNotServing(t *testing.T) {
	// A loopback call rounds to 0 ms, which cannot be told apart from a latency
	// that was discarded. The delay makes the assertion mean something.
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_NOT_SERVING,
		},
		delay: 30 * time.Millisecond,
	})

	res, err := checker.CheckGRPC(5000, target, "", checker.GRPCTLSModePlaintext, nil)
	if err != nil {
		t.Fatalf("NOT_SERVING is an answer, not a transport failure: %v", err)
	}
	if !res.Completed {
		t.Fatal("expected Completed to be true")
	}
	if res.Healthy {
		t.Fatal("expected Healthy to be false")
	}
	if res.ServingStatus != checker.ServingStatusNotServing {
		t.Fatalf("expected NOT_SERVING, got %q", res.ServingStatus)
	}
	if res.Latency < 20 {
		t.Fatalf("a completed call must keep its measured latency, got %d", res.Latency)
	}
	if res.Timing.FirstByteDone == 0 {
		t.Fatalf("a completed call must keep its timing, got %+v", res.Timing)
	}
	if res.Message != "service reports NOT_SERVING" {
		t.Fatalf("unexpected message %q", res.Message)
	}
}

func TestCheckGRPCServiceUnknown(t *testing.T) {
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_SERVING,
		},
	})

	res, err := checker.CheckGRPC(5000, target, "missing.Service", checker.GRPCTLSModePlaintext, nil)
	if err != nil {
		t.Fatalf("an unknown service is an answer, not a transport failure: %v", err)
	}
	if !res.Completed || res.Healthy {
		t.Fatalf("expected a completed unhealthy check, got %+v", res)
	}
	if res.ServingStatus != checker.ServingStatusServiceUnknown {
		t.Fatalf("expected SERVICE_UNKNOWN, got %q", res.ServingStatus)
	}
	if !strings.Contains(res.Message, "missing.Service") {
		t.Fatalf("expected the message to name the service, got %q", res.Message)
	}
}

func TestCheckGRPCUnimplemented(t *testing.T) {
	target := newHealthServer(t, healthServerOptions{omitHealthService: true})

	res, err := checker.CheckGRPC(5000, target, "", checker.GRPCTLSModePlaintext, nil)
	if err != nil {
		t.Fatalf("a reachable server without the health service still completed: %v", err)
	}
	if !res.Completed || res.Healthy {
		t.Fatalf("expected a completed unhealthy check, got %+v", res)
	}
	if res.GRPCCode != int64(codes.Unimplemented) {
		t.Fatalf("expected UNIMPLEMENTED, got code %d", res.GRPCCode)
	}
	if res.Message != "server does not implement grpc.health.v1.Health" {
		t.Fatalf("unexpected message %q", res.Message)
	}
	if res.ServingStatus != "" {
		t.Fatalf("no serving status can be known here, got %q", res.ServingStatus)
	}
}

func TestCheckGRPCConnectionRefused(t *testing.T) {
	res, err := checker.CheckGRPC(5000, closedPort(t), "", checker.GRPCTLSModePlaintext, nil)
	if err == nil {
		t.Fatal("expected a transport failure")
	}
	if res.Completed {
		t.Fatal("expected Completed to be false")
	}
	if res.Latency != 0 {
		t.Fatalf("a call that never completed has no latency, got %d", res.Latency)
	}
	if err.Error() != "connection refused" {
		t.Fatalf("unexpected message %q", err.Error())
	}
}

func TestCheckGRPCTimeout(t *testing.T) {
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_SERVING,
		},
		delay: 2 * time.Second,
	})

	res, err := checker.CheckGRPC(200, target, "", checker.GRPCTLSModePlaintext, nil)
	if err == nil {
		t.Fatal("expected a deadline failure")
	}
	if res.Completed {
		t.Fatal("expected Completed to be false")
	}
	if !strings.HasPrefix(err.Error(), "timeout after") {
		t.Fatalf("unexpected message %q", err.Error())
	}
}

func TestCheckGRPCInvalidTarget(t *testing.T) {
	if _, err := checker.CheckGRPC(5000, "api.example.com", "", checker.GRPCTLSModeTLS, nil); err == nil {
		t.Fatal("expected a portless target to be rejected")
	}
}

func TestCheckGRPCTLSInsecureAcceptsSelfSigned(t *testing.T) {
	cert := newSelfSignedCert(t)
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_SERVING,
		},
		cert: &cert,
	})

	res, err := checker.CheckGRPC(5000, target, "", checker.GRPCTLSModeTLSInsecure, nil)
	if err != nil {
		t.Fatalf("tls_insecure must accept a self-signed certificate: %v", err)
	}
	if !res.Healthy {
		t.Fatalf("expected SERVING, got %+v", res)
	}
	if res.Timing.TlsHandshakeStart == 0 || res.Timing.TlsHandshakeDone == 0 {
		t.Fatalf("expected the TLS phase to be timed, got %+v", res.Timing)
	}
}

func TestCheckGRPCTLSRejectsSelfSigned(t *testing.T) {
	cert := newSelfSignedCert(t)
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_SERVING,
		},
		cert: &cert,
	})

	res, err := checker.CheckGRPC(5000, target, "", checker.GRPCTLSModeTLS, nil)
	if err == nil {
		t.Fatal("tls mode must reject a self-signed certificate")
	}
	if res.Completed {
		t.Fatal("expected Completed to be false")
	}
	if err.Error() != "certificate verification failed" {
		t.Fatalf("unexpected message %q", err.Error())
	}
	if strings.Contains(err.Error(), "openstatus-test") || strings.Contains(err.Error(), "x509") {
		t.Fatalf("the certificate subject must never reach the caller: %q", err.Error())
	}
}

func TestCheckGRPCTLSAgainstPlaintextServer(t *testing.T) {
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_SERVING,
		},
	})

	if _, err := checker.CheckGRPC(2000, target, "", checker.GRPCTLSModeTLS, nil); err == nil {
		t.Fatal("expected TLS against a plaintext server to fail")
	}
}

func TestCheckGRPCMetadataReachesTheServer(t *testing.T) {
	target := newHealthServer(t, healthServerOptions{
		statuses: map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{
			"": grpc_health_v1.HealthCheckResponse_SERVING,
		},
	})

	res, err := checker.CheckGRPC(5000, target, "", checker.GRPCTLSModePlaintext,
		map[string]string{"authorization": "Bearer token"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Healthy {
		t.Fatalf("expected SERVING, got %+v", res)
	}
}
