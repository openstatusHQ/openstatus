package main

import (
	"context"
	"errors"
	"net"
	"testing"
)

func TestIsPublicDomain(t *testing.T) {
	accepted := []string{
		"status.cal.com",
		"status.openstatus.dev",
		"cal.com",
		"a-b.example.co.uk",
	}
	for _, name := range accepted {
		if !isPublicDomain(name) {
			t.Errorf("isPublicDomain(%q) = false, want true", name)
		}
	}

	rejected := []string{
		"",                // empty
		"localhost",       // no dot
		"cal",             // no dot: that's a slug, handled elsewhere
		"169.254.169.254", // the metadata endpoint, dressed as a hostname
		"127.0.0.1",       // loopback literal
		"10.0.0.1",        // private literal
		"[::1]",           // v6 literal
		"fdaa:0:1::3",     // fly 6PN literal
		"redis.internal",  // fly private dns
		"app.flycast",     // fly private dns
		"printer.local",   // mdns
		"api.localhost",   // loopback by name
		"1.0.0.127.in-addr.arpa",
		"example.com/../x", // path smuggling
		"user@example.com", // credentials
		"example.com:8080", // explicit port
		"-bad.example.com", // label starts with a hyphen
		"bad-.example.com", // label ends with a hyphen
		"under_score.com",  // not a legal hostname
		"example..com",     // empty label
	}
	for _, name := range rejected {
		if isPublicDomain(name) {
			t.Errorf("isPublicDomain(%q) = true, want false", name)
		}
	}
}

func TestIsPublicIP(t *testing.T) {
	public := []string{"1.1.1.1", "104.18.1.62", "2606:4700::1111"}
	for _, ip := range public {
		if !isPublicIP(net.ParseIP(ip)) {
			t.Errorf("isPublicIP(%q) = false, want true", ip)
		}
	}

	private := []string{
		"127.0.0.1",         // loopback
		"::1",               // loopback v6
		"10.1.2.3",          // RFC 1918
		"172.16.0.1",        // RFC 1918
		"192.168.1.1",       // RFC 1918
		"169.254.169.254",   // metadata
		"fdaa:0:1::3",       // fly 6PN, inside fc00::/7
		"fc00::1",           // ULA
		"fe80::1",           // link-local
		"0.0.0.0",           // unspecified
		"100.64.0.1",        // carrier-grade NAT
		"198.18.0.1",        // benchmarking
		"240.0.0.1",         // reserved
		"::ffff:127.0.0.1",  // loopback wearing a v6 costume
		"::ffff:10.0.0.1",   // rfc1918 wearing a v6 costume
		"2002:0a00:0001::1", // 6to4 wrapping 10.0.0.1
	}
	for _, ip := range private {
		if isPublicIP(net.ParseIP(ip)) {
			t.Errorf("isPublicIP(%q) = true, want false", ip)
		}
	}
}

func TestResolveTarget(t *testing.T) {
	for _, tc := range []struct {
		user   string
		ok     bool
		name   string
		domain bool
	}{
		{user: "cal", ok: true, name: "cal"},
		{user: "CAL", ok: true, name: "cal"},
		{user: "status.cal.com", ok: true, name: "status.cal.com", domain: true},
		{user: "status.cal.com.", ok: true, name: "status.cal.com", domain: true},
		{user: "help", ok: false},
		{user: "", ok: false},
		{user: "../../v1/monitor", ok: false},
		{user: "169.254.169.254", ok: false},
		{user: "redis.internal", ok: false},
	} {
		got, ok := resolveTarget(tc.user)
		if ok != tc.ok {
			t.Errorf("resolveTarget(%q) ok = %v, want %v", tc.user, ok, tc.ok)
			continue
		}
		if !ok {
			continue
		}
		if got.name != tc.name || got.domain != tc.domain {
			t.Errorf("resolveTarget(%q) = {name:%q domain:%v}, want {name:%q domain:%v}",
				tc.user, got.name, got.domain, tc.name, tc.domain)
		}
	}
}

// The address gate has to hold even when the connection would otherwise
// succeed — a reachable private listener is exactly the case that matters.
func TestGuardedDialRefusesPrivateAddresses(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	conn, err := guardedDial(context.Background(), "tcp", ln.Addr().String())
	if conn != nil {
		conn.Close()
	}
	if !errors.Is(err, errPrivateAddress) {
		t.Errorf("guardedDial(%q) error = %v, want errPrivateAddress", ln.Addr(), err)
	}
}
