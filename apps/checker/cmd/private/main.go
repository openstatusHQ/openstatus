package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/checker/pkg/openstatus"
	"github.com/openstatushq/openstatus/apps/checker/request"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	configRefreshInterval = 1 * time.Minute
	checkInterval         = 30 * time.Second
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown on interrupt
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		cancel()
	}()

	monitorChannels := make(map[string]chan bool)
	monitors := make(map[string]*v1.HTTPMonitor)
	apiKey := getEnv("OPENSTATUS_KEY", "key")

	configTicker := time.NewTicker(configRefreshInterval)
	defer configTicker.Stop()
	updateMonitors(apiKey, monitors, monitorChannels)
	fmt.Println("Private region launched")
	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
			fmt.Println("fetching monitors")
			updateMonitors(apiKey, monitors, monitorChannels)
		}
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// updateMonitors fetches the latest monitors and starts/stops jobs as needed
func updateMonitors(apiKey string, monitors map[string]*v1.HTTPMonitor, monitorChannels map[string]chan bool) {
	client := v1.NewPrivateLocationServiceClient(
		http.DefaultClient,
		"http://localhost:8080",
		connect.WithHTTPGet(),
	)

	ctx, callInfo := connect.NewClientContext(context.Background())
	callInfo.RequestHeader().Set("openstatus-token", apiKey)
	res, err := client.Monitors(ctx, &connect.Request[v1.MonitorsRequest]{})
	if err != nil {
		log.Fatal(err)
	}

	currentIDs := make(map[string]struct{})
	for _, m := range res.Msg.Monitors {
		currentIDs[m.Id] = struct{}{}
		if _, exists := monitors[m.Id]; !exists {
			doneChan := make(chan bool)
			monitorChannels[m.Id] = doneChan
			monitors[m.Id] = m
			go scheduleJob(*m, doneChan)
		}
	}

	// Stop jobs for monitors that no longer exist
	for id := range monitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			monitorChannels[id] <- true
			delete(monitors, id)
			delete(monitorChannels, id)
		}
	}
}

func scheduleJob(monitor v1.HTTPMonitor, done chan bool) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	var degradedAfter int64
	if monitor.DegradedAt != nil {
		degradedAfter = *monitor.DegradedAt
	}


	req := request.HttpCheckerRequest{
		URL:            monitor.Url,
		MonitorID:      monitor.Id,
		Method:         monitor.Method,
		Body:           monitor.Body,
		Retry:          monitor.Retry,
		Timeout:        monitor.Timeout,
		DegradedAfter:  degradedAfter,
		FollowRedirects: monitor.FollowRedirects,
	}

	for {
		select {
		case <-ticker.C:
			fmt.Printf("Starting job for monitor %s (%s)\n", req.MonitorID, req.URL)
			if err := openstatus.HTTPJob(req); err != nil {
				log.Printf("Monitor check failed for %s (%s): %v", req.MonitorID, req.URL, err)
			} else {
				log.Printf("Monitor check succeeded for %s (%s)", req.MonitorID, req.URL)
			}
		case <-done:
			log.Printf("Shutting down job for monitor %s (%s)", req.MonitorID, req.URL)
			return
		}
	}
}
