package checker_test

import (
	"context"
	"errors"
	"net"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/checker"
)

func TestPingDNS(t *testing.T) {
	ctx := t.Context()
	data, err := checker.Dns(ctx, "openstat.us")
	if err != nil {
		t.Errorf("Dns() error = %v", err)
	}
	if len(data.A) == 0 {
		t.Errorf("Dns() A records = %v", data.A)
	}
}

// A stalled resolver must not outlive the deadline: the probe runs as a
// single-instance job, so a hung lookup blocks the monitor's next runs.
func TestDns_HonoursContextDeadline(t *testing.T) {
	useBlackholeResolver(t)

	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		_, err := checker.Dns(ctx, "openstatus.dev")
		done <- err
	}()

	select {
	case err := <-done:
		if err == nil {
			t.Fatal("expected a lookup error against a blackholed resolver")
		}
	case <-time.After(10 * time.Second):
		t.Fatal("Dns() ignored the context deadline and is still blocked")
	}
}

func TestDns_ReturnsErrorOnAlreadyCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := checker.Dns(ctx, "openstatus.dev"); !errors.Is(err, context.Canceled) {
		t.Errorf("expected a context.Canceled error, got %v", err)
	}
}

// Points the package resolver at a UDP socket that accepts queries and never
// answers, so lookups hang until the context stops them.
func useBlackholeResolver(t *testing.T) {
	t.Helper()

	conn, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatalf("failed to open blackhole resolver: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	addr := conn.LocalAddr().String()
	checker.SetResolverForTest(t, &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, network, addr)
		},
	})
}
