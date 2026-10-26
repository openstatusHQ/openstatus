package tinybird_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/stretchr/testify/require"
)

type recordedRequest struct {
	dataSource string
	lines      []string
}

type fakeEventsAPI struct {
	mu       sync.Mutex
	requests []recordedRequest
	respond  func(attempt int) *http.Response
	attempts atomic.Int32
}

func (f *fakeEventsAPI) client() *http.Client {
	return (&interceptorHTTPClient{f: func(req *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(req.Body)
		f.mu.Lock()
		f.requests = append(f.requests, recordedRequest{
			dataSource: req.URL.Query().Get("name"),
			lines:      strings.Split(strings.TrimSuffix(string(body), "\n"), "\n"),
		})
		f.mu.Unlock()

		attempt := int(f.attempts.Add(1))
		if f.respond != nil {
			if resp := f.respond(attempt); resp != nil {
				return resp, nil
			}
			return nil, errors.New("connection reset")
		}

		return status(http.StatusAccepted, nil), nil
	}}).GetHTTPClient()
}

func (f *fakeEventsAPI) recorded() []recordedRequest {
	f.mu.Lock()
	defer f.mu.Unlock()

	return append([]recordedRequest(nil), f.requests...)
}

func status(code int, header http.Header) *http.Response {
	if header == nil {
		header = http.Header{}
	}

	return &http.Response{StatusCode: code, Header: header, Body: io.NopCloser(strings.NewReader(""))}
}

func options() tinybird.BatcherOptions {
	return tinybird.BatcherOptions{
		FlushInterval: 20 * time.Millisecond,
		MaxBytes:      1 << 20,
		RetryBudget:   time.Second,
	}
}

// eventLine is the NDJSON line sendAll writes per row.
const eventLine = `"event"` + "\n"

func sendAll(t *testing.T, b *tinybird.Batcher, dataSource string, n int) []error {
	t.Helper()
	errs := make([]error, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Go(func() {
			errs[i] = b.SendEvent(t.Context(), "event", dataSource)
		})
	}
	wg.Wait()

	return errs
}

