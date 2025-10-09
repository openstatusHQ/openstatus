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
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	configRefreshInterval = 1 * time.Minute
)

type MonitorManager struct {
	httpMonitors    map[string]*v1.HTTPMonitor
	monitorChannels map[string]chan bool
}

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

	monitorManager := MonitorManager{
		httpMonitors:    make(map[string]*v1.HTTPMonitor),
		monitorChannels: make(map[string]chan bool),
	}

	apiKey := getEnv("OPENSTATUS_KEY", "key")

	configTicker := time.NewTicker(configRefreshInterval)
	defer configTicker.Stop()
	monitorManager.updateMonitors(apiKey)
	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
			fmt.Println("fetching monitors")
			monitorManager.updateMonitors(apiKey)
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
func (mm *MonitorManager) updateMonitors(apiKey string) {
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

	for _, m := range res.Msg.HttpMonitors {
		currentIDs[m.Id] = struct{}{}
		if _, exists := mm.httpMonitors[m.Id]; !exists {
			doneChan := make(chan bool)
			mm.monitorChannels[m.Id] = doneChan
			mm.httpMonitors[m.Id] = m
			go scheduleJob(*m, doneChan)
			log.Printf("Started monitoring job for %s (%s)", m.Id, m.Url)
		}
	}

	// Stop jobs for monitors that no longer exist
	for id, monitor := range mm.httpMonitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			if ch, ok := mm.monitorChannels[id]; ok {
				ch <- true
				close(ch)
			}
			log.Printf("Stopped monitoring job for %s (%s)", id, monitor.Url)
			delete(mm.httpMonitors, id)
			delete(mm.monitorChannels, id)
		}
	}
}

func intervalToSecond(interval string)int {
	switch interval {
		case "30s":
			return 30
		case "1m":
			return 60
		case "5m":
			return 300
		case "10m":
			return 600
		case "30m":
			return 1800
		case "1h":
			return 3600

		default:
			return 0
	}
}
func scheduleJob(monitor v1.HTTPMonitor, done chan bool) {

	interval := intervalToSecond(monitor.Periodicity)

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()


	for {
		select {
		case <-ticker.C:
			fmt.Printf("Starting job for monitor %s (%s)\n", monitor.Id, monitor.Url)
			data, err := openstatus.HTTPJob(monitor)
			if err != nil {
				log.Printf("Monitor check failed for %s (%s): %v",monitor.Id, monitor.Url, err)
			} else {
				fmt.Print(data)
				log.Printf("Monitor check succeeded for %s (%s)", monitor.Id, monitor.Url)
			}
		case <-done:
			log.Printf("Shutting down job for monitor %s (%s)",monitor.Id, monitor.Url)
			return
		}
	}
}
