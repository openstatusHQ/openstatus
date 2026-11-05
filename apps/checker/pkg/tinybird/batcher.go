package tinybird

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

var ErrBatcherClosed = errors.New("tinybird batcher closed")

type BatcherOptions struct {
	// A batch is flushed FlushInterval plus a random share of FlushJitter after
	// its first row, or as soon as it reaches MaxBytes.
	FlushInterval time.Duration
	FlushJitter   time.Duration
	MaxBytes      int
	// RetryBudget bounds one batch from the moment it is detached, including the
	// wait behind an earlier flush of the same data source, so a Tinybird outage
	// cannot queue batches indefinitely.
	RetryBudget time.Duration
	OnFlush     func(context.Context, FlushEvent)
}

func DefaultBatcherOptions() BatcherOptions {
	return BatcherOptions{
		FlushInterval: 2 * time.Second,
		FlushJitter:   time.Second,
		MaxBytes:      5 << 20,
		RetryBudget:   30 * time.Second,
	}
}

type FlushEvent struct {
	DataSource string
	Rows       int
	Bytes      int
	Attempts   int
	// AmbiguousAttempts counts failed attempts Tinybird may still have ingested
	// (network errors and 5xx), so a later success can duplicate the rows.
	AmbiguousAttempts  int
	StatusCode         int
	Duration           time.Duration
	OldestWait         time.Duration
	RateLimitLimit     int
	RateLimitRemaining int
	Err                error
}

// Batcher implements Client by grouping rows per data source into one NDJSON
// request to the Events API. SendEvent returns once its row's batch is flushed.
type Batcher struct {
	httpClient *http.Client
	apiKey     string
	baseURL    string
	opts       BatcherOptions

	// stop aborts in-flight flushes once Close gives up waiting.
	stop       context.Context
	cancelStop context.CancelFunc

	mu      sync.Mutex
	closed  bool
	batches map[string]*batch
	// senders holds one slot per data source: a flush owns it while sending.
	senders map[string]chan struct{}
	flushes sync.WaitGroup
}

type batch struct {
	dataSource string
	body       bytes.Buffer
	waiters    []chan error
	startedAt  time.Time
	deadline   time.Time
	timer      *time.Timer
}

func NewBatcher(httpClient *http.Client, apiKey string, opts BatcherOptions) *Batcher {
	stop, cancelStop := context.WithCancel(context.Background())

	return &Batcher{
		httpClient: httpClient,
		apiKey:     apiKey,
		baseURL:    getBaseURL(),
		opts:       opts,
		stop:       stop,
		cancelStop: cancelStop,
		batches:    map[string]*batch{},
		senders:    map[string]chan struct{}{},
	}
}

func (b *Batcher) SendEvent(ctx context.Context, event any, dataSourceName string) error {
	line, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("unable to encode payload: %w", err)
	}

	done := make(chan error, 1)

	b.mu.Lock()
	if b.closed {
		b.mu.Unlock()
		return ErrBatcherClosed
	}
	current, ok := b.batches[dataSourceName]
	if !ok {
		current = &batch{dataSource: dataSourceName, startedAt: time.Now()}
		current.timer = time.AfterFunc(b.flushDelay(), func() { b.flushOnTimer(current) })
		b.batches[dataSourceName] = current
	}
	current.body.Write(line)
	current.body.WriteByte('\n')
	current.waiters = append(current.waiters, done)
	if current.body.Len() >= b.opts.MaxBytes {
		b.detachLocked(current)
	}
	b.mu.Unlock()

	// A cancelled caller's row stays in the batch and is still sent, so the
	// redelivered check can record it twice: delivery is at least once.
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Close flushes every pending batch and waits for in-flight flushes, bounded by
// ctx. When ctx ends first, in-flight flushes are aborted and their rows fail.
func (b *Batcher) Close(ctx context.Context) error {
	defer b.cancelStop()

	b.mu.Lock()
	b.closed = true
	for _, pending := range b.batches {
		b.detachLocked(pending)
	}
	b.mu.Unlock()

	done := make(chan struct{})
	go func() {
		b.flushes.Wait()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		b.cancelStop()
		<-done
		return ctx.Err()
	}
}

