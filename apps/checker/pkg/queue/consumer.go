package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/pubsub/v2"
	"golang.org/x/sync/errgroup"

	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

type Runner interface {
	RunHTTPCheck(ctx context.Context, req request.HttpCheckerRequest) (checker.Response, error)
	RunTCPCheck(ctx context.Context, req request.TCPCheckerRequest) (checker.TCPResponse, error)
	RunDNSCheck(ctx context.Context, req request.DNSCheckerRequest) (handlers.DNSResponse, error)
	RunICMPCheck(ctx context.Context, req request.ICMPCheckerRequest) (checker.ICMPResponse, error)
	RunGRPCCheck(ctx context.Context, req request.GRPCCheckerRequest) (checker.GRPCResponse, error)
}

type Outcome string

const (
	OutcomeAck    Outcome = "ack"
	OutcomeNack   Outcome = "nack"
	OutcomePoison Outcome = "poison"
	OutcomeDrain  Outcome = "drain"
)

type Event struct {
	Subscription    string
	MonitorID       string
	Periodicity     string
	JobType         string
	DeliveryAttempt int
	Wait            time.Duration
	Duration        time.Duration
	Outcome         Outcome
	Err             error
}

type Loop struct {
	Subscription string
	// MaxOutstanding caps the messages held at once, sleeping ones included.
	MaxOutstanding int
	// MaxConcurrent caps the checks running at once; zero means MaxOutstanding.
	MaxConcurrent int
}

type Consumer struct {
	Client *pubsub.Client
	Runner Runner
	Loops  []Loop
	// Drain is how long in-flight checks get to finish after shutdown starts
	// before their message is nacked for redelivery.
	Drain   time.Duration
	OnEvent func(ctx context.Context, e Event)
}

const (
	maxOutstandingBytes = 64 << 20
	maxExtension        = 25 * time.Minute
)

// Subscription names the region's subscription for a periodicity class.
func Subscription(region string, thirtySeconds bool) string {
	if thirtySeconds {
		return fmt.Sprintf("checker-%s-30s", region)
	}

	return fmt.Sprintf("checker-%s", region)
}

// Run blocks until ctx is done and every loop has drained.
func (c *Consumer) Run(ctx context.Context) error {
	g, gctx := errgroup.WithContext(ctx)
	for _, loop := range c.Loops {
		g.Go(func() error {
			return c.receive(gctx, loop)
		})
	}

	return g.Wait()
}

func (c *Consumer) receive(ctx context.Context, loop Loop) error {
	if loop.MaxOutstanding <= 0 {
		return fmt.Errorf("max outstanding for %s must be positive", loop.Subscription)
	}

	sub := c.Client.Subscriber(loop.Subscription)
	sub.ReceiveSettings.MaxOutstandingMessages = loop.MaxOutstanding
	sub.ReceiveSettings.MaxOutstandingBytes = maxOutstandingBytes
	sub.ReceiveSettings.MaxExtension = maxExtension
	sub.ReceiveSettings.ShutdownOptions = &pubsub.ShutdownOptions{
		Timeout:  c.Drain + 5*time.Second,
		Behavior: pubsub.ShutdownBehaviorWaitForProcessing,
	}

	concurrent := loop.MaxConcurrent
	if concurrent <= 0 {
		concurrent = loop.MaxOutstanding
	}
	slots := make(chan struct{}, concurrent)

	err := sub.Receive(ctx, func(msgCtx context.Context, msg *pubsub.Message) {
		e := c.handle(msgCtx, loop.Subscription, slots, msg)
		if c.OnEvent != nil {
			c.OnEvent(msgCtx, e)
		}
	})
	if err != nil {
		return fmt.Errorf("receiving from %s: %w", loop.Subscription, err)
	}

	return nil
}

type envelope struct {
	CronTimestamp int64 `json:"cronTimestamp"`
}

