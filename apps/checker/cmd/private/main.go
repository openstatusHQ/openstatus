package main

import (
	"context"
	"fmt"
	"net/http"

	"os"
	"os/signal"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/madflojo/tasks"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	"github.com/openstatushq/openstatus/apps/checker/pkg/scheduler"

	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	configRefreshInterval = 10 * time.Minute
	platformTimeout       = 30 * time.Second
)

func main() {
	apiKey := getEnv("OPENSTATUS_KEY", "")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "OPENSTATUS_KEY is required: the probe cannot authenticate against openstatus")
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown on interrupt
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		cancel()
	}()
	fmt.Println("Launching openstatus private location checker")
	s := tasks.New()
	defer s.Stop()

	monitorManager := scheduler.MonitorManager{
		Client:    getClient(apiKey),
		JobRunner: job.NewJobRunner(),
		Scheduler: s,
	}
	configTicker := time.NewTicker(configRefreshInterval)
	defer configTicker.Stop()

	monitorManager.UpdateMonitors(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
			fmt.Println("fetching monitors")
			monitorManager.UpdateMonitors(ctx)
		}
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getClient(apiKey string) v1.PrivateLocationServiceClient {
	ingestUrl := getEnv("OPENSTATUS_INGEST_URL", "https://openstatus-private-location.fly.dev")

	// Tasks run with RunSingleInstance, so an untimed request that hangs would
	// wedge that monitor: it never checks again until the probe restarts.
	httpClient := &http.Client{Timeout: platformTimeout}

	client := v1.NewPrivateLocationServiceClient(
		httpClient,
		ingestUrl,
		connect.WithHTTPGet(),
		connect.WithInterceptors(NewAuthInterceptor(apiKey)),
	)

	return client
}

func NewAuthInterceptor(token string) connect.UnaryInterceptorFunc {

	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {
			if req.Spec().IsClient {
				// Send a token with client requests.
				req.Header().Set("openstatus-token", token)
			}

			return next(ctx, req)
		})
	}
	return connect.UnaryInterceptorFunc(interceptor)

}
