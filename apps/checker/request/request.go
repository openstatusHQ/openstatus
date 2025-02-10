package request

import (
	"encoding/json"
)

type AssertionType string

const (
	AssertionHeader   AssertionType = "header"
	AssertionTextBody AssertionType = "textBody"
	AssertionStatus   AssertionType = "status"
	AssertionJsonBody AssertionType = "jsonBody"
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
	WorkspaceID   string            `json:"workspaceId"`
	URL           string            `json:"url"`
	MonitorID     string            `json:"monitorId"`
	Method        string            `json:"method"`
	Status        string            `json:"status"`
	Body          string            `json:"body"`
	Trigger       string            `json:"trigger,omitempty"`
	RawAssertions []json.RawMessage `json:"assertions,omitempty"`
	CronTimestamp int64             `json:"cronTimestamp"`
	Timeout       int64             `json:"timeout"`
	DegradedAfter int64             `json:"degradedAfter,omitempty"`
	OtelConfig    struct {
		Endpoint string            `json:"endpoint"`
		Headers  map[string]string `json:"headers,omitempty"`
	} `json:"otelConfig,omitempty"`
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
	OtelConfig    struct {
		Endpoint string            `json:"endpoint"`
		Headers  map[string]string `json:"headers,omitempty"`
	} `json:"otelConfig,omitempty"`
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
