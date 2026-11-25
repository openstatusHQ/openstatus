package queue_test

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"cloud.google.com/go/pubsub/v2"
	pb "cloud.google.com/go/pubsub/v2/apiv1/pubsubpb"
	"cloud.google.com/go/pubsub/v2/pstest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/pkg/queue"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

type fakeRunner struct {
	run func(ctx context.Context, monitorID string) error
}

func (f fakeRunner) RunHTTPCheck(ctx context.Context, req request.HttpCheckerRequest) (checker.Response, error) {
	return checker.Response{}, f.run(ctx, req.MonitorID)
}

func (f fakeRunner) RunTCPCheck(ctx context.Context, req request.TCPCheckerRequest) (checker.TCPResponse, error) {
	return checker.TCPResponse{}, f.run(ctx, req.MonitorID)
}

func (f fakeRunner) RunDNSCheck(ctx context.Context, req request.DNSCheckerRequest) (handlers.DNSResponse, error) {
	return handlers.DNSResponse{}, f.run(ctx, req.MonitorID)
}

func (f fakeRunner) RunICMPCheck(ctx context.Context, req request.ICMPCheckerRequest) (checker.ICMPResponse, error) {
	return checker.ICMPResponse{}, f.run(ctx, req.MonitorID)
}

func (f fakeRunner) RunGRPCCheck(ctx context.Context, req request.GRPCCheckerRequest) (checker.GRPCResponse, error) {
	return checker.GRPCResponse{}, f.run(ctx, req.MonitorID)
}

const (
	project      = "projects/test"
	subscription = "checker-local"
)

type harness struct {
	srv    *pstest.Server
	client *pubsub.Client
	events chan queue.Event
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	ctx := context.Background()
	srv := pstest.NewServer()
	t.Cleanup(func() { srv.Close() })

	_, err := srv.GServer.CreateTopic(ctx, &pb.Topic{Name: project + "/topics/" + subscription})
	require.NoError(t, err)
	_, err = srv.GServer.CreateSubscription(ctx, &pb.Subscription{
		Name:               project + "/subscriptions/" + subscription,
		Topic:              project + "/topics/" + subscription,
		AckDeadlineSeconds: 10,
	})
	require.NoError(t, err)

	conn, err := grpc.NewClient(srv.Addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close() })

	client, err := pubsub.NewClient(ctx, "test", option.WithGRPCConn(conn))
	require.NoError(t, err)
	t.Cleanup(func() { client.Close() })

	return &harness{srv: srv, client: client, events: make(chan queue.Event, 16)}
}

func (h *harness) publish(t *testing.T, jobType string, monitorID string, cronTimestamp time.Time) string {
	t.Helper()
	data, err := json.Marshal(map[string]any{
		"monitorId":     monitorID,
		"workspaceId":   "1",
		"cronTimestamp": cronTimestamp.UnixMilli(),
	})
	require.NoError(t, err)

	return h.srv.Publish(project+"/topics/"+subscription, data, map[string]string{
		"jobType":   jobType,
		"monitorId": monitorID,
	})
}

func (h *harness) start(t *testing.T, runner queue.Runner, loop queue.Loop, drain time.Duration) (context.CancelFunc, <-chan error) {
	t.Helper()

	return h.startConsumer(t, runner, loop, drain, 0)
}

func (h *harness) startConsumer(t *testing.T, runner queue.Runner, loop queue.Loop, drain time.Duration, spread time.Duration) (context.CancelFunc, <-chan error) {
	t.Helper()
	loop.Subscription = subscription
	c := &queue.Consumer{
		Client: h.client,
		Runner: runner,
		Loops:  []queue.Loop{loop},
		Drain:  drain,
		Spread: spread,
		OnEvent: func(_ context.Context, e queue.Event) {
			h.events <- e
		},
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- c.Run(ctx) }()
	t.Cleanup(cancel)

	return cancel, done
}

