package checker

import (
	"context"
	"fmt"
	"net"
	"strings"

	"github.com/rs/zerolog/log"
)

type DnsResponse struct {
	A     []string `json:"a,omitempty"`
	AAAA  []string `json:"aaaa,omitempty"`
	CNAME string   `json:"cname,omitempty"`
	MX    []string `json:"mx,omitempty"`
	NS    []string `json:"ns,omitempty"`
	TXT   []string `json:"txt,omitempty"`
}

// resolver is net.DefaultResolver reached through its context-aware methods:
// the package-level net.Lookup* helpers take no context, so a stalled resolver
// would block a probe past its timeout and hold up the monitor's next run.
var resolver = net.DefaultResolver

func Dns(ctx context.Context, host string) (*DnsResponse, error) {
	logger := log.Ctx(ctx).With().Str("monitor", host).Logger()

	ips, err := resolver.LookupIP(ctx, "ip", host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS IP lookup failed")
		return nil, fmt.Errorf("failed to lookup IPs: %w", err)
	}

	A := []string{}
	AAAA := []string{}

	for _, ip := range ips {
		if ip.To4() != nil {
			A = append(A, ip.String())
		} else {
			AAAA = append(AAAA, ip.String())
		}
	}
	CNAME, err := lookupCNAME(ctx, host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS CNAME record lookup failed")
		return nil, fmt.Errorf("failed to lookup CNAME record: %w", err)
	}
	MXRecords := lookupMX(ctx, host)

	NS, err := lookupNS(ctx, host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS NS record lookup failed")
		return nil, fmt.Errorf("failed to lookup NS record: %w", err)
	}
	TXT := lookupTXT(ctx, host)

	// MX and TXT tolerate lookup errors, but an expired deadline means those
	// records are unknown rather than absent — don't report that as a success.
	if err := ctx.Err(); err != nil {
		logger.Error().Err(err).Msg("DNS lookup did not complete before the deadline")
		return nil, fmt.Errorf("DNS lookup for %s did not complete: %w", host, err)
	}

	response := &DnsResponse{
		A:     A,
		AAAA:  AAAA,
		CNAME: CNAME,
		MX:    MXRecords,
		NS:    NS,
		TXT:   TXT,
	}

	return response, nil
}

// FormatDNSRecords flattens a lookup into the per-record-type map shape that
// both the public handler and the private-location probe report.
func FormatDNSRecords(result *DnsResponse) map[string][]string {
	return map[string][]string{
		"A":     append([]string{}, result.A...),
		"AAAA":  append([]string{}, result.AAAA...),
		"CNAME": {result.CNAME},
		"MX":    append([]string{}, result.MX...),
		"NS":    append([]string{}, result.NS...),
		"TXT":   append([]string{}, result.TXT...),
	}
}

func lookupCNAME(ctx context.Context, domain string) (string, error) {
	cname, err := resolver.LookupCNAME(ctx, domain)
	if err != nil {
		return "", err
	}

	return cname, nil
}

func lookupMX(ctx context.Context, domain string) []string {
	mx := []string{}
	mxRecords, _ := resolver.LookupMX(ctx, domain)

	for _, r := range mxRecords {
		mx = append(mx, fmt.Sprintf("%s:%d", r.Host, r.Pref))
	}
	return mx
}

func lookupNS(ctx context.Context, domain string) ([]string, error) {

	hosts := []string{}
	isSubdomain := isSubdomain(domain)
	if isSubdomain {
		return hosts, nil
	}
	nsRecords, err := resolver.LookupNS(ctx, domain)
	if err != nil {
		return nil, err
	}

	for _, ns := range nsRecords {
		hosts = append(hosts, ns.Host)
	}
	return hosts, nil
}

func lookupTXT(ctx context.Context, domain string) []string {
	records := []string{}
	txtRecords, err := resolver.LookupTXT(ctx, domain)
	if err != nil {
		return nil
	}

	for _, txt := range txtRecords {
		records = append(records, txt)
	}
	return records
}

func isSubdomain(domain string) bool {
	parent := strings.Split(domain, ".")
	if len(parent) < 3 {
		return false
	}
	return true
}
