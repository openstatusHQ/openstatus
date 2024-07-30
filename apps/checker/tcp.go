package checker

import (
	"fmt"
	"net"
	"strings"
	"time"
)

func PingTcp(timeout int, url string) (err error) {
	start := time.Now().UTC().UnixMilli()
	conn, err := net.DialTimeout("tcp", url,
		time.Duration(timeout)*time.Second)
	if err != nil {
		if e := err.(*net.OpError).Timeout(); e {
			return fmt.Errorf("Timeout after %d ms", timeout*1000)
		}
		if strings.Contains(err.Error(), "connection refused") {
			return fmt.Errorf("Connection refused")
		}
		return fmt.Errorf("Dial Error: %v", err)
	}
	stop := time.Now().UTC().UnixMilli()
	defer conn.Close()
	fmt.Println("Latency: ", stop-start, "ms")
	return
}
