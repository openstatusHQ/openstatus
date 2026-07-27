package job

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cenkalti/backoff/v5"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/assertions"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

type DNSPrivateRegionData struct {
	ID            string              `json:"id"`
	URI           string              `json:"uri"`
	RequestStatus string              `json:"requestStatus,omitempty"`
	Message       string              `json:"message,omitempty"`
	Records       map[string][]string `json:"records"`
	Latency       int64               `json:"latency"`
	CronTimestamp int64               `json:"cronTimestamp"`
	Timestamp     int64               `json:"timestamp"`
	Error         uint8               `json:"error"`
}

func ProtoRecordAssertionToComparator(assertion v1.RecordComparator) (request.RecordComparator, error) {
	switch assertion {
	case v1.RecordComparator_RECORD_COMPARATOR_EQUAL:
		return request.RecordEquals, nil
	case v1.RecordComparator_RECORD_COMPARATOR_NOT_EQUAL:
		return request.RecordNotEquals, nil
	case v1.RecordComparator_RECORD_COMPARATOR_CONTAINS:
		return request.RecordContains, nil
	case v1.RecordComparator_RECORD_COMPARATOR_NOT_CONTAINS:
		return request.RecordNotContains, nil
	}
	return "", fmt.Errorf("unknown comparator type: %v", assertion)
}

func evaluateRecordAssertions(recordAssertions []*v1.RecordAssertion, res *checker.DnsResponse) (bool, error) {
	for _, recordAssertion := range recordAssertions {
		comparator, err := ProtoRecordAssertionToComparator(recordAssertion.GetComparator())
		if err != nil {
			return false, fmt.Errorf("error while parsing record assertion comparator: %w", err)
		}

		assert := assertions.RecordTarget{
			Comparator: comparator,
			Target:     recordAssertion.GetTarget(),
			Key:        request.Record(recordAssertion.GetRecord()),
		}

		var isSuccessful bool
		switch assert.Key {
		case request.RecordA:
			isSuccessful = assert.RecordEvaluate(res.A)
		case request.RecordAAAA:
			isSuccessful = assert.RecordEvaluate(res.AAAA)
		case request.RecordCNAME:
			isSuccessful = assert.RecordEvaluate([]string{res.CNAME})
		case request.RecordMX:
			isSuccessful = assert.RecordEvaluate(res.MX)
		case request.RecordNS:
			isSuccessful = assert.RecordEvaluate(res.NS)
		case request.RecordTXT:
			isSuccessful = assert.RecordEvaluate(res.TXT)
		default:
			return false, fmt.Errorf("unknown record type in assertion: %s", assert.Key)
		}

		if !isSuccessful {
			return false, nil
		}
	}

	return true, nil
}

// Cancellation cause for the retry budget, so an expiry we imposed can be told
// apart from the caller cancelling us (shutdown), which must not be reported as
// an outage.
var errRetryBudgetExpired = errors.New("DNS retry budget expired")

func (jobRunner) DNSJob(ctx context.Context, monitor *v1.DNSMonitor) (*DNSPrivateRegionData, error) {
	retry := monitor.Retry
	if retry == 0 {
		retry = 3
	}

	var degradedAfter int64
	if monitor.DegradedAt != nil {
		degradedAfter = *monitor.DegradedAt
	}

	// One budget for the whole retry loop: checker.Dns honours the deadline, so
	// each attempt is bounded by whatever is left of it.
	if monitor.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeoutCause(ctx, time.Duration(monitor.Timeout)*time.Millisecond, errRetryBudgetExpired)
		defer cancel()
	}

	var called int
	var lastFailure *DNSPrivateRegionData

	op := func() (*DNSPrivateRegionData, error) {
		called++
		start := time.Now().UTC().UnixMilli()
		res, lookupErr := checker.Dns(ctx, monitor.Uri)
		latency := time.Now().UTC().UnixMilli() - start

		data, err := newDNSData(monitor.Uri, start, latency)
		if err != nil {
			return nil, err
		}

		if lookupErr != nil {
			// Build the reportable failure on every attempt, not just the last:
			// a dropped result never reaches the platform, so a resolver outage
			// would go unalerted.
			data.RequestStatus = "error"
			data.Error = 1
			data.Message = lookupErr.Error()
			lastFailure = data

			if called < int(retry) {
				return nil, fmt.Errorf("DNS lookup failed for %s: %w", monitor.Uri, lookupErr)
			}
			return data, nil
		}

		data.Records = checker.FormatDNSRecords(res)

		isSuccessful, assertErr := evaluateRecordAssertions(monitor.RecordAssertions, res)
		if assertErr != nil {
			// Returning nil here would stop the monitor reporting entirely and
			// leave it looking healthy. Retrying can't help — a malformed
			// assertion stays malformed — so report it and stop.
			data.RequestStatus = "error"
			data.Error = 1
			data.Message = fmt.Sprintf("invalid DNS assertion for %s: %s", monitor.Uri, assertErr)
			return data, nil
		}

		switch {
		case !isSuccessful:
			data.RequestStatus = "error"
			data.Error = 1
			data.Message = fmt.Sprintf("DNS assertions failed for %s", monitor.Uri)
			lastFailure = data

			if called < int(retry) {
				return nil, errors.New(data.Message)
			}
		case degradedAfter > 0 && latency > degradedAfter:
			data.RequestStatus = "degraded"
		default:
			data.RequestStatus = "success"
		}

		return data, nil
	}

	data, err := backoff.Retry(ctx, op,
		backoff.WithMaxTries(uint(retry)),
		backoff.WithBackOff(backoff.NewExponentialBackOff()),
	)
	// backoff.Retry discards the operation result when the context expires, so
	// without this the pending failure is lost and no outage is ingested.
	if err != nil && lastFailure != nil && errors.Is(err, errRetryBudgetExpired) {
		return lastFailure, nil
	}

	return data, err
}

func newDNSData(uri string, start, latency int64) (*DNSPrivateRegionData, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return nil, fmt.Errorf("error while generating uuid: %w", err)
	}

	return &DNSPrivateRegionData{
		ID:            id.String(),
		URI:           uri,
		Latency:       latency,
		Timestamp:     start,
		CronTimestamp: start,
		Records:       map[string][]string{},
	}, nil
}
