package main

import (
	"context"
	"fmt"

	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/pkg/scheduler"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	configRefreshInterval = 1 * time.Minute
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

	monitorManager := scheduler.MonitorManager{
		HttpMonitors:    make(map[string]*v1.HTTPMonitor),
		MonitorChannels: make(map[string]chan bool),
	}

	apiKey := getEnv("OPENSTATUS_KEY", "key")

	configTicker := time.NewTicker(configRefreshInterval)
	defer configTicker.Stop()
	monitorManager.UpdateMonitors(ctx, apiKey)
	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
			fmt.Println("fetching monitors")
			monitorManager.UpdateMonitors(ctx, apiKey)
		}
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// UpdateMonitors fetches the latest monitors and starts/stops jobs as needed
