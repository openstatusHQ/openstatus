package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
	"github.com/openstatushq/openstatus/apps/private-location/internal/models"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
	"github.com/rs/zerolog/log"
)

// Converts models.NumberComparator to proto NumberComparator
func convertNumberComparator(m models.NumberComparator) private_locationv1.NumberComparator {
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

// Converts models.StringComparator to proto StringComparator
func convertStringComparator(m models.StringComparator) private_locationv1.StringComparator {
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

// Helper to parse assertions
func ParseAssertions(assertions sql.NullString) (
	statusAssertions []*private_locationv1.StatusCodeAssertion,
	headerAssertions []*private_locationv1.HeaderAssertion,
	bodyAssertions []*private_locationv1.BodyAssertion,
) {
	if !assertions.Valid {
		return
	}
	var rawAssertions []json.RawMessage
	if err := json.Unmarshal([]byte(assertions.String), &rawAssertions); err != nil {
		log.Printf("Failed to unmarshal assertions: %v", err)
		return
	}
	for _, a := range rawAssertions {
		var assert models.Assertion
		if err := json.Unmarshal(a, &assert); err != nil {
			log.Printf("Failed to unmarshal assertion: %v", err)
			continue
		}
		switch assert.AssertionType {
		case models.AssertionStatus:
			var target models.StatusTarget
			if err := json.Unmarshal(a, &target); err != nil {
				log.Printf("Failed to unmarshal status target: %v", err)
				continue
			}
			statusAssertions = append(statusAssertions, &private_locationv1.StatusCodeAssertion{
				Target:     target.Target,
				Comparator: convertNumberComparator(target.Comparator),
			})
		case models.AssertionHeader:
			var target models.HeaderTarget
			if err := json.Unmarshal(a, &target); err != nil {
				log.Error().Err(err).Msg("unable to encode payload")
				continue
			}
			headerAssertions = append(headerAssertions, &private_locationv1.HeaderAssertion{
				Key:        target.Key,
				Target:     target.Target,
				Comparator: convertStringComparator(target.Comparator),
			})
		case models.AssertionTextBody:
			var target models.BodyString
			if err := json.Unmarshal(a, &target); err != nil {
				log.Printf("Failed to unmarshal body target: %v", err)
				continue
			}
			bodyAssertions = append(bodyAssertions, &private_locationv1.BodyAssertion{
				Target:     target.Target,
				Comparator: convertStringComparator(target.Comparator),
			})
		}
	}
	return
}

func (h *privateLocationHandler) Monitors(ctx context.Context, req *connect.Request[private_locationv1.MonitorsRequest]) (*connect.Response[private_locationv1.MonitorsResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing token"))
	}

	var monitors []database.Monitor
	err := h.db.Select(&monitors, "SELECT monitor.* FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.token = ? AND monitor.deleted_at IS NULL", token)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var httpMonitors []*private_locationv1.HTTPMonitor
	for _, monitor := range monitors {
		if monitor.JobType != "http" {
			continue
		}

		var headers []*private_locationv1.Headers
		if err := json.Unmarshal([]byte(monitor.Headers), &headers); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("unable to unmarshal headers")
			headers = nil
		}

		statusAssertions, headerAssertions, bodyAssertions := ParseAssertions(monitor.Assertions)

		httpMonitors = append(httpMonitors, &private_locationv1.HTTPMonitor{
			Url:                  monitor.URL,
			Periodicity:          monitor.Periodicity,
			Id:                   strconv.Itoa(monitor.ID),
			Method:               monitor.Method,
			Body:                 monitor.Body,
			Timeout:              monitor.Timeout,
			DegradedAt:           &monitor.DegradedAfter.Int64,
			FollowRedirects:      monitor.FollowRedirects,
			Headers:              headers,
			StatusCodeAssertions: statusAssertions,
			HeaderAssertions:     headerAssertions,
			BodyAssertions:       bodyAssertions,
		})
	}

	return connect.NewResponse(&private_locationv1.MonitorsResponse{
		HttpMonitors: httpMonitors,
	}), nil
}
