package scheduler_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	"github.com/openstatushq/openstatus/apps/checker/pkg/scheduler"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

// mockJobRunner implements job.JobRunner for testing
type mockJobRunner struct {
	HTTPJobCalled bool
	TCPJobCalled  bool
	mu            sync.Mutex
}

func (m *mockJobRunner) HTTPJob(ctx context.Context, monitor *v1.HTTPMonitor) (*job.HttpPrivateRegionData, error) {
	m.mu.Lock()
	m.HTTPJobCalled = true
	m.mu.Unlock()
	return &job.HttpPrivateRegionData{}, nil
}
func (m *mockJobRunner) TCPJob(ctx context.Context, monitor *v1.TCPMonitor) (*job.TCPPrivateRegionData, error) {
	m.mu.Lock()
	m.TCPJobCalled = true
	m.mu.Unlock()
	return &job.TCPPrivateRegionData{}, nil
}

// mockClient implements v1.PrivateLocationServiceClient for testing
type mockClient struct {
	MonitorsFunc   func(ctx context.Context, req *connect.Request[v1.MonitorsRequest]) (*connect.Response[v1.MonitorsResponse], error)
	IngestHTTPFunc func(ctx context.Context, req *connect.Request[v1.IngestHTTPRequest]) (*connect.Response[v1.IngestHTTPResponse], error)
	IngestTCPFunc  func(ctx context.Context, req *connect.Request[v1.IngestTCPRequest]) (*connect.Response[v1.IngestTCPResponse], error)
}

func (m *mockClient) Monitors(ctx context.Context, req *connect.Request[v1.MonitorsRequest]) (*connect.Response[v1.MonitorsResponse], error) {
	return m.MonitorsFunc(ctx, req)
}
func (m *mockClient) IngestHTTP(ctx context.Context, req *connect.Request[v1.IngestHTTPRequest]) (*connect.Response[v1.IngestHTTPResponse], error) {
	return m.IngestHTTPFunc(ctx, req)
}
func (m *mockClient) IngestTCP(ctx context.Context, req *connect.Request[v1.IngestTCPRequest]) (*connect.Response[v1.IngestTCPResponse], error) {
	return m.IngestTCPFunc(ctx, req)
}

func TestMonitorManager_StartAndStopJobs_WithJobRunner(t *testing.T) {
	ctx := t.Context()

	// Patch intervalToSecond to run jobs quickly


	httpMonitor := &v1.HTTPMonitor{Id: "http1", Url: "http://openstat.us", Periodicity: "30s"}
	tcpMonitor := &v1.TCPMonitor{Id: "tcp1", Uri: "openstatus:80", Periodicity: "30s"}

	client := &mockClient{
		MonitorsFunc: func(ctx context.Context, req *connect.Request[v1.MonitorsRequest]) (*connect.Response[v1.MonitorsResponse], error) {
			return connect.NewResponse(&v1.MonitorsResponse{
				HttpMonitors: []*v1.HTTPMonitor{httpMonitor},
				TcpMonitors:  []*v1.TCPMonitor{tcpMonitor},
			}), nil
		},
		IngestHTTPFunc: func(ctx context.Context, req *connect.Request[v1.IngestHTTPRequest]) (*connect.Response[v1.IngestHTTPResponse], error) {
			return connect.NewResponse(&v1.IngestHTTPResponse{}), nil
		},
		IngestTCPFunc: func(ctx context.Context, req *connect.Request[v1.IngestTCPRequest]) (*connect.Response[v1.IngestTCPResponse], error) {
			return connect.NewResponse(&v1.IngestTCPResponse{}), nil
		},
	}
	jobRunner := &mockJobRunner{}

	mm := &scheduler.MonitorManager{
		TcpMonitors:     make(map[string]*v1.TCPMonitor),
		HttpMonitors:    make(map[string]*v1.HTTPMonitor),
		MonitorChannels: make(map[string]chan bool),
		Client:          client,
		JobRunner:       jobRunner,
	}

	mm.UpdateMonitors(ctx)
	time.Sleep(150 * time.Millisecond) // allow jobs to run

	if !jobRunner.HTTPJobCalled {
		t.Errorf("expected HTTPJob to be called")
	}
	if !jobRunner.TCPJobCalled {
		t.Errorf("expected TCPJob to be called")
	}

	// Remove monitors and ensure jobs are stopped
	client.MonitorsFunc = func(ctx context.Context, req *connect.Request[v1.MonitorsRequest]) (*connect.Response[v1.MonitorsResponse], error) {
		return connect.NewResponse(&v1.MonitorsResponse{
			HttpMonitors: []*v1.HTTPMonitor{},
			TcpMonitors:  []*v1.TCPMonitor{},
		}), nil
	}
	mm.UpdateMonitors(ctx)
	time.Sleep(50 * time.Millisecond)

	if len(mm.HttpMonitors) != 0 {
		t.Errorf("expected no HTTP monitors, got %d", len(mm.HttpMonitors))
	}
	if len(mm.TcpMonitors) != 0 {
		t.Errorf("expected no TCP monitors, got %d", len(mm.TcpMonitors))
	}
	if len(mm.MonitorChannels) != 0 {
		t.Errorf("expected no monitor channels, got %d", len(mm.MonitorChannels))
	}
}
