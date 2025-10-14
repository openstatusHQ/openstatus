package scheduler

import (
	"context"
	"log"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/madflojo/tasks"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	Interval10s = "10s"
	Interval30s = "30s"
	Interval1m  = "1m"
	Interval5m  = "5m"
	Interval10m = "10m"
	Interval30m = "30m"
	Interval1h  = "1h"
)

type MonitorManager struct {
	TcpMonitors  map[string]*v1.TCPMonitor
	HttpMonitors map[string]*v1.HTTPMonitor
	Client       v1.PrivateLocationServiceClient
	JobRunner    job.JobRunner
	Scheduler    *tasks.Scheduler
	mu           sync.Mutex
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
			interval := time.Duration(intervalToSecond(m.Periodicity)) * time.Second
			task := tasks.Task{
				Interval:   interval,
				StartAfter: time.Now().Add(5 * time.Millisecond),
				RunOnce:    false,
				RunSingleInstance: true,
				// StartAfter: time.Duration(1) * time.Second,
				FuncWithTaskContext: func(ctx tasks.TaskContext) error {
					monitor := mm.HttpMonitors[ctx.ID()]
					log.Printf("Starting job for monitor %s (%s)", monitor.Id, monitor.Url)
					data, err := mm.JobRunner.HTTPJob(ctx.Context, monitor)

					if err != nil {
						log.Printf("Monitor check failed for %s (%s): %v", monitor.Id, monitor.Url, err)
						return err
					}
					resp, ingestErr := mm.Client.IngestHTTP(ctx.Context, &connect.Request[v1.IngestHTTPRequest]{
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
						return ingestErr
					}
					log.Printf("Monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Url, resp)
					return nil
				},
			}

			err := mm.Scheduler.AddWithID(m.Id, &task)
			mm.mu.Lock()

			mm.HttpMonitors[m.Id] = m
			mm.mu.Unlock()

			if err != nil {
				log.Printf("Failed to add HTTP monitor job for %s (%s): %v", m.Id, m.Url, err)
				continue
			}
			log.Printf("Started monitoring job for %s (%s)", m.Id, m.Url)
		}
	}

	// Stop jobs for monitors that no longer exist
	for id := range mm.HttpMonitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			mm.Scheduler.Del(id)
			mm.mu.Lock()
			delete(mm.HttpMonitors, id)
			mm.mu.Unlock()


		}
	}

	// TCP monitors: start jobs for new monitors
	for _, m := range res.Msg.TcpMonitors {
		currentIDs[m.Id] = struct{}{}
		if _, exists := mm.TcpMonitors[m.Id]; !exists {

			mm.TcpMonitors[m.Id] = m
			interval := time.Duration(intervalToSecond(m.Periodicity)) * time.Second
			task := tasks.Task{
				Interval:   interval,
				RunOnce:    false,
				// StartAfter: time.Now().Add(5 * time.Millisecond),
				RunSingleInstance: true,
				FuncWithTaskContext: func(ctx tasks.TaskContext) error {
					mm.mu.Lock()
					monitor := mm.TcpMonitors[ctx.ID()]
					mm.mu.Unlock()

					log.Printf("Starting TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
					data, err := mm.JobRunner.TCPJob(ctx.Context, monitor)
					if err != nil {
						log.Printf("TCP monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
					}
					resp, ingestErr := mm.Client.IngestTCP(ctx.Context, &connect.Request[v1.IngestTCPRequest]{
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
						return ingestErr
					}
					log.Printf("TCP monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Uri, resp)

					return nil
				},
			}
			err := mm.Scheduler.AddWithID(m.Id, &task)
			mm.mu.Lock()

			mm.TcpMonitors[m.Id] = m
			mm.mu.Unlock()

			if err != nil {
				log.Printf("Failed to add TCP monitor job for %s (%s): %v", m.Id, m.Uri, err)
				continue
			}
			log.Printf("Started TCP monitoring job for %s (%s)", m.Id, m.Uri)
		}
	}

	// Stop jobs for TCP monitors that no longer exist
	for id := range mm.TcpMonitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			mm.Scheduler.Del(id)
			mm.mu.Lock()
			delete(mm.TcpMonitors, id)
			mm.mu.Unlock()
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
	case Interval10s:
		return 10
	default:
		return 0
	}
}

// func (mm *MonitorManager) ScheduleHTTPJob(ctx context.Context, monitor *v1.HTTPMonitor, done chan bool) {
// 	interval := intervalToSecond(monitor.Periodicity)
// 	if interval == 0 {
// 		log.Printf("Invalid interval for monitor %s (%s): %s", monitor.Id, monitor.Url, monitor.Periodicity)
// 		return
// 	}

// 	ticker := time.NewTicker(time.Duration(1) * time.Second)
// 	defer ticker.Stop()

// 	for {
// 		select {
// 		case <-ticker.C:
// 			log.Printf("Starting job for monitor %s (%s)", monitor.Id, monitor.Url)
// 			data, err := mm.JobRunner.HTTPJob(ctx, monitor)
// 			if err != nil {
// 				log.Printf("Monitor check failed for %s (%s): %v", monitor.Id, monitor.Url, err)
// 				continue
// 			}
// 			resp, ingestErr := mm.Client.IngestHTTP(ctx, &connect.Request[v1.IngestHTTPRequest]{
// 				Msg: &v1.IngestHTTPRequest{
// 					Id:            monitor.Id,
// 					Url:           monitor.Url,
// 					Message:       data.Message,
// 					Latency:       data.Latency,
// 					Timing:        data.Timing,
// 					Headers:       data.Headers,
// 					Body:          data.Body,
// 					RequestStatus: data.RequestStatus,
// 					StatusCode:    int64(data.StatusCode),
// 					Error:         int64(data.Error),
// 					CronTimestamp: data.CronTimestamp,
// 					Timestamp:     data.Timestamp,
// 				},
// 			})
// 			if ingestErr != nil {
// 				log.Printf("Failed to ingest HTTP result for %s (%s): %v", monitor.Id, monitor.Url, ingestErr)
// 			} else {
// 				log.Printf("Monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Url, resp)
// 			}
// 		case <-done:
// 			log.Printf("Shutting down job for monitor %s (%s)", monitor.Id, monitor.Url)
// 			return
// 		}
// 	}
// }

// func (mm *MonitorManager) ScheduleTCPJob(ctx context.Context, monitor *v1.TCPMonitor, done chan bool) {
// 	interval := intervalToSecond(monitor.Periodicity)
// 	if interval == 0 {
// 		log.Printf("Invalid interval for TCP monitor %s (%s): %s", monitor.Id, monitor.Uri, monitor.Periodicity)
// 		return
// 	}

// 	ticker := time.NewTicker(time.Duration(1) * time.Second)
// 	defer ticker.Stop()

// 	for {
// 		select {
// 		case <-ticker.C:
// 			log.Printf("Starting TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
// 			data, err := mm.JobRunner.TCPJob(ctx, monitor)
// 			if err != nil {
// 				log.Printf("TCP monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
// 				continue
// 			}
// 			resp, ingestErr := mm.Client.IngestTCP(ctx, &connect.Request[v1.IngestTCPRequest]{
// 				Msg: &v1.IngestTCPRequest{
// 					Id:            monitor.Id,
// 					Uri:           monitor.Uri,
// 					Message:       data.Message,
// 					Latency:       data.Latency,
// 					RequestStatus: data.RequestStatus,
// 					Error:         int64(data.Error),
// 					CronTimestamp: data.CronTimestamp,
// 					Timestamp:     data.Timestamp,
// 				},
// 			})
// 			if ingestErr != nil {
// 				log.Printf("Failed to ingest TCP result for %s (%s): %v", monitor.Id, monitor.Uri, ingestErr)
// 			} else {
// 				log.Printf("TCP monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Uri, resp)
// 			}
// 		case <-done:
// 			log.Printf("Shutting down TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
// 			return
// 		}
// 	}
// }