func (c *Consumer) handle(ctx context.Context, subscription string, slots chan struct{}, msg *pubsub.Message) Event {
	start := time.Now()
	e := Event{
		Subscription: subscription,
		MonitorID:    msg.Attributes["monitorId"],
		Periodicity:  msg.Attributes["periodicity"],
		JobType:      msg.Attributes["jobType"],
	}
	if msg.DeliveryAttempt != nil {
		e.DeliveryAttempt = *msg.DeliveryAttempt
	}
	finish := func(outcome Outcome, err error) Event {
		switch outcome {
		case OutcomeAck, OutcomePoison:
			msg.Ack()
		default:
			msg.Nack()
		}
		e.Outcome = outcome
		e.Err = err
		e.Duration = max(0, time.Since(start)-e.Wait)

		return e
	}

	var env envelope
	if err := json.Unmarshal(msg.Data, &env); err != nil {
		return finish(OutcomePoison, fmt.Errorf("decoding message: %w", err))
	}
	if env.CronTimestamp <= 0 {
		return finish(OutcomePoison, errors.New("missing cronTimestamp"))
	}

	if wait := time.Until(time.UnixMilli(env.CronTimestamp)); wait > 0 {
		e.Wait = wait
		timer := time.NewTimer(wait)
		select {
		case <-timer.C:
		case <-ctx.Done():
			timer.Stop()
			return finish(OutcomeDrain, ctx.Err())
		}
	}

	select {
	case slots <- struct{}{}:
	case <-ctx.Done():
		return finish(OutcomeDrain, ctx.Err())
	}

	// The check outlives a shutdown signal: Drain bounds how long it may run on.
	checkCtx, cancelCheck := context.WithCancel(context.WithoutCancel(ctx))
	defer cancelCheck()
	done := make(chan error, 1)
	go func() {
		defer func() { <-slots }()
		done <- c.dispatch(checkCtx, e.JobType, msg.Data)
	}()

	var err error
	select {
	case err = <-done:
	case <-ctx.Done():
		drain := time.NewTimer(c.Drain)
		defer drain.Stop()
		select {
		case err = <-done:
		case <-drain.C:
			// Stop the check before the nack so a redelivery cannot run it
			// alongside this one and record the result twice.
			cancelCheck()
			<-done
			return finish(OutcomeDrain, errors.New("check still running at shutdown"))
		}
	}

	var invalid handlers.InvalidRequestError
	switch {
	case err == nil:
		return finish(OutcomeAck, nil)
	case errors.Is(err, errUnknownJobType), errors.As(err, &invalid):
		return finish(OutcomePoison, err)
	default:
		return finish(OutcomeNack, err)
	}
}

var errUnknownJobType = errors.New("unknown job type")

func (c *Consumer) dispatch(ctx context.Context, jobType string, data []byte) error {
	switch jobType {
	case "http":
		var req request.HttpCheckerRequest
		if err := json.Unmarshal(data, &req); err != nil {
			return handlers.InvalidRequestError{Reason: err.Error()}
		}
		_, err := c.Runner.RunHTTPCheck(ctx, req)
		return err
	case "tcp":
		var req request.TCPCheckerRequest
		if err := json.Unmarshal(data, &req); err != nil {
			return handlers.InvalidRequestError{Reason: err.Error()}
		}
		_, err := c.Runner.RunTCPCheck(ctx, req)
		return err
	case "dns":
		var req request.DNSCheckerRequest
		if err := json.Unmarshal(data, &req); err != nil {
			return handlers.InvalidRequestError{Reason: err.Error()}
		}
		_, err := c.Runner.RunDNSCheck(ctx, req)
		return err
	case "icmp":
		var req request.ICMPCheckerRequest
		if err := json.Unmarshal(data, &req); err != nil {
			return handlers.InvalidRequestError{Reason: err.Error()}
		}
		_, err := c.Runner.RunICMPCheck(ctx, req)
		return err
	case "grpc":
		var req request.GRPCCheckerRequest
		if err := json.Unmarshal(data, &req); err != nil {
			return handlers.InvalidRequestError{Reason: err.Error()}
		}
		_, err := c.Runner.RunGRPCCheck(ctx, req)
		return err
	default:
		return fmt.Errorf("%w: %q", errUnknownJobType, jobType)
	}
}
