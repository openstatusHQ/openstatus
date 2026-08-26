package checker

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/stats"
	"google.golang.org/grpc/status"
)

type GRPCTLSMode string

const (
	GRPCTLSModeTLS         GRPCTLSMode = "tls"
	GRPCTLSModePlaintext   GRPCTLSMode = "plaintext"
	GRPCTLSModeTLSInsecure GRPCTLSMode = "tls_insecure"
)

const (
	// Applied when a caller omits the timeout, matching the monitor column default.
	grpcDefaultTimeout = 45_000

	ServingStatusServing        = "SERVING"
	ServingStatusNotServing     = "NOT_SERVING"
	ServingStatusServiceUnknown = "SERVICE_UNKNOWN"
	ServingStatusUnknown        = "UNKNOWN"
)

// GRPCResponseTiming is HTTP's phase shape verbatim: gRPC is HTTP/2, and reusing
// it lets calculateTiming and the dashboard waterfall work with no new code.
type GRPCResponseTiming = Timing

func ParseGRPCTLSMode(value string) GRPCTLSMode {
	switch value {
	case string(GRPCTLSModePlaintext):
		return GRPCTLSModePlaintext
	case string(GRPCTLSModeTLSInsecure):
		return GRPCTLSModeTLSInsecure
	default:
		return GRPCTLSModeTLS
	}
}

type GRPCResult struct {
	Timing        GRPCResponseTiming
	ServingStatus string
	Message       string
	Latency       int64
	GRPCCode      int64
	// Completed reports that the server answered. It cannot be derived from the
	// error flag: NOT_SERVING is a failed check that completed perfectly well.
	Completed bool
	Healthy   bool
}

type GRPCResponse struct {
	Region        string             `json:"region"`
	ErrorMessage  string             `json:"errorMessage"`
	JobType       string             `json:"jobType"`
	ServingStatus string             `json:"servingStatus"`
	Service       string             `json:"service"`
	RequestId     int64              `json:"requestId,omitempty"`
	WorkspaceID   int64              `json:"workspaceId"`
	MonitorID     int64              `json:"monitorId"`
	Timestamp     int64              `json:"timestamp"`
	Latency       int64              `json:"latency"`
	GRPCCode      int64              `json:"grpcCode"`
	Timing        GRPCResponseTiming `json:"timing"`
	Completed     bool               `json:"completed"`
	Error         uint8              `json:"error,omitempty"`
}

func grpcNow() int64 {
	return time.Now().UTC().UnixMilli()
}

// grpcTimer guards the phase struct: grpc-go dials and reads on its own
// goroutines, so the probe goroutine cannot write it unsynchronised.
type grpcTimer struct {
	mu     sync.Mutex
	timing GRPCResponseTiming
}

func (g *grpcTimer) set(apply func(t *GRPCResponseTiming)) {
	g.mu.Lock()
	defer g.mu.Unlock()
	apply(&g.timing)
}

func (g *grpcTimer) snapshot() GRPCResponseTiming {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.timing
}

// CheckGRPC calls grpc.health.v1.Health/Check on target. A non-nil error means
// the RPC never completed; a completed call with a bad answer is reported
// through the result instead.
func CheckGRPC(timeoutMs int64, target, service string, mode GRPCTLSMode, md map[string]string) (GRPCResult, error) {
	if timeoutMs <= 0 {
		timeoutMs = grpcDefaultTimeout
	}

	host, _, err := net.SplitHostPort(target)
	if err != nil {
		return GRPCResult{}, fmt.Errorf("invalid target %q: expected host:port", target)
	}

	// One deadline for resolve, dial, handshake and call. Splitting them would
	// let a stalled DNS lookup run past the timeout the user configured.
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	timer := &grpcTimer{}

	conn, err := grpc.NewClient(target,
		grpc.WithTransportCredentials(grpcCredentials(mode, host, timer)),
		grpc.WithContextDialer(grpcDialer(timer)),
		grpc.WithStatsHandler(&grpcStatsHandler{timer: timer}),
	)
	if err != nil {
		return GRPCResult{Timing: timer.snapshot()}, fmt.Errorf("dial error: %w", err)
	}
	defer conn.Close()

	callCtx := ctx
	if len(md) > 0 {
		callCtx = metadata.NewOutgoingContext(ctx, metadata.New(md))
	}

	start := time.Now()
	res, err := grpc_health_v1.NewHealthClient(conn).Check(
		callCtx,
		&grpc_health_v1.HealthCheckRequest{Service: service},
		grpc.WaitForReady(false),
	)
	latency := time.Since(start).Milliseconds()
	timing := timer.snapshot()

	if err != nil {
		code := status.Code(err)
		result := GRPCResult{
			Timing:   timing,
			Latency:  latency,
			GRPCCode: int64(code),
		}

		switch code {
		case codes.Unimplemented:
			// The server is up and talking gRPC; it just has no health service.
			// Reporting this as "down" sends people hunting the wrong problem.
			result.Completed = true
			result.Message = "server does not implement grpc.health.v1.Health"
			return result, nil
		case codes.NotFound:
			// grpc-go's reference health server answers an unregistered service
			// with NOT_FOUND rather than the SERVICE_UNKNOWN enum value.
			result.Completed = true
			result.ServingStatus = ServingStatusServiceUnknown
			result.Message = grpcUnknownServiceMessage(service)
			return result, nil
		}

		result.Latency = 0
		return result, fmt.Errorf("%s", grpcTransportMessage(code, err, timeoutMs))
	}

	servingStatus := grpcServingStatusName(res.GetStatus())
	result := GRPCResult{
		Timing:        timing,
		Latency:       latency,
		ServingStatus: servingStatus,
		GRPCCode:      int64(codes.OK),
		Completed:     true,
		Healthy:       servingStatus == ServingStatusServing,
	}

	switch servingStatus {
	case ServingStatusServing:
		result.Message = fmt.Sprintf("Health check passed for %s", target)
	case ServingStatusNotServing:
		result.Message = "service reports NOT_SERVING"
	case ServingStatusServiceUnknown:
		result.Message = grpcUnknownServiceMessage(service)
	default:
		result.Message = "service reports UNKNOWN"
	}

	return result, nil
}

