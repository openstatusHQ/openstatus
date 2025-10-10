package models

import "encoding/json"

type AssertionType string

const (
	AssertionHeader   AssertionType = "header"
	AssertionTextBody AssertionType = "textBody"
	AssertionStatus   AssertionType = "status"
	AssertionJsonBody AssertionType = "jsonBody"
)

type StringComparator string

func (c StringComparator) String() string {
	return string(c)
}

func (c NumberComparator) String() string {
	return string(c)
}

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


type StatusTarget struct {
	AssertionType AssertionType    `json:"type"`
	Comparator    NumberComparator `json:"compare"`
	Target        int64                    `json:"target"`
}

type HeaderTarget struct {
	AssertionType AssertionType    `json:"type"`
	Comparator    StringComparator `json:"compare"`
	Target        string                   `json:"target"`
	Key           string                   `json:"key"`
}

type StringTargetType struct {
	Comparator StringComparator `json:"compare"`
	Target     string                   `json:"target"`
}

type BodyString struct {
	AssertionType AssertionType    `json:"type"`
	Comparator    StringComparator `json:"compare"`
	Target        string                   `json:"target"`
}
