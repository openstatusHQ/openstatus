package checker

import (
	"context"
	"fmt"
	"net"

	"github.com/rs/zerolog/log"
)


type DnsResponse struct {
	A     []string `json:"a,omitempty"`
	AAAA  []string `json:"aaaa,omitempty"`
	CNAME string   `json:"cname,omitempty"`
	MX    []string `json:"mx,omitempty"`
	NS  []string `json:"ns,omitempty"`
	TXT []string `json:"txt,omitempty"`
}

func Dns(ctx context.Context, host string) (*DnsResponse, error) {
	logger:= log.Ctx(ctx).With().Str("monitor", host).Logger()

	A, err := lookupA(host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS A record lookup failed")
		return nil, fmt.Errorf("failed to lookup A record: %w", err)
	}
	AAAA, err := lookupAAAA(host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS AAAA record lookup failed")
		return nil, fmt.Errorf("failed to lookup AAAA record: %w", err)
	}
	CNAME,err := lookupCNAME(host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS CNAME record lookup failed")
		return nil, fmt.Errorf("failed to lookup CNAME record: %w", err)
	}
	MXRecords := lookupMX(host)

	NS,err  := lookupNS(host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS NS record lookup failed")
		return nil, fmt.Errorf("failed to lookup NS record: %w", err)
	}
	TXT := lookupTXT(host)


	response := &DnsResponse{
		A:     A,
		AAAA:  AAAA,
		CNAME: CNAME,
		MX:    MXRecords,
		NS:    NS,
		TXT: TXT,
	}

	return response, nil
}

func lookupA(domain string) ([]string, error) {

	A := []string{}
	ips, err := net.LookupIP(domain)
	if err != nil {
		return nil, err
	}

	for _, ip := range ips {
		if ip.To4() != nil {
			A = append(A, ip.String())
		}
	}
	return A, nil
}

func lookupAAAA(domain string) ([]string, error) {
	AAAA := []string{}
	ips, err := net.LookupIP(domain)
	if err != nil {
		return nil, err
	}

	for _, ip := range ips {
		if ip.To16() != nil && ip.To4() == nil {

			AAAA = append(AAAA, ip.String())
		}
	}
	return AAAA, nil
}

func lookupCNAME(domain string) (string, error) {
	cname, err := net.LookupCNAME(domain)
	if err != nil {
		return "", err
	}

	return cname, nil
}

func lookupMX(domain string) ([]string) {
	mx := []string{}
	mxRecords,_ := net.LookupMX(domain)


	for _, r := range mxRecords {
		mx = append(mx, fmt.Sprintf("%s:%d", r.Host, r.Pref))
	}
	return mx
}

func lookupNS(domain string) ([]string, error) {

	hosts := []string{}
	nsRecords, err := net.LookupNS(domain)
	if err != nil {
		return nil, err
	}

	for _, ns := range nsRecords {
		hosts = append(hosts, ns.Host)
	}
	return hosts, nil
}

func lookupTXT(domain string) ([]string) {
	records := []string{}
	txtRecords, err := net.LookupTXT(domain)
	if err != nil {
		return nil
	}

	for _, txt := range txtRecords {
		records = append(records, txt)
	}
	return records
}
