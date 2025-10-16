package job

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/cenkalti/backoff/v5"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/assertions"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

func (jr jobRunner) HTTPJob(ctx context.Context, monitor *v1.HTTPMonitor) (*HttpPrivateRegionData, error) {

	retry := monitor.Retry
	if retry == 0 {
		retry = 3
	}

	requestClient := &http.Client{
		Timeout: time.Duration(monitor.Timeout) * time.Millisecond,
	}
	defer requestClient.CloseIdleConnections()

	if !monitor.FollowRedirects {
		requestClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	} else {
		requestClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		}
	}

	var degradedAfter int64
	if monitor.DegradedAt != nil {
		degradedAfter = *monitor.DegradedAt
	}

	headers := make([]struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}, 0)
	if monitor.Headers != nil {
		for _, header := range monitor.Headers {
			headers = append(headers, struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}{
				Key:   header.Key,
				Value: header.Value,
			})
		}
	}

	req := request.HttpCheckerRequest{
		URL:             monitor.Url,
		MonitorID:       monitor.Id,
		Method:          monitor.Method,
		Body:            monitor.Body,
		Retry:           monitor.Retry,
		Timeout:         monitor.Timeout,
		DegradedAfter:   degradedAfter,
		FollowRedirects: monitor.FollowRedirects,
		Headers:         headers,
	}

	var called int

	op := func() (*HttpPrivateRegionData, error) {
		called++
		res, err := checker.Http(ctx, requestClient, req)
		if err != nil {
			return nil, fmt.Errorf("unable to ping: %w", err)
		}

		timingBytes, err := json.Marshal(res.Timing)
		if err != nil {
			return nil, fmt.Errorf("error while parsing timing data %s: %w", req.URL, err)
		}
		headersBytes, err := json.Marshal(res.Headers)
		if err != nil {
			return nil, fmt.Errorf("error while parsing headers %s: %w", req.URL, err)
		}
		id, err := uuid.NewV7()
		if err != nil {
			return nil, fmt.Errorf("error while generating uuid: %w", err)
		}

		status := statusCode(res.Status)
		isSuccessful := status.IsSuccessful()
		if len(monitor.HeaderAssertions) > 0 {
			headersAsString, err := json.Marshal(res.Headers)
			if err != nil {
				return nil, fmt.Errorf("error while parsing headers %s: %w", req.URL, err)
			}
			for _, assertion := range monitor.HeaderAssertions {
				assert := assertions.HeaderTarget{
					Comparator: request.StringComparator(assertion.Comparator.String()),
					Target:     assertion.Target,
					Key:        assertion.Key,
				}
				assert.HeaderEvaluate(string(headersAsString))
			}
		}

		if len(monitor.StatusCodeAssertions) > 0 {
			for _, assertion := range monitor.StatusCodeAssertions {
				assert := assertions.StatusTarget{
					Comparator: request.NumberComparator(assertion.Comparator.String()),
					Target:     assertion.Target,
				}
				isSuccessful = isSuccessful && assert.StatusEvaluate(int64(res.Status))
			}
		}
		if len(monitor.BodyAssertions) > 0 {
			for _, assertion := range monitor.BodyAssertions {
				assert := assertions.StringTargetType{
					Comparator: request.StringComparator(assertion.Comparator.String()),
					Target:     assertion.Target,
				}
				isSuccessful = isSuccessful && assert.StringEvaluate(res.Body)
			}
		}

		requestStatus := "success"
		if !isSuccessful {
			requestStatus = "error"
		} else if req.DegradedAfter > 0 && res.Latency > req.DegradedAfter {
			requestStatus = "degraded"
		}

		data := HttpPrivateRegionData{
			ID:            id.String(),
			Latency:       res.Latency,
			StatusCode:    res.Status,
			Timestamp:     res.Timestamp,
			CronTimestamp: res.Timestamp,
			URL:           req.URL,
			// Method:        req.Method,
			Timing:        string(timingBytes),
			Headers:       string(headersBytes),
			Body:          "",
			RequestStatus: requestStatus,
			// Assertions:    assertionAsString,
			Error: 0,
		}

		if isSuccessful {
			if req.DegradedAfter != 0 && res.Latency > req.DegradedAfter {
				data.Body = res.Body
			}
		} else {
			data.Error = 1
			if called < int(retry) {
				return nil, fmt.Errorf("unable to ping: %v with status %v", res, res.Status)
			}
		}

		return &data, nil
	}

	resp, err := backoff.Retry(ctx, op, backoff.WithMaxTries(uint(retry)), backoff.WithBackOff(backoff.NewExponentialBackOff()))
	if err != nil {
		return nil, err
	}
	return resp, nil
}
