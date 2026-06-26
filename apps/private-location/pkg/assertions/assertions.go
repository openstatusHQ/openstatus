package assertions

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/openstatushq/openstatus/apps/checker/request"
)

type BodyString struct {
	AssertionType request.AssertionType    `json:"type"`
	Comparator    request.StringComparator `json:"compare"`
	Target        string                   `json:"target"`
}

type StatusTarget struct {
	AssertionType request.AssertionType    `json:"type"`
	Comparator    request.NumberComparator `json:"compare"`
	Target        int64                    `json:"target"`
}

type HeaderTarget struct {
	AssertionType request.AssertionType    `json:"type"`
	Comparator    request.StringComparator `json:"compare"`
	Target        string                   `json:"target"`
	Key           string                   `json:"key"`
}

type StringTargetType struct {
	Comparator request.StringComparator `json:"compare"`
	Target     string                   `json:"target"`
}

func (target StringTargetType) StringEvaluate(s string) bool {
	switch target.Comparator {
	case request.StringContains:
		return strings.Contains(s, target.Target)
	case request.StringNotContains:
		return !strings.Contains(s, target.Target)
	case request.StringEmpty:
		return s == ""
	case request.StringNotEmpty:
		return s != ""
	case request.StringEquals:
		return s == target.Target
	case request.StringNotEquals:
		return s != target.Target
	case request.StringGreaterThan:
		return s > target.Target
	case request.StringGreaterThanEqual:
		return s >= target.Target
	case request.StringLowerThan:
		return s < target.Target
	case request.StringLowerThanEqual:
		return s <= target.Target
	}

	return false
}

func (target HeaderTarget) HeaderEvaluate(s string) bool {
	headers := make(map[string]any)

	if err := json.Unmarshal([]byte(s), &headers); err != nil {
		return false
	}

	v, found := headers[target.Key]
	if !found {
		return false
	}

	t := StringTargetType{Comparator: target.Comparator, Target: target.Target}
	// convert all headers to array
	str := fmt.Sprintf("%v", v)

	return t.StringEvaluate(str)
}

func (target StatusTarget) StatusEvaluate(value int64) bool {

	switch target.Comparator {
	case request.NumberEquals:
		if target.Target != value {
			return false
		}
	case request.NumberNotEquals:
		if target.Target == value {
			return false
		}

	case request.NumberGreaterThan:
		if target.Target >= value {
			return false
		}
	case request.NumberGreaterThanEqual:
		if target.Target > value {
			return false
		}
	case request.NumberLowerThan:
		if target.Target <= value {
			return false
		}
	case request.NumberLowerThanEqual:
		if target.Target < value {
			return false
		}
	default:
		fmt.Println("something strange ", target)
	}
	return true
}
