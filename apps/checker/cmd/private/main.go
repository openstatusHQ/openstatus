package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/checker/pkg/openstatus"
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
	monitors := make(map[string]openstatus.RawMonitor)
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
func updateMonitors(apiKey string, monitors map[string]openstatus.RawMonitor, monitorChannels map[string]chan bool) {
	configMonitors := openstatus.GetMonitors(apiKey)
	client := v1.NewPrivateLocationServiceClient(
		http.DefaultClient,
		"http://localhost:8080",
		connect.WithHTTPGet(),
	)

	ctx, callInfo := connect.NewClientContext(context.Background())
	callInfo.RequestHeader().Set("openstatus-token", "key")
	res, err := client.Monitors(ctx, &connect.Request[v1.MonitorsRequest]{})
	if err != nil {
		log.Fatal(err)
	}
	mi := res.Msg.Monitors
	for _, c:= range mi {

		fmt.Println(c)
	}
	currentIDs := make(map[string]struct{})
	for _, m := range configMonitors {
		idStr := strconv.Itoa(m.ID)
		currentIDs[idStr] = struct{}{}
		if _, exists := monitors[idStr]; !exists {
			doneChan := make(chan bool)
			monitorChannels[idStr] = doneChan
			monitors[idStr] = m
			go scheduleJob(m, doneChan)
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

func scheduleJob(req openstatus.RawMonitor, done chan bool) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	if req.JobType == "http" {
		// Run the job and schedule it
		go openstatus.HTTPJob(req)
	}
	if req.JobType == "tcp" {
		// Run the job and schedule it
		fmt.Println("TCP job")
	}

	for {
		select {
		case <-ticker.C:
			fmt.Println("start job", req.URL)

			var err error
			if req.JobType == "http" {
				// Run the job and schedule it
				err = openstatus.HTTPJob(req)
			}
			if req.JobType == "tcp" {
				// Run the job and schedule it
				fmt.Println("TCP job")
			}
			if err != nil {

				log.Printf("Monitor check failed: %v", err)
			}

		case <-done:
			return
		}
	}
}
