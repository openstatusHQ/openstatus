package checker

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"
)

type TCPData struct {
	WorkspaceID string `json:"workspaceId"`
	MonitorID   string `json:"monitorId"`
	Timestamp   int64  `json:"timestamp"`
}

type TCPResponseTiming struct {
	TCPStart int64 `json:"tcpStart"`
	TCPDone  int64 `json:"tcpDone"`
}

type TCPResponse struct {
	Region       string            `json:"region"`
	ErrorMessage string            `json:"errorMessage"`
	JobType      string            `json:"jobType"`
	RequestId    int64             `json:"requestId,omitempty"`
	WorkspaceID  int64             `json:"workspaceId"`
	MonitorID    int64             `json:"monitorId"`
	Timestamp    int64             `json:"timestamp"`
	Latency      int64             `json:"latency"`
	Timing       TCPResponseTiming `json:"timing"`
	Error        uint8             `json:"error,omitempty"`
}

// tcpDefaultTimeout is the dial timeout in milliseconds when none is given.
const tcpDefaultTimeout = 45_000

// PingTCP dials url and reports how long the connection took. timeoutMs is in
// milliseconds, like every monitor timeout; the dial also stops when ctx ends.
func PingTCP(ctx context.Context, timeoutMs int64, url string) (TCPResponseTiming, error) {
	if timeoutMs <= 0 {
		timeoutMs = tcpDefaultTimeout
	}

	dialer := net.Dialer{Timeout: time.Duration(timeoutMs) * time.Millisecond}

	start := time.Now().UTC().UnixMilli()
	conn, err := dialer.DialContext(ctx, "tcp", url)
	stop := time.Now().UTC().UnixMilli()

	if err != nil {
		var netErr net.Error
		if errors.As(err, &netErr) && netErr.Timeout() {
			return TCPResponseTiming{}, fmt.Errorf("timeout after %d ms", timeoutMs)
		}
		if strings.Contains(err.Error(), "connection refused") {
			return TCPResponseTiming{}, fmt.Errorf("connection refused")
		}
		return TCPResponseTiming{}, fmt.Errorf("dial error: %w", err)
	}
	defer conn.Close()

	return TCPResponseTiming{TCPStart: start, TCPDone: stop}, nil
}