func (h *harness) next(t *testing.T) queue.Event {
	t.Helper()
	select {
	case e := <-h.events:
		return e
	case <-time.After(10 * time.Second):
		t.Fatal("no event")
		return queue.Event{}
	}
}

func TestConsumer_AcksRecordedCheck(t *testing.T) {
	h := newHarness(t)
	id := h.publish(t, "http", "1", time.Now())
	h.start(t, fakeRunner{run: func(context.Context, string) error { return nil }}, queue.Loop{MaxOutstanding: 10}, time.Second)

	e := h.next(t)

	assert.Equal(t, queue.OutcomeAck, e.Outcome)
	assert.Equal(t, "http", e.JobType)
	assert.Equal(t, "1", e.MonitorID)
	assert.Eventually(t, func() bool { return h.srv.Message(id).Acks == 1 }, 5*time.Second, 20*time.Millisecond)
}

func TestConsumer_NacksRecordFailure(t *testing.T) {
	h := newHarness(t)
	id := h.publish(t, "tcp", "1", time.Now())
	var calls atomic.Int32
	h.start(t, fakeRunner{run: func(context.Context, string) error {
		if calls.Add(1) == 1 {
			return errors.New("tinybird down")
		}
		return nil
	}}, queue.Loop{MaxOutstanding: 10}, time.Second)

	assert.Equal(t, queue.OutcomeNack, h.next(t).Outcome)
	assert.Equal(t, queue.OutcomeAck, h.next(t).Outcome)
	assert.GreaterOrEqual(t, h.srv.Message(id).Deliveries, 2)
}

func TestConsumer_AcksPoisonWithoutRetrying(t *testing.T) {
	h := newHarness(t)
	unknown := h.publish(t, "smtp", "1", time.Now())
	invalid := h.publish(t, "dns", "2", time.Now())
	var calls atomic.Int32
	h.start(t, fakeRunner{run: func(context.Context, string) error {
		calls.Add(1)
		return handlers.InvalidRequestError{Reason: "invalid monitor id"}
	}}, queue.Loop{MaxOutstanding: 10}, time.Second)

	assert.Equal(t, queue.OutcomePoison, h.next(t).Outcome)
	assert.Equal(t, queue.OutcomePoison, h.next(t).Outcome)
	assert.Eventually(t, func() bool {
		return h.srv.Message(unknown).Acks == 1 && h.srv.Message(invalid).Acks == 1
	}, 5*time.Second, 20*time.Millisecond)
	assert.Equal(t, int32(1), calls.Load())
}

func TestConsumer_WaitsForCronTimestamp(t *testing.T) {
	h := newHarness(t)
	at := time.Now().Add(500 * time.Millisecond)
	h.publish(t, "icmp", "1", at)
	var ranAt atomic.Int64
	h.start(t, fakeRunner{run: func(context.Context, string) error {
		ranAt.Store(time.Now().UnixMilli())
		return nil
	}}, queue.Loop{MaxOutstanding: 10}, time.Second)

	e := h.next(t)

	assert.Equal(t, queue.OutcomeAck, e.Outcome)
	assert.Positive(t, e.Wait)
	assert.GreaterOrEqual(t, ranAt.Load(), at.UnixMilli())
}

func TestConsumer_SpreadsStartPastCronTimestamp(t *testing.T) {
	h := newHarness(t)
	const window = time.Second
	// Millisecond precision, as the message carries it: the start is computed
	// from the serialized cronTimestamp, not from the sub-millisecond time.
	at := time.UnixMilli(time.Now().Add(200 * time.Millisecond).UnixMilli())
	h.publish(t, "http", "1", at)
	var ranAt atomic.Int64
	h.startConsumer(t, fakeRunner{run: func(context.Context, string) error {
		ranAt.Store(time.Now().UnixMilli())
		return nil
	}}, queue.Loop{MaxOutstanding: 10}, time.Second, window)

	e := h.next(t)

	assert.Equal(t, queue.OutcomeAck, e.Outcome)
	assert.GreaterOrEqual(t, ranAt.Load(), at.Add(queue.SpreadForTest("1", window)).UnixMilli())
}

