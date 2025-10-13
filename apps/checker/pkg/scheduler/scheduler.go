package scheduler
import (
	"context"
	"log"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	Interval30s = "30s"
	Interval1m  = "1m"
	Interval5m  = "5m"
	Interval10m = "10m"
	Interval30m = "30m"
	Interval1h  = "1h"
)

type MonitorManager struct {
	TcpMonitors     map[string]*v1.TCPMonitor
	HttpMonitors    map[string]*v1.HTTPMonitor
	MonitorChannels map[string]chan bool
	Client          v1.PrivateLocationServiceClient
	JobRunner job.JobRunner
}

// Helper to stop a job and clean up maps
func (mm *MonitorManager) stopJob(id string, monitorType string) {
	if ch, ok := mm.MonitorChannels[id]; ok {
		ch <- true
		close(ch)
	}
	switch monitorType {
	case "http":
		if monitor, ok := mm.HttpMonitors[id]; ok {
			log.Printf("Stopped monitoring job for %s (%s)", id, monitor.Url)
		}
		delete(mm.HttpMonitors, id)
	case "tcp":
		if monitor, ok := mm.TcpMonitors[id]; ok {
			log.Printf("Stopped TCP monitoring job for %s (%s)", id, monitor.Uri)
		}
		delete(mm.TcpMonitors, id)
	}
	delete(mm.MonitorChannels, id)
}

func (mm *MonitorManager) UpdateMonitors(ctx context.Context) {
	res, err := mm.Client.Monitors(ctx, &connect.Request[v1.MonitorsRequest]{})
	if err != nil {
		log.Printf("Failed to fetch monitors: %v", err)
		return
	}

	currentIDs := make(map[string]struct{})

	// HTTP monitors: start jobs for new monitors
	for _, m := range res.Msg.HttpMonitors {
		currentIDs[m.Id] = struct{}{}
		if _, exists := mm.HttpMonitors[m.Id]; !exists {
			doneChan := make(chan bool)
			mm.MonitorChannels[m.Id] = doneChan
			mm.HttpMonitors[m.Id] = m
			go mm.ScheduleHTTPJob(ctx, m, doneChan)
			log.Printf("Started monitoring job for %s (%s)", m.Id, m.Url)
		}
	}

	// Stop jobs for monitors that no longer exist
	for id := range mm.HttpMonitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			mm.stopJob(id, "http")
		}
	}

	// TCP monitors: start jobs for new monitors
	for _, m := range res.Msg.TcpMonitors {
		currentIDs[m.Id] = struct{}{}
		if _, exists := mm.TcpMonitors[m.Id]; !exists {
			doneChan := make(chan bool)
			mm.MonitorChannels[m.Id] = doneChan
			mm.TcpMonitors[m.Id] = m
			go mm.ScheduleTCPJob(ctx, m, doneChan)
			log.Printf("Started TCP monitoring job for %s (%s)", m.Id, m.Uri)
		}
	}

	// Stop jobs for TCP monitors that no longer exist
	for id := range mm.TcpMonitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			mm.stopJob(id, "tcp")
		}
	}
}

func intervalToSecond(interval string) int {
	switch interval {
	case Interval30s:
		return 30
	case Interval1m:
		return 60
	case Interval5m:
		return 300
	case Interval10m:
		return 600
	case Interval30m:
		return 1800
	case Interval1h:
		return 3600

	default:
		return 0
	}
}

