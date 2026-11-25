package checker_test

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/checker"
	"golang.org/x/net/dns/dnsmessage"
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

// A TXT-only host has no address or CNAME; the check must still read its TXT
// record rather than fail on the empty IP lookup.
func TestDns_TXTOnlyHost(t *testing.T) {
	useStubResolver(t, map[string]stubRecords{
		"health.example.test": {txt: []string{"ok"}},
	})

	data, err := checker.Dns(t.Context(), "health.example.test")
	if err != nil {
		t.Fatalf("Dns() error = %v", err)
	}
	if len(data.A) != 0 || len(data.AAAA) != 0 {
		t.Errorf("Dns() expected no address records, got A=%v AAAA=%v", data.A, data.AAAA)
	}
	if len(data.TXT) != 1 || data.TXT[0] != "ok" {
		t.Errorf("Dns() TXT records = %v, want [ok]", data.TXT)
	}
}

// An apex domain is the one case that queries NS, so an empty NS answer must be
// tolerated like the address and CNAME lookups.
func TestDns_TXTOnlyApexDomain(t *testing.T) {
	useStubResolver(t, map[string]stubRecords{
		"example.test": {txt: []string{"ok"}},
	})

	data, err := checker.Dns(t.Context(), "example.test")
	if err != nil {
		t.Fatalf("Dns() error = %v", err)
	}
	if len(data.NS) != 0 {
		t.Errorf("Dns() expected no NS records, got %v", data.NS)
	}
	if len(data.TXT) != 1 || data.TXT[0] != "ok" {
		t.Errorf("Dns() TXT records = %v, want [ok]", data.TXT)
	}
}

func TestDns_ReturnsErrorWhenNoRecords(t *testing.T) {
	useStubResolver(t, map[string]stubRecords{})

	_, err := checker.Dns(t.Context(), "missing.example.test")
	if err == nil || !strings.Contains(err.Error(), "no DNS records found") {
		t.Errorf("expected a no DNS records error, got %v", err)
	}
}

type stubRecords struct {
	txt []string
}

// Points the package resolver at a local UDP server answering from records:
// a known name gets its records (or an empty answer), anything else NXDOMAIN.
func useStubResolver(t *testing.T, records map[string]stubRecords) {
	t.Helper()

	conn, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatalf("failed to open stub resolver: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	go func() {
		buf := make([]byte, 512)
		for {
			n, addr, err := conn.ReadFromUDP(buf)
			if err != nil {
				return
			}
			if reply, err := stubAnswer(buf[:n], records); err == nil {
				conn.WriteToUDP(reply, addr)
			}
		}
	}()

	serverAddr := conn.LocalAddr().String()
	checker.SetResolverForTest(t, &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "udp", serverAddr)
		},
	})
}

func stubAnswer(query []byte, records map[string]stubRecords) ([]byte, error) {
	var p dnsmessage.Parser
	header, err := p.Start(query)
	if err != nil {
		return nil, err
	}
	question, err := p.Question()
	if err != nil {
		return nil, err
	}

	name := strings.TrimSuffix(strings.ToLower(question.Name.String()), ".")
	record, known := records[name]

	rcode := dnsmessage.RCodeSuccess
	if !known {
		rcode = dnsmessage.RCodeNameError
	}

	b := dnsmessage.NewBuilder(nil, dnsmessage.Header{
		ID:                 header.ID,
		Response:           true,
		Authoritative:      true,
		RecursionAvailable: true,
		RCode:              rcode,
	})
	if err := b.StartQuestions(); err != nil {
		return nil, err
	}
	if err := b.Question(question); err != nil {
		return nil, err
	}
	if err := b.StartAnswers(); err != nil {
		return nil, err
	}
	if question.Type == dnsmessage.TypeTXT {
		for _, txt := range record.txt {
			hdr := dnsmessage.ResourceHeader{Name: question.Name, Class: dnsmessage.ClassINET, TTL: 60}
			if err := b.TXTResource(hdr, dnsmessage.TXTResource{TXT: []string{txt}}); err != nil {
				return nil, err
			}
		}
	}
	return b.Finish()
}
