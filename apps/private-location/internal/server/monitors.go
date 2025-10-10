package server

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/models"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

// import (
// 	"context"

// 	"connectrpc.com/connect"
// 	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
// )

 func convertNumberComparator(m models.NumberComparator) private_locationv1.NumberComparator{
	switch m {
		case models.NumberNotEquals:
			return private_locationv1.NumberComparator_NUMBER_COMPARATOR_NOT_EQUAL
		case models.NumberEquals:
			return private_locationv1.NumberComparator_NUMBER_COMPARATOR_EQUAL
		case models.NumberGreaterThan:
			return private_locationv1.NumberComparator_NUMBER_COMPARATOR_GREATER_THAN
		case models.NumberGreaterThanEqual:
			return private_locationv1.NumberComparator_NUMBER_COMPARATOR_GREATER_THAN_OR_EQUAL
		case models.NumberLowerThan:
			return private_locationv1.NumberComparator_NUMBER_COMPARATOR_LESS_THAN
		case models.NumberLowerThanEqual:
			return private_locationv1.NumberComparator_NUMBER_COMPARATOR_LESS_THAN_OR_EQUAL
		default:
			return private_locationv1.NumberComparator_NUMBER_COMPARATOR_UNSPECIFIED
	}
}

func convertStringComparator(m models.StringComparator) private_locationv1.StringComparator{
	switch m {
		case models.StringNotEquals:
			return private_locationv1.StringComparator_STRING_COMPARATOR_NOT_EQUAL
		case models.StringEquals:
			return private_locationv1.StringComparator_STRING_COMPARATOR_EQUAL
		case models.StringContains:
			return private_locationv1.StringComparator_STRING_COMPARATOR_CONTAINS
		case models.StringNotContains:
			return private_locationv1.StringComparator_STRING_COMPARATOR_NOT_CONTAINS
		case models.StringEmpty:
			return private_locationv1.StringComparator_STRING_COMPARATOR_EMPTY
		case models.StringNotEmpty:
			return private_locationv1.StringComparator_STRING_COMPARATOR_NOT_EMPTY
		default:
			return private_locationv1.StringComparator_STRING_COMPARATOR_UNSPECIFIED
	}
}

func (h *privateLocationHandler) Monitors(ctx context.Context, req *connect.Request[private_locationv1.MonitorsRequest]) (*connect.Response[private_locationv1.MonitorsResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing token"))
	}
	var monitors []Monitor

	err := h.db.Select(&monitors, "SELECT monitor.* FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.key = ? AND monitor.deleted_at IS NULL", token)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var v []*private_locationv1.HTTPMonitor
	for _, monitor := range monitors {

		if monitor.JobType == "http" {
			var headers []*private_locationv1.Headers
			json.Unmarshal([]byte(monitor.Headers), &headers)

			var statusAssertions []*private_locationv1.StatusCodeAssertion
			var headerAssertions []*private_locationv1.HeaderAssertion
			var bodyAssertions []*private_locationv1.BodyAssertion
			if monitor.Assertions.Valid == true {
				var rawAssertions []json.RawMessage
				if err := json.Unmarshal([]byte(monitor.Assertions.String), &rawAssertions); err != nil {
					// handle error, e.g. skip this monitor
					continue
				}
				for _, a := range rawAssertions {
					var assert models.Assertion
					if err := json.Unmarshal(a, &assert); err != nil {
						continue
					}
					switch assert.AssertionType {
					case models.AssertionStatus:
						var target models.StatusTarget
						if err := json.Unmarshal(a, &target); err != nil {
							continue
						}

						statusAssertions = append(statusAssertions, &private_locationv1.StatusCodeAssertion{
							Target:     target.Target,
							Comparator: convertNumberComparator(target.Comparator),
						})
					case models.AssertionHeader:
						var target models.HeaderTarget
						if err := json.Unmarshal(a, &target); err != nil {
							continue
						}

						headerAssertions = append(headerAssertions, &private_locationv1.HeaderAssertion{
							Key:        target.Key,
							Target:      target.Target,
							Comparator: convertStringComparator(target.Comparator),
						})
					case models.AssertionTextBody:
						var target models.BodyString
						if err := json.Unmarshal(a, &target); err != nil {
							continue
						}

						bodyAssertions = append(bodyAssertions, &private_locationv1.BodyAssertion{
							Target:      target.Target,
							Comparator: convertStringComparator(target.Comparator),
						})
					}
				}
			}
			v = append(v, &private_locationv1.HTTPMonitor{
				Url:             monitor.URL,
				Periodicity:     monitor.Periodicity,
				Id:              strconv.Itoa(monitor.ID),
				Method:          monitor.Method,
				Body:            monitor.Body,
				Timeout:         (monitor.Timeout),
				DegradedAt:      &monitor.DegradedAfter.Int64,
				FollowRedirects: monitor.FollowRedirects,
				Headers:         headers,
				StatusCodeAssertions: statusAssertions,
				HeaderAssertions: headerAssertions,
				BodyAssertions: bodyAssertions,
			})
		}
	}
	return connect.NewResponse(&private_locationv1.MonitorsResponse{
		HttpMonitors: v,
	}), nil
}
