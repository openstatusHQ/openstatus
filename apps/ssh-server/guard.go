package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

// Accepting a domain as the SSH username means the client chooses what this
// server connects to, which is a server-side request forgery primitive: the
// answer is rendered straight back into the session. On fly that reach would
// include the 6PN private network (fdaa::/16), `.internal` names and the
// 169.254.169.254 metadata endpoint.
//
// Two gates stand in the way. isPublicDomain screens the name before any
// lookup; guardedDial screens the addresses it resolves to, then connects to
// one of those addresses directly rather than re-resolving — so a name that
// answers publicly on the first lookup and privately on the second (DNS
// rebinding) never gets a second lookup.
var guardedClient = &http.Client{
	Timeout: 5 * time.Second,
	Transport: &http.Transport{
		DialContext:           guardedDial,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 5 * time.Second,
		ForceAttemptHTTP2:     true,
	},
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 {
			return errors.New("too many redirects")
		}
		// The dialer would catch a private address anyway; this also keeps the
		// hop on https and on a name we would have accepted in the first place.
		if req.URL.Scheme != "https" || !isPublicDomain(req.URL.Hostname()) {
			return fmt.Errorf("refusing redirect to %s", req.URL.Host)
		}
		return nil
	},
}

// Ranges net.IP's own predicates don't cover. IsPrivate already handles
// RFC 1918 and RFC 4193 (fc00::/7), which is what fly's fdaa::/16 sits in.
var reservedCIDRs = mustParseCIDRs(
	"0.0.0.0/8",       // "this network"
	"100.64.0.0/10",   // carrier-grade NAT
	"192.0.0.0/24",    // IETF protocol assignments
	"192.0.2.0/24",    // TEST-NET-1
	"198.18.0.0/15",   // benchmarking
	"198.51.100.0/24", // TEST-NET-2
	"203.0.113.0/24",  // TEST-NET-3
	"240.0.0.0/4",     // reserved
	"2002::/16",       // 6to4, which can carry a private v4 inside
	"64:ff9b::/96",    // NAT64
)

func mustParseCIDRs(cidrs ...string) []*net.IPNet {
	out := make([]*net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			panic("bad reserved CIDR " + c + ": " + err.Error())
		}
		out = append(out, n)
	}
	return out
}

func isPublicIP(ip net.IP) bool {
	// Unwrap ::ffff:a.b.c.d so an IPv4 address can't slip through as IPv6.
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsInterfaceLocalMulticast() || ip.IsMulticast() {
		return false
	}
	for _, n := range reservedCIDRs {
		if n.Contains(ip) {
			return false
		}
	}
	return true
}

var errPrivateAddress = errors.New("refusing to connect to a non-public address")

func guardedDial(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("no address for %s", host)
	}
	// One private answer condemns the whole name: a legitimate status page
	// never resolves to a mix, and a split answer is what an attacker builds.
	for _, ip := range ips {
		if !isPublicIP(ip.IP) {
			return nil, errPrivateAddress
		}
	}

	dialer := &net.Dialer{Timeout: 3 * time.Second}
	var firstErr error
	for _, ip := range ips {
		conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(ip.IP.String(), port))
		if err == nil {
			return conn, nil
		}
		if firstErr == nil {
			firstErr = err
		}
	}
	return nil, firstErr
}
