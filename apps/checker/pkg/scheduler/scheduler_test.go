package scheduler_test

import (
	"context"
	"sync/atomic"

	"sync"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/madflojo/tasks"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	"github.com/openstatushq/openstatus/apps/checker/pkg/scheduler"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

// mockJobRunner implements job.JobRunner for testing
type mockJobRunner struct {
	HTTPJobCalled atomic.Bool
	TCPJobCalled  atomic.Bool
	DNSJobCalled  atomic.Bool
	mu            sync.Mutex
	httpRegion    string
	tcpRegion     string
}

func (m *mockJobRunner) HTTPJob(ctx context.Context, monitor *v1.HTTPMonitor, region string) (*job.HttpPrivateRegionData, error) {
	m.HTTPJobCalled.Store(true)
	m.mu.Lock()
	m.httpRegion = region
	m.mu.Unlock()
	return &job.HttpPrivateRegionData{}, nil
}
func (m *mockJobRunner) TCPJob(ctx context.Context, monitor *v1.TCPMonitor, region string) (*job.TCPPrivateRegionData, error) {

	m.TCPJobCalled.Store(true)
	m.mu.Lock()
	m.tcpRegion = region
	m.mu.Unlock()
	return &job.TCPPrivateRegionData{}, nil
}

func (m *mockJobRunner) HTTPRegion() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.httpRegion
}

func (m *mockJobRunner) TCPRegion() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.tcpRegion
}

func (m *mockJobRunner) DNSJob(ctx context.Context, monitor *v1.DNSMonitor) (*job.DNSPrivateRegionData, error) {

	m.TCPJobCalled.Store(true)
	return &job.DNSPrivateRegionData{}, nil
}

// mockClient implements v1.PrivateLocationServiceClient for testing
type mockClient struct {
	MonitorsFunc   func(ctx context.Context, req *connect.Request[v1.MonitorsRequest]) (*connect.Response[v1.MonitorsResponse], error)
	IngestHTTPFunc func(ctx context.Context, req *connect.Request[v1.IngestHTTPRequest]) (*connect.Response[v1.IngestHTTPResponse], error)
	IngestTCPFunc  func(ctx context.Context, req *connect.Request[v1.IngestTCPRequest]) (*connect.Response[v1.IngestTCPResponse], error)
	IngestDNSFunc  func(ctx context.Context, req *connect.Request[v1.IngestDNSRequest]) (*connect.Response[v1.IngestDNSResponse], error)
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
func (m *mockClient) IngestDNS(ctx context.Context, req *connect.Request[v1.IngestDNSRequest]) (*connect.Response[v1.IngestDNSResponse], error) {
	return m.IngestDNSFunc(ctx, req)
}

func TestMonitorManager_StartAndStopJobs_WithJobRunner(t *testing.T) {
	ctx := t.Context()

	httpMonitor := &v1.HTTPMonitor{Id: "http1", Url: "http://openstat.us", Periodicity: "10s"}
	tcpMonitor := &v1.TCPMonitor{Id: "tcp1", Uri: "openstatus:80", Periodicity: "10s"}
	const wantRegion = "frankfurt-dc1"

	// Regression guard: the tasks scheduler never populates TaskContext.Context,
	// so jobs must pass a non-nil context to the connect client or IngestTCP panics.
	var tcpIngestCtxNonNil atomic.Bool

	client := &mockClient{
		MonitorsFunc: func(ctx context.Context, req *connect.Request[v1.MonitorsRequest]) (*connect.Response[v1.MonitorsResponse], error) {
			return connect.NewResponse(&v1.MonitorsResponse{
				HttpMonitors: []*v1.HTTPMonitor{httpMonitor},
				TcpMonitors:  []*v1.TCPMonitor{tcpMonitor},
				Region:       wantRegion,
			}), nil
		},
		IngestHTTPFunc: func(ctx context.Context, req *connect.Request[v1.IngestHTTPRequest]) (*connect.Response[v1.IngestHTTPResponse], error) {
			return connect.NewResponse(&v1.IngestHTTPResponse{}), nil
		},
		IngestTCPFunc: func(ctx context.Context, req *connect.Request[v1.IngestTCPRequest]) (*connect.Response[v1.IngestTCPResponse], error) {
			if ctx != nil {
				tcpIngestCtxNonNil.Store(true)
			}
			return connect.NewResponse(&v1.IngestTCPResponse{}), nil
		},
	}
	jobRunner := &mockJobRunner{}

	s := tasks.New()
	defer s.Stop()

	mm := &scheduler.MonitorManager{

		Client:    client,
		JobRunner: jobRunner,
		Scheduler: s,
	}

	mm.UpdateMonitors(ctx)
	time.Sleep(12 * time.Second) // allow jobs to run

	if !jobRunner.HTTPJobCalled.Load() == true {
		t.Errorf("expected HTTPJob to be called")
	}
	if !jobRunner.TCPJobCalled.Load() == true {
		t.Errorf("expected TCPJob to be called")
	}
	if got := jobRunner.HTTPRegion(); got != wantRegion {
		t.Errorf("expected HTTPJob to receive region %q, got %q", wantRegion, got)
	}
	if got := jobRunner.TCPRegion(); got != wantRegion {
		t.Errorf("expected TCPJob to receive region %q, got %q", wantRegion, got)
	}
	if !tcpIngestCtxNonNil.Load() {
		t.Errorf("expected IngestTCP to receive a non-nil context")
	}

	// Remove monitors and ensure jobs are stopped
	client.MonitorsFunc = func(ctx context.Context, req *connect.Request[v1.MonitorsRequest]) (*connect.Response[v1.MonitorsResponse], error) {
		return connect.NewResponse(&v1.MonitorsResponse{
			HttpMonitors: []*v1.HTTPMonitor{},
			TcpMonitors:  []*v1.TCPMonitor{},
		}), nil
	}
	mm.UpdateMonitors(ctx)
	time.Sleep(1 * time.Second)

	if _, err := mm.Scheduler.Lookup("http1"); err == nil {
		t.Errorf("expected HTTP job to be removed")
	}
	if _, err := mm.Scheduler.Lookup("tcp1"); err == nil {
		t.Errorf("expected TCP job to be removed")
	}

}
