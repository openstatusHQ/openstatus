package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/openstatus"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

const (
	configRefreshInterval = 10 * time.Minute
	checkInterval         = 60 * time.Second
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
	monitors := make(map[string]openstatus.Monitor)
	apiKey := getEnv("OPENSTATUS_KEY", "")

	configTicker := time.NewTicker(configRefreshInterval)
	defer configTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
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
func updateMonitors(apiKey string, monitors map[string]openstatus.Monitor, monitorChannels map[string]chan bool) {
	configMonitors := openstatus.GetMonitors(apiKey)
	currentIDs := make(map[string]struct{})

	for _, m := range configMonitors {
		idStr := strconv.Itoa(m.ID)
		currentIDs[idStr] = struct{}{}
		if _, exists := monitors[idStr]; !exists {
			doneChan := make(chan bool)
			monitorChannels[idStr] = doneChan
			monitors[idStr] = m
			go scheduleJob(request.HttpCheckerRequest{}, doneChan)
		}
	}

	// Stop jobs for monitors that no longer exist
	for id, _ := range monitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			monitorChannels[id] <- true
			delete(monitors, id)
			delete(monitorChannels, id)
		}
	}
}

func scheduleJob(req request.HttpCheckerRequest, done chan bool) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	client := &http.Client{
		Timeout: time.Duration(req.Timeout) * time.Millisecond,
	}
	defer client.CloseIdleConnections()

	if !req.FollowRedirects {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	} else {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		}
	}

	ctx := context.Background()
	for {
		select {
		case <-ticker.C:
			if _, err := checker.Http(ctx, client, req); err != nil {
				log.Printf("Monitor check failed: %v", err)
			}
		case <-done:
			return
		}
	}
}
