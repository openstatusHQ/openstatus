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
	WorkspaceID   string `json:"workspaceId"`
	URL           string `json:"url"`
	MonitorID     string `json:"monitorId"`
	Method        string `json:"method"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Body          string `json:"body"`
	Timeout       int64  `json:"timeout"`
	DegradedAfter int64  `json:"degradedAfter,omitempty"`
	Headers       []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"headers,omitempty"`
	Status        string            `json:"status"`
	RawAssertions []json.RawMessage `json:"assertions,omitempty"`
}

type TCPCheckerRequest struct {
	WorkspaceID   string            `json:"workspaceId"`
	URL           string            `json:"url"`
	MonitorID     string            `json:"monitorId"`
	CronTimestamp int64             `json:"cronTimestamp"`
	Timeout       int64             `json:"timeout"`
	DegradedAfter int64             `json:"degradedAfter,omitempty"`
	RawAssertions []json.RawMessage `json:"assertions,omitempty"`
}

type TCPRequest struct {
	WorkspaceID   string `json:"workspaceId"`
	URL           string `json:"url"`
	MonitorID     string `json:"monitorId"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Timeout       int64  `json:"timeout"`
}

type PingRequest struct {
	RequestId   int64             `json:"requestId"`
	WorkspaceId int64             `json:"workspaceId"`
	URL         string            `json:"url"`
	Method      string            `json:"method"`
	Body        string            `json:"body"`
	Headers     map[string]string `json:"headers"`
}