func TestBatcher(t *testing.T) {
	t.Parallel()

	t.Run("it should send concurrent rows as one NDJSON request", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{}
		opts := options()
		// Only the 50th row can trigger the flush, whatever the scheduling.
		opts.FlushInterval = time.Hour
		opts.MaxBytes = 50 * len(eventLine)
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		for _, err := range sendAll(t, b, "ping_response__v8", 50) {
			require.NoError(t, err)
		}

		requests := api.recorded()
		require.Len(t, requests, 1)
		require.Equal(t, "ping_response__v8", requests[0].dataSource)
		require.Len(t, requests[0].lines, 50)
	})

	t.Run("it should flush before the interval once the batch reaches MaxBytes", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{}
		opts := options()
		opts.FlushInterval = time.Hour
		opts.MaxBytes = 1
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		require.NoError(t, b.SendEvent(t.Context(), "event", "test"))
		require.Len(t, api.recorded(), 1)
	})

	t.Run("it should keep data sources in separate requests", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{}
		b := tinybird.NewBatcher(api.client(), "apiKey", options())

		var wg sync.WaitGroup
		for _, ds := range []string{"ping_response__v8", "tcp_response__v0"} {
			wg.Go(func() { require.NoError(t, b.SendEvent(t.Context(), "event", ds)) })
		}
		wg.Wait()

		requests := api.recorded()
		require.Len(t, requests, 2)
		require.ElementsMatch(t, []string{"ping_response__v8", "tcp_response__v0"}, []string{requests[0].dataSource, requests[1].dataSource})
	})

	t.Run("it should honor Retry-After on 429 and then succeed", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{respond: func(attempt int) *http.Response {
			if attempt == 1 {
				return status(http.StatusTooManyRequests, http.Header{"Retry-After": {"1"}})
			}
			return status(http.StatusAccepted, nil)
		}}
		opts := options()
		opts.RetryBudget = 5 * time.Second
		events := make(chan tinybird.FlushEvent, 1)
		opts.OnFlush = func(_ context.Context, e tinybird.FlushEvent) { events <- e }
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		start := time.Now()
		require.NoError(t, b.SendEvent(t.Context(), "event", "test"))
		require.GreaterOrEqual(t, time.Since(start), time.Second)
		require.Len(t, api.recorded(), 2)
		flushed := <-events
		require.Equal(t, 2, flushed.Attempts)
		require.Equal(t, 0, flushed.AmbiguousAttempts)
	})

	t.Run("it should return the error to every row once the retry budget is spent", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{respond: func(int) *http.Response { return status(http.StatusServiceUnavailable, nil) }}
		opts := options()
		opts.RetryBudget = 800 * time.Millisecond
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		for _, err := range sendAll(t, b, "test", 5) {
			require.ErrorContains(t, err, "unexpected status code: 503")
		}
		require.Greater(t, len(api.recorded()), 1)
	})

	t.Run("it should retry network errors and count them as ambiguous", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{respond: func(attempt int) *http.Response {
			if attempt == 1 {
				return nil
			}
			return status(http.StatusAccepted, nil)
		}}
		opts := options()
		events := make(chan tinybird.FlushEvent, 1)
		opts.OnFlush = func(_ context.Context, e tinybird.FlushEvent) { events <- e }
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		require.NoError(t, b.SendEvent(t.Context(), "event", "test"))
		require.Equal(t, 1, (<-events).AmbiguousAttempts)
	})

	t.Run("it should not retry a 400", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{respond: func(int) *http.Response { return status(http.StatusBadRequest, nil) }}
		b := tinybird.NewBatcher(api.client(), "apiKey", options())

		require.ErrorContains(t, b.SendEvent(t.Context(), "event", "test"), "unexpected status code: 400")
		require.Len(t, api.recorded(), 1)
	})

	t.Run("it should return when the caller's context is cancelled", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{}
		opts := options()
		opts.FlushInterval = time.Hour
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		ctx, cancel := context.WithTimeout(t.Context(), 20*time.Millisecond)
		defer cancel()
		require.ErrorIs(t, b.SendEvent(ctx, "event", "test"), context.DeadlineExceeded)
	})

	t.Run("it should flush pending rows on Close and refuse new ones", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{}
		opts := options()
		opts.FlushInterval = time.Hour
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		sent := make(chan error, 1)
		go func() { sent <- b.SendEvent(t.Context(), "event", "test") }()
		// The flush interval alone would never fire.
		require.Eventually(t, func() bool { return b.PendingRows("test") == 1 }, time.Second, time.Millisecond)
		require.NoError(t, b.Close(t.Context()))

		require.NoError(t, <-sent)
		require.Len(t, api.recorded(), 1)
		require.ErrorIs(t, b.SendEvent(t.Context(), "event", "test"), tinybird.ErrBatcherClosed)
	})

	t.Run("it should count the wait behind an earlier flush against the retry budget", func(t *testing.T) {
		t.Parallel()
		opts := options()
		opts.RetryBudget = 200 * time.Millisecond
		api := &fakeEventsAPI{respond: func(attempt int) *http.Response {
			if attempt == 1 {
				// A slow request holds the sender past the queued batch's deadline.
				time.Sleep(2 * opts.RetryBudget)
			}
			return status(http.StatusServiceUnavailable, nil)
		}}
		opts.FlushInterval = time.Hour
		opts.MaxBytes = 1
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		first := make(chan error, 1)
		go func() { first <- b.SendEvent(t.Context(), "event", "test") }()
		require.Eventually(t, func() bool { return len(api.recorded()) > 0 }, time.Second, time.Millisecond)

		// Queued behind the first batch, which keeps its sender busy past this batch's budget.
		start := time.Now()
		err := b.SendEvent(t.Context(), "event", "test")
		require.Len(t, api.recorded(), 1)
		require.Less(t, time.Since(start), 3*opts.RetryBudget)
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.ErrorContains(t, err, "flush not attempted")
		require.ErrorContains(t, <-first, "unexpected status code: 503")
	})

	t.Run("it should abort in-flight retries once Close gives up", func(t *testing.T) {
		t.Parallel()
		api := &fakeEventsAPI{respond: func(int) *http.Response { return status(http.StatusServiceUnavailable, nil) }}
		opts := options()
		opts.FlushInterval = time.Hour
		opts.MaxBytes = 1
		opts.RetryBudget = time.Minute
		b := tinybird.NewBatcher(api.client(), "apiKey", opts)

		sent := make(chan error, 1)
		go func() { sent <- b.SendEvent(t.Context(), "event", "test") }()
		require.Eventually(t, func() bool { return len(api.recorded()) > 0 }, time.Second, time.Millisecond)

		ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
		defer cancel()
		require.ErrorIs(t, b.Close(ctx), context.DeadlineExceeded)
		select {
		case err := <-sent:
			require.ErrorContains(t, err, "unexpected status code: 503")
		// The row's error is already queued; only the SendEvent goroutine has to be scheduled.
		case <-time.After(time.Second):
			t.Fatal("the row should fail as soon as Close returns")
		}
	})
}
