package server

import (
	"context"
	"database/sql"
	"encoding/json"
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

// Converts models.RecordComparator to proto RecordComparator
func convertRecordComparator(m models.RecordComparator) private_locationv1.RecordComparator {
	switch m {
	case models.RecordEquals:
		return private_locationv1.RecordComparator_RECORD_COMPARATOR_EQUAL
	case models.RecordNotEquals:
		return private_locationv1.RecordComparator_RECORD_COMPARATOR_NOT_EQUAL
	case models.RecordContains:
		return private_locationv1.RecordComparator_RECORD_COMPARATOR_CONTAINS
	case models.RecordNotContains:
		return private_locationv1.RecordComparator_RECORD_COMPARATOR_NOT_CONTAINS
	default:
		return private_locationv1.RecordComparator_RECORD_COMPARATOR_UNSPECIFIED
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
		log.Error().Err(err).Msg("failed to unmarshal assertions")
		return
	}
	for _, a := range rawAssertions {
		var assert models.Assertion
		if err := json.Unmarshal(a, &assert); err != nil {
			log.Error().Err(err).Msg("failed to unmarshal assertion")
			continue
		}
		switch assert.AssertionType {
		case models.AssertionStatus:
			var target models.StatusTarget
			if err := json.Unmarshal(a, &target); err != nil {
				log.Error().Err(err).Msg("failed to unmarshal status target")
				continue
			}
			statusAssertions = append(statusAssertions, &private_locationv1.StatusCodeAssertion{
				Target:     target.Target,
				Comparator: convertNumberComparator(target.Comparator),
			})
		case models.AssertionHeader:
			var target models.HeaderTarget
			if err := json.Unmarshal(a, &target); err != nil {
				log.Error().Err(err).Msg("failed to unmarshal header target")
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
				log.Error().Err(err).Msg("failed to unmarshal body target")
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

// Helper to parse DNS record assertions
func ParseRecordAssertions(assertions sql.NullString) []*private_locationv1.RecordAssertion {
	if !assertions.Valid {
		return nil
	}
	var rawAssertions []json.RawMessage
	if err := json.Unmarshal([]byte(assertions.String), &rawAssertions); err != nil {
		log.Error().Err(err).Msg("failed to unmarshal assertions")
		return nil
	}
	var recordAssertions []*private_locationv1.RecordAssertion
	for _, a := range rawAssertions {
		var assert models.Assertion
		if err := json.Unmarshal(a, &assert); err != nil {
			log.Error().Err(err).Msg("failed to unmarshal assertion")
			continue
		}
		if assert.AssertionType == models.AssertionDnsRecord {
			var target models.RecordTarget
			if err := json.Unmarshal(a, &target); err != nil {
				log.Error().Err(err).Msg("failed to unmarshal record target")
				continue
			}
			recordAssertions = append(recordAssertions, &private_locationv1.RecordAssertion{
				Record:     target.Key,
				Comparator: convertRecordComparator(target.Comparator),
				Target:    target.Target,
			})
		}
	}
	return recordAssertions
}

func (h *privateLocationHandler) Monitors(ctx context.Context, req *connect.Request[private_locationv1.MonitorsRequest]) (*connect.Response[private_locationv1.MonitorsResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, ErrMissingToken)
	}

	var monitors []database.Monitor
	err := h.db.Select(&monitors, "SELECT monitor.id, monitor.job_type, monitor.url, monitor.periodicity, monitor.method, monitor.body, monitor.timeout, monitor.degraded_after, monitor.follow_redirects, monitor.headers, monitor.assertions, monitor.workspace_id, monitor.retry FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.token = ? AND monitor.deleted_at IS NULL and monitor.active = 1", token)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	var workspaceId int
	var httpMonitors []*private_locationv1.HTTPMonitor
	var tcpMonitors []*private_locationv1.TCPMonitor
	var dnsMonitors []*private_locationv1.DNSMonitor
	for _, monitor := range monitors {
		if workspaceId == 0 {
			workspaceId = monitor.WorkspaceID
		}

		switch monitor.JobType {
		case database.JobTypeHTTP:
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
				Retry:                int64(monitor.Retry),
				FollowRedirects:      monitor.FollowRedirects,
				Headers:              headers,
				StatusCodeAssertions: statusAssertions,
				HeaderAssertions:     headerAssertions,
				BodyAssertions:       bodyAssertions,
			})

		case database.JobTypeTCP:
			tcpMonitors = append(tcpMonitors, &private_locationv1.TCPMonitor{
				Id:          strconv.Itoa(monitor.ID),
				Uri:         monitor.URL,
				Timeout:     monitor.Timeout,
				DegradedAt:  &monitor.DegradedAfter.Int64,
				Periodicity: monitor.Periodicity,
				Retry:       int64(monitor.Retry),
			})

		case database.JobTypeDNS:
			recordAssertions := ParseRecordAssertions(monitor.Assertions)
			dnsMonitors = append(dnsMonitors, &private_locationv1.DNSMonitor{
				Id:               strconv.Itoa(monitor.ID),
				Uri:              monitor.URL,
				Timeout:          monitor.Timeout,
				DegradedAt:       &monitor.DegradedAfter.Int64,
				Periodicity:      monitor.Periodicity,
				Retry:            int64(monitor.Retry),
				RecordAssertions: recordAssertions,
			})
		}
	}


	event := ctx.Value("event")
	if eventMap, ok := event.(map[string]any); ok && eventMap != nil {
		eventMap["private_location"] = map[string]any{
			"workspace_id": workspaceId,
		}
		ctx = context.WithValue(ctx, "event", eventMap)
	}

	return connect.NewResponse(&private_locationv1.MonitorsResponse{
		HttpMonitors: httpMonitors,
		TcpMonitors:  tcpMonitors,
		DnsMonitors:  dnsMonitors,
	}), nil
}
