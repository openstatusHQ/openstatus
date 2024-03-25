package assertions

import "github.com/openstatushq/openstatus/apps/checker/request"

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
	Comparator    request.NumberComparator `json:"compare"`
	Target        string                   `json:"target"`
	Key           string                   `json:"key"`
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

	}
	return true
}
