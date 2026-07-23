package request

import (
	"encoding/json"
)

type AssertionType string

const (
	AssertionHeader    AssertionType = "header"
	AssertionTextBody  AssertionType = "textBody"
	AssertionStatus    AssertionType = "status"
	AssertionJsonBody  AssertionType = "jsonBody"
	AssertionDnsRecord AssertionType = "dnsRecord"
)

type StringComparator string

const (
	StringContains         StringComparator = "contains"
	StringNotContains      StringComparator = "not_contains"
	StringEquals           StringComparator = "eq"
	StringNotEquals        StringComparator = "not_eq"
	StringEmpty            StringComparator = "empty"
	StringNotEmpty         StringComparator = "not_empty"
	StringGreaterThan      StringComparator = "gt"
	StringGreaterThanEqual StringComparator = "gte"
	StringLowerThan        StringComparator = "lt"
	StringLowerThanEqual   StringComparator = "lte"
)

type NumberComparator string

const (
	NumberEquals           NumberComparator = "eq"
	NumberNotEquals        NumberComparator = "not_eq"
	NumberGreaterThan      NumberComparator = "gt"
	NumberGreaterThanEqual NumberComparator = "gte"
	NumberLowerThan        NumberComparator = "lt"
	NumberLowerThanEqual   NumberComparator = "lte"
)

type RecordComparator string

const (
	RecordEquals      RecordComparator = "eq"
	RecordNotEquals   RecordComparator = "not_eq"
	RecordContains    RecordComparator = "contains"
	RecordNotContains RecordComparator = "not_contains"
)

type Record string

const (
	RecordA     Record = "A"
	RecordAAAA  Record = "AAAA"
	RecordCNAME Record = "CNAME"
	RecordMX    Record = "MX"
	RecordNS    Record = "NS"
	RecordTXT   Record = "TXT"
)

type Assertion struct {
	AssertionType AssertionType   `json:"type"`
	Comparator    json.RawMessage `json:"compare"`
	RawTarget     json.RawMessage `json:"target"`
}

type HttpCheckerRequest struct {
	Headers []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"headers,omitempty"`
	WorkspaceID     string            `json:"workspaceId"`
	URL             string            `json:"url"`
	MonitorID       string            `json:"monitorId"`
	Method          string            `json:"method"`
	Status          string            `json:"status"`
	Body            string            `json:"body"`
	Trigger         string            `json:"trigger,omitempty"`
	RawAssertions   []json.RawMessage `json:"assertions,omitempty"`
	CronTimestamp   int64             `json:"cronTimestamp"`
	Timeout         int64             `json:"timeout"`
	DegradedAfter   int64             `json:"degradedAfter,omitempty"`
	Retry           int64             `json:"retry,omitempty"`
	FollowRedirects bool              `json:"followRedirects,omitempty"`
	// ProxyURL is an optional user-provided endpoint that performs the check
	// from its own location and reports the measured result back to the
	// checker. See checker.ProxyRequest / checker.ProxyResponse for the
	// contract.
	ProxyURL string `json:"proxyUrl,omitempty"`
	// ProxyRegion overrides the region stored with the check result. When
	// empty, the region reported by the proxy response is used, falling back
	// to the checker's own region.
	ProxyRegion string `json:"proxyRegion,omitempty"`
	// ProxyHeaders are sent to the proxy itself (e.g. for authentication),
	// not to the monitored URL.
	ProxyHeaders []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"proxyHeaders,omitempty"`
	OtelConfig struct {
		Endpoint string            `json:"endpoint"`
		Headers  map[string]string `json:"headers,omitempty"`
	} `json:"otelConfig"`
}

type TCPCheckerRequest struct {
	Status        string            `json:"status"`
	WorkspaceID   string            `json:"workspaceId"`
	URI           string            `json:"uri"`
	MonitorID     string            `json:"monitorId"`
	Trigger       string            `json:"trigger,omitempty"`
	RawAssertions []json.RawMessage `json:"assertions,omitempty"`
	RequestId     int64             `json:"requestId,omitempty"`
	CronTimestamp int64             `json:"cronTimestamp"`
	Timeout       int64             `json:"timeout"`
	DegradedAfter int64             `json:"degradedAfter,omitempty"`
	Retry         int64             `json:"retry,omitempty"`
	OtelConfig    struct {
		Endpoint string            `json:"endpoint"`
		Headers  map[string]string `json:"headers,omitempty"`
	} `json:"otelConfig"`
}

type TCPRequest struct {
	WorkspaceID   string `json:"workspaceId"`
	URL           string `json:"url"`
	MonitorID     string `json:"monitorId"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Timeout       int64  `json:"timeout"`
}

type PingRequest struct {
	Headers     map[string]string `json:"headers"`
	URL         string            `json:"url"`
	Method      string            `json:"method"`
	Body        string            `json:"body"`
	RequestId   int64             `json:"requestId"`
	WorkspaceId int64             `json:"workspaceId"`
}

type DNSCheckerRequest struct {
	Status        string            `json:"status"`
	WorkspaceID   string            `json:"workspaceId"`
	URI           string            `json:"uri"`
	MonitorID     string            `json:"monitorId"`
	Trigger       string            `json:"trigger,omitempty"`
	RawAssertions []json.RawMessage `json:"assertions,omitempty"`
	RequestId     int64             `json:"requestId,omitempty"`
	CronTimestamp int64             `json:"cronTimestamp"`
	Timeout       int64             `json:"timeout"`
	DegradedAfter int64             `json:"degradedAfter,omitempty"`
	Retry         int64             `json:"retry,omitempty"`
	OtelConfig    struct {
		Endpoint string            `json:"endpoint"`
		Headers  map[string]string `json:"headers,omitempty"`
	} `json:"otelConfig"`
}