func (mm *MonitorManager) ScheduleHTTPJob(ctx context.Context, monitor *v1.HTTPMonitor, done chan bool) {
	interval := intervalToSecond(monitor.Periodicity)
	if interval == 0 {
		log.Printf("Invalid interval for monitor %s (%s): %s", monitor.Id, monitor.Url, monitor.Periodicity)
		return
	}

	log.Printf("Starting job for monitor %s (%s)", monitor.Id, monitor.Url)
	data, err := mm.JobRunner.HTTPJob(ctx, monitor)
	if err != nil {
		log.Printf("Monitor check failed for %s (%s): %v", monitor.Id, monitor.Url, err)
	}
	resp, ingestErr := mm.Client.IngestHTTP(ctx, &connect.Request[v1.IngestHTTPRequest]{
		Msg: &v1.IngestHTTPRequest{
			Id:            monitor.Id,
			Url:           monitor.Url,
			Message:       data.Message,
			Latency:       data.Latency,
			Timing:        data.Timing,
			Headers:       data.Headers,
			Body:          data.Body,
			RequestStatus: data.RequestStatus,
			StatusCode:    int64(data.StatusCode),
			Error:         int64(data.Error),
			CronTimestamp: data.CronTimestamp,
			Timestamp:     data.Timestamp,
		},
	})
	if ingestErr != nil {
		log.Printf("Failed to ingest HTTP result for %s (%s): %v", monitor.Id, monitor.Url, ingestErr)
	} else {
		log.Printf("Monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Url, resp)
	}

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Printf("Starting job for monitor %s (%s)", monitor.Id, monitor.Url)
			data, err := mm.JobRunner.HTTPJob(ctx, monitor)
			if err != nil {
				log.Printf("Monitor check failed for %s (%s): %v", monitor.Id, monitor.Url, err)
				continue
			}
			resp, ingestErr := mm.Client.IngestHTTP(ctx, &connect.Request[v1.IngestHTTPRequest]{
				Msg: &v1.IngestHTTPRequest{
					Id:            monitor.Id,
					Url:           monitor.Url,
					Message:       data.Message,
					Latency:       data.Latency,
					Timing:        data.Timing,
					Headers:       data.Headers,
					Body:          data.Body,
					RequestStatus: data.RequestStatus,
					StatusCode:    int64(data.StatusCode),
					Error:         int64(data.Error),
					CronTimestamp: data.CronTimestamp,
					Timestamp:     data.Timestamp,
				},
			})
			if ingestErr != nil {
				log.Printf("Failed to ingest HTTP result for %s (%s): %v", monitor.Id, monitor.Url, ingestErr)
			} else {
				log.Printf("Monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Url, resp)
			}
		case <-done:
			log.Printf("Shutting down job for monitor %s (%s)", monitor.Id, monitor.Url)
			return
		}
	}
}

func (mm *MonitorManager) ScheduleTCPJob(ctx context.Context, monitor *v1.TCPMonitor, done chan bool) {
	interval := intervalToSecond(monitor.Periodicity)
	if interval == 0 {
		log.Printf("Invalid interval for TCP monitor %s (%s): %s", monitor.Id, monitor.Uri, monitor.Periodicity)
		return
	}

	log.Printf("Starting TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
	data, err := mm.JobRunner.TCPJob(ctx, monitor)
	if err != nil {
		log.Printf("TCP monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
	}
	resp, ingestErr := mm.Client.IngestTCP(ctx, &connect.Request[v1.IngestTCPRequest]{
		Msg: &v1.IngestTCPRequest{
			Id:            monitor.Id,
			Uri:           monitor.Uri,
			Message:       data.Message,
			Latency:       data.Latency,
			RequestStatus: data.RequestStatus,
			Error:         int64(data.Error),
			CronTimestamp: data.CronTimestamp,
			Timestamp:     data.Timestamp,
		},
	})
	if ingestErr != nil {
		log.Printf("Failed to ingest TCP result for %s (%s): %v", monitor.Id, monitor.Uri, ingestErr)
	} else {
		log.Printf("TCP monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Uri, resp)
	}

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Printf("Starting TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
			data, err := mm.JobRunner.TCPJob(ctx, monitor)
			if err != nil {
				log.Printf("TCP monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
				continue
			}
			resp, ingestErr := mm.Client.IngestTCP(ctx, &connect.Request[v1.IngestTCPRequest]{
				Msg: &v1.IngestTCPRequest{
					Id:            monitor.Id,
					Uri:           monitor.Uri,
					Message:       data.Message,
					Latency:       data.Latency,
					RequestStatus: data.RequestStatus,
					Error:         int64(data.Error),
					CronTimestamp: data.CronTimestamp,
					Timestamp:     data.Timestamp,
				},
			})
			if ingestErr != nil {
				log.Printf("Failed to ingest TCP result for %s (%s): %v", monitor.Id, monitor.Uri, ingestErr)
			} else {
				log.Printf("TCP monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Uri, resp)
			}
		case <-done:
			log.Printf("Shutting down TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
			return
		}
	}
}
