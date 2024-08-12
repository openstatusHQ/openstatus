package checker

import (
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

func PingTcp(timeout int, url string) (TCPResponseTiming, error) {
	start := time.Now().UTC().UnixMilli()
	conn, err := net.DialTimeout("tcp", url,
		time.Duration(timeout)*time.Second)
	if err != nil {
		if e := err.(*net.OpError).Timeout(); e {
			return TCPResponseTiming{}, fmt.Errorf("Timeout after %d ms", timeout*1000)
		}
		if strings.Contains(err.Error(), "connection refused") {
			return TCPResponseTiming{}, fmt.Errorf("Connection refused")
		}
		return TCPResponseTiming{}, fmt.Errorf("Dial Error: %v", err)
	}
	stop := time.Now().UTC().UnixMilli()
	defer conn.Close()
	fmt.Println("Latency: ", stop-start, "ms")
	return TCPResponseTiming{TCPStart: start, TCPDone: stop}, nil
}