func TestSpread(t *testing.T) {
	const window = 2 * time.Second
	assert.Zero(t, queue.SpreadForTest("1", 0))
	assert.Equal(t, queue.SpreadForTest("42", window), queue.SpreadForTest("42", window))

	lo, hi := window, time.Duration(0)
	for i := range 1000 {
		d := queue.SpreadForTest(strconv.Itoa(i), window)
		require.GreaterOrEqual(t, d, time.Duration(0))
		require.Less(t, d, window)
		lo, hi = min(lo, d), max(hi, d)
	}
	// Sequential monitor ids must still cover the whole window.
	assert.Less(t, lo, window/10)
	assert.Greater(t, hi, window*9/10)
}

func TestConsumer_SleepingMessageHoldsNoProbeSlot(t *testing.T) {
	h := newHarness(t)
	h.publish(t, "http", "later", time.Now().Add(2*time.Second))
	h.publish(t, "http", "now", time.Now())
	var mu sync.Mutex
	var order []string
	h.start(t, fakeRunner{run: func(_ context.Context, monitorID string) error {
		mu.Lock()
		order = append(order, monitorID)
		mu.Unlock()
		return nil
	}}, queue.Loop{MaxOutstanding: 10, MaxConcurrent: 1}, time.Second)

	first := h.next(t)

	assert.Equal(t, "now", first.MonitorID)
	assert.Equal(t, "later", h.next(t).MonitorID)
	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, []string{"now", "later"}, order)
}

func TestConsumer_NacksCheckStillRunningAfterDrain(t *testing.T) {
	h := newHarness(t)
	h.publish(t, "grpc", "1", time.Now())
	started := make(chan struct{})
	var stopped atomic.Bool
	cancel, done := h.start(t, fakeRunner{run: func(ctx context.Context, _ string) error {
		close(started)
		<-ctx.Done()
		stopped.Store(true)
		return ctx.Err()
	}}, queue.Loop{MaxOutstanding: 10}, 100*time.Millisecond)

	<-started
	cancel()

	e := h.next(t)
	assert.Equal(t, queue.OutcomeDrain, e.Outcome)
	assert.True(t, stopped.Load(), "check still running after its message was nacked")
	select {
	case err := <-done:
		assert.NoError(t, err)
	case <-time.After(10 * time.Second):
		t.Fatal("consumer did not stop")
	}
}

func TestConsumer_AcksMissingCronTimestampAsPoison(t *testing.T) {
	h := newHarness(t)
	id := h.srv.Publish(project+"/topics/"+subscription, []byte(`{"monitorId":"1"}`), map[string]string{
		"jobType":   "http",
		"monitorId": "1",
	})
	var calls atomic.Int32
	h.start(t, fakeRunner{run: func(context.Context, string) error {
		calls.Add(1)
		return nil
	}}, queue.Loop{MaxOutstanding: 10}, time.Second)

	assert.Equal(t, queue.OutcomePoison, h.next(t).Outcome)
	assert.Eventually(t, func() bool { return h.srv.Message(id).Acks == 1 }, 5*time.Second, 20*time.Millisecond)
	assert.Equal(t, int32(0), calls.Load())
}

func TestConsumer_RejectsNonPositiveMaxOutstanding(t *testing.T) {
	h := newHarness(t)
	_, done := h.start(t, fakeRunner{run: func(context.Context, string) error { return nil }}, queue.Loop{}, time.Second)

	select {
	case err := <-done:
		assert.ErrorContains(t, err, "must be positive")
	case <-time.After(5 * time.Second):
		t.Fatal("consumer did not fail")
	}
}

func TestSubscription(t *testing.T) {
	assert.Equal(t, "checker-ams", queue.Subscription("ams", false))
	assert.Equal(t, "checker-koyeb_fra-30s", queue.Subscription("koyeb_fra", true))
}
