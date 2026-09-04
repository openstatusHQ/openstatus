package checker_test

import (
	"strings"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/checker"
)

// skipIfNoICMP skips when the runtime cannot open an ICMP socket at all
// (unprivileged Linux CI without ping_group_range). macOS grants udp4 natively.
func skipIfNoICMP(t *testing.T, err error) {
	t.Helper()
	if err != nil && strings.Contains(err.Error(), "icmp socket error") {
		t.Skipf("icmp sockets unavailable in this environment: %v", err)
	}
}

func TestPingICMP_Loopback(t *testing.T) {
	res, err := checker.PingICMP(2000, "127.0.0.1")
	skipIfNoICMP(t, err)
	if err != nil {
		t.Fatalf("PingICMP() error = %v", err)
	}
	if res.PacketsReceived == 0 {
		t.Fatalf("PingICMP() received no packets: %+v", res)
	}
	if res.PacketsSent < res.PacketsReceived {
		t.Fatalf("PingICMP() received more than sent: %+v", res)
	}
	if res.LatencyMin > res.LatencyMax {
		t.Fatalf("PingICMP() min > max: %+v", res)
	}
	if len(res.Timing.RTTs) == 0 {
		t.Fatalf("PingICMP() empty timing: %+v", res)
	}
}

func TestPingICMP_ResolveError(t *testing.T) {
	_, err := checker.PingICMP(1000, "nonexistent-host-openstatus-test.invalid")
	if err == nil {
		t.Fatal("PingICMP() expected a resolve error, got nil")
	}
}

func TestPingICMP_Timeout(t *testing.T) {
	// 192.0.2.1 is TEST-NET-1 (RFC 5737): routable-looking but never answers.
	res, err := checker.PingICMP(1000, "192.0.2.1")
	skipIfNoICMP(t, err)
	if err == nil {
		t.Fatalf("PingICMP() expected timeout error, got %+v", res)
	}
}

// A zero timeout used to make the deadline land in the past, so the send loop
// broke before the first packet and every check reported "no reply" without
// probing. Callers that omit the field must still get a real check.
func TestPingICMP_ZeroTimeoutStillProbes(t *testing.T) {
	res, err := checker.PingICMP(0, "127.0.0.1")
	skipIfNoICMP(t, err)
	if err != nil {
		t.Fatalf("PingICMP() with a zero timeout must still probe, got %v", err)
	}
	if res.PacketsSent == 0 {
		t.Error("PingICMP() sent no packets with a zero timeout")
	}
	if res.PacketsReceived == 0 {
		t.Errorf("PingICMP() received no replies from loopback: %+v", res)
	}
}
