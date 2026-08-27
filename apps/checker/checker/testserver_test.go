package checker_test

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"net"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// newSelfSignedCert mints a certificate for localhost. Nothing in the Go tier
// ships a TLS fixture, and the tls/tls_insecure modes cannot be exercised
// without a server presenting a certificate the system store will reject.
func newSelfSignedCert(t *testing.T) tls.Certificate {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "openstatus-test"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		DNSNames:     []string{"localhost"},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}

	der, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}

	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
}

type healthServerOptions struct {
	// statuses registers a serving status per service name. The empty key is
	// the overall server status.
	statuses map[string]grpc_health_v1.HealthCheckResponse_ServingStatus
	// omitHealthService starts a gRPC server with no health service registered,
	// which is what a real server missing the registration looks like.
	omitHealthService bool
	cert              *tls.Certificate
	delay             time.Duration
}

// newHealthServer starts a health server on a loopback port and returns its
// host:port. The listener is closed when the test finishes.
func newHealthServer(t *testing.T, opts healthServerOptions) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	var serverOpts []grpc.ServerOption
	if opts.cert != nil {
		serverOpts = append(serverOpts, grpc.Creds(credentials.NewServerTLSFromCert(opts.cert)))
	}
	if opts.delay > 0 {
		delay := opts.delay
		serverOpts = append(serverOpts, grpc.UnaryInterceptor(
			func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
				select {
				case <-time.After(delay):
				case <-ctx.Done():
					return nil, ctx.Err()
				}
				return handler(ctx, req)
			},
		))
	}

	server := grpc.NewServer(serverOpts...)

	if !opts.omitHealthService {
		healthServer := health.NewServer()
		for service, status := range opts.statuses {
			healthServer.SetServingStatus(service, status)
		}
		grpc_health_v1.RegisterHealthServer(server, healthServer)
	}

	go func() {
		_ = server.Serve(listener)
	}()
	t.Cleanup(server.Stop)

	return listener.Addr().String()
}

// closedPort returns a host:port nothing is listening on.
func closedPort(t *testing.T) string {
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