func (b *Batcher) flushDelay() time.Duration {
	if b.opts.FlushJitter <= 0 {
		return b.opts.FlushInterval
	}

	return b.opts.FlushInterval + rand.N(b.opts.FlushJitter)
}

func (b *Batcher) flushOnTimer(target *batch) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.batches[target.dataSource] == target {
		b.detachLocked(target)
	}
}

// detachLocked hands the batch to a flush goroutine; new rows start a new batch.
func (b *Batcher) detachLocked(target *batch) {
	delete(b.batches, target.dataSource)
	target.timer.Stop()
	target.deadline = time.Now().Add(b.opts.RetryBudget)

	sender, ok := b.senders[target.dataSource]
	if !ok {
		sender = make(chan struct{}, 1)
		b.senders[target.dataSource] = sender
	}

	b.flushes.Add(1)
	go func() {
		defer b.flushes.Done()
		ctx, cancel := context.WithDeadline(b.stop, target.deadline)
		defer cancel()

		// One request per data source at a time, so retries don't pile up; the
		// batch deadline and Close bound the wait for the sender.
		select {
		case sender <- struct{}{}:
			defer func() { <-sender }()
		case <-ctx.Done():
		}
		b.flush(ctx, target)
	}()
}

func (b *Batcher) flush(ctx context.Context, target *batch) {
	start := time.Now()
	event := FlushEvent{
		DataSource:         target.dataSource,
		Rows:               len(target.waiters),
		Bytes:              target.body.Len(),
		RateLimitLimit:     -1,
		RateLimitRemaining: -1,
	}

	event.Err = b.sendWithRetry(ctx, target, &event)
	event.Duration = time.Since(start)
	event.OldestWait = time.Since(target.startedAt)

	for _, waiter := range target.waiters {
		waiter <- event.Err
	}

	if b.opts.OnFlush != nil {
		b.opts.OnFlush(context.Background(), event)
	}
}

func (b *Batcher) sendWithRetry(ctx context.Context, target *batch, event *FlushEvent) error {
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("flush not attempted: %w", err)
	}

	requestURL, err := url.Parse(b.baseURL)
	if err != nil {
		return fmt.Errorf("unable to parse url: %w", err)
	}
	q := requestURL.Query()
	q.Add("name", target.dataSource)
	requestURL.RawQuery = q.Encode()

	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL.String(), bytes.NewReader(target.body.Bytes()))
		if err != nil {
			return fmt.Errorf("unable to create request: %w", err)
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", b.apiKey))

		event.Attempts++
		resp, err := b.httpClient.Do(req)
		var retryAfter time.Duration
		if err != nil {
			err = fmt.Errorf("unable to send request: %w", err)
		} else {
			event.StatusCode = resp.StatusCode
			event.RateLimitLimit = headerInt(resp.Header, "X-RateLimit-Limit")
			event.RateLimitRemaining = headerInt(resp.Header, "X-RateLimit-Remaining")
			retryAfter = parseRetryAfter(resp.Header.Get("Retry-After"))
			// Drain so the connection is reused by the next attempt.
			_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
			resp.Body.Close()

			if resp.StatusCode == http.StatusAccepted {
				return nil
			}
			err = fmt.Errorf("unexpected status code: %d", resp.StatusCode)
		}

		retryable := resp == nil || resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500
		if !retryable {
			return err
		}
		if resp == nil || resp.StatusCode >= 500 {
			event.AmbiguousAttempts++
		}

		wait := retryAfter
		if wait <= 0 {
			wait = backoff(event.Attempts)
		}
		if time.Now().Add(wait).After(target.deadline) {
			return err
		}

		select {
		case <-time.After(wait):
		case <-ctx.Done():
			return err
		}
	}
}

func backoff(attempt int) time.Duration {
	base := min(250*time.Millisecond<<min(attempt-1, 5), 5*time.Second)

	return base/2 + rand.N(base)
}

func parseRetryAfter(value string) time.Duration {
	if value == "" {
		return 0
	}
	if seconds, err := strconv.Atoi(value); err == nil {
		return time.Duration(seconds) * time.Second
	}
	if at, err := http.ParseTime(value); err == nil {
		return time.Until(at)
	}

	return 0
}

func headerInt(header http.Header, key string) int {
	value, err := strconv.Atoi(header.Get(key))
	if err != nil {
		return -1
	}

	return value
}