func grpcUnknownServiceMessage(service string) string {
	if service == "" {
		return "server does not know the requested service"
	}
	return fmt.Sprintf("server does not know service %q", service)
}

func grpcServingStatusName(s grpc_health_v1.HealthCheckResponse_ServingStatus) string {
	switch s {
	case grpc_health_v1.HealthCheckResponse_SERVING:
		return ServingStatusServing
	case grpc_health_v1.HealthCheckResponse_NOT_SERVING:
		return ServingStatusNotServing
	case grpc_health_v1.HealthCheckResponse_SERVICE_UNKNOWN:
		return ServingStatusServiceUnknown
	default:
		return ServingStatusUnknown
	}
}

// grpcTransportMessage maps a failed dial onto a fixed string. The raw error is
// never returned: a certificate failure quotes the peer's subject and chain,
// which would hand an internal service's identity back to the caller.
func grpcTransportMessage(code codes.Code, err error, timeoutMs int64) string {
	if code == codes.DeadlineExceeded {
		return fmt.Sprintf("timeout after %d ms", timeoutMs)
	}

	raw := err.Error()
	switch {
	case isTLSFailure(raw):
		return "certificate verification failed"
	case strings.Contains(raw, "connection refused"):
		return "connection refused"
	case strings.Contains(raw, "no such host"):
		return "resolve error"
	case code == codes.Unavailable:
		return "dial error"
	}

	return fmt.Sprintf("grpc check failed with code %s", code)
}

func isTLSFailure(message string) bool {
	return strings.Contains(message, "x509:") ||
		strings.Contains(message, "tls:") ||
		strings.Contains(message, "certificate")
}

func grpcCredentials(mode GRPCTLSMode, host string, timer *grpcTimer) credentials.TransportCredentials {
	switch mode {
	case GRPCTLSModePlaintext:
		return insecure.NewCredentials()
	case GRPCTLSModeTLSInsecure:
		return &timingCredentials{
			//nolint:gosec // the tls_insecure mode exists so operators can probe
			// self-signed internal services; it is opt-in per monitor.
			TransportCredentials: credentials.NewTLS(&tls.Config{InsecureSkipVerify: true}),
			timer:                timer,
		}
	default:
		return &timingCredentials{
			TransportCredentials: credentials.NewTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}),
			timer:                timer,
		}
	}
}

type timingCredentials struct {
	credentials.TransportCredentials
	timer *grpcTimer
}

func (c *timingCredentials) ClientHandshake(ctx context.Context, authority string, raw net.Conn) (net.Conn, credentials.AuthInfo, error) {
	c.timer.set(func(t *GRPCResponseTiming) { t.TlsHandshakeStart = grpcNow() })
	conn, info, err := c.TransportCredentials.ClientHandshake(ctx, authority, raw)
	if err == nil {
		c.timer.set(func(t *GRPCResponseTiming) { t.TlsHandshakeDone = grpcNow() })
	}

	return conn, info, err
}

func (c *timingCredentials) Clone() credentials.TransportCredentials {
	return &timingCredentials{TransportCredentials: c.TransportCredentials.Clone(), timer: c.timer}
}

// grpcDialer resolves and connects by hand so the two phases can be timed
// apart, the way httptrace splits them for HTTP.
func grpcDialer(timer *grpcTimer) func(context.Context, string) (net.Conn, error) {
	return func(ctx context.Context, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, err
		}

		timer.set(func(t *GRPCResponseTiming) { t.DnsStart = grpcNow() })
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		if len(ips) == 0 {
			return nil, fmt.Errorf("no such host %s", host)
		}
		timer.set(func(t *GRPCResponseTiming) { t.DnsDone = grpcNow() })

		timer.set(func(t *GRPCResponseTiming) { t.ConnectStart = grpcNow() })
		var dialer net.Dialer
		conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ips[0].String(), port))
		if err != nil {
			return nil, err
		}
		timer.set(func(t *GRPCResponseTiming) { t.ConnectDone = grpcNow() })

		return conn, nil
	}
}

// grpcStatsHandler times the call itself: headers back is the first byte, the
// message that follows is the transfer.
type grpcStatsHandler struct {
	timer *grpcTimer
}

func (h *grpcStatsHandler) TagRPC(ctx context.Context, _ *stats.RPCTagInfo) context.Context {
	return ctx
}

func (h *grpcStatsHandler) HandleRPC(_ context.Context, s stats.RPCStats) {
	switch s.(type) {
	case *stats.OutHeader:
		h.timer.set(func(t *GRPCResponseTiming) { t.FirstByteStart = grpcNow() })
	case *stats.InHeader:
		h.timer.set(func(t *GRPCResponseTiming) {
			t.FirstByteDone = grpcNow()
			t.TransferStart = grpcNow()
		})
	case *stats.InPayload:
		h.timer.set(func(t *GRPCResponseTiming) { t.TransferDone = grpcNow() })
	}
}

func (h *grpcStatsHandler) TagConn(ctx context.Context, _ *stats.ConnTagInfo) context.Context {
	return ctx
}

func (h *grpcStatsHandler) HandleConn(context.Context, stats.ConnStats) {}
