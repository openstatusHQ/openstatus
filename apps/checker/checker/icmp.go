package checker

import (
	"fmt"
	"net"
	"os"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
	"golang.org/x/net/ipv6"
)

const (
	icmpPacketCount    = 3
	icmpPacketInterval = 100 * time.Millisecond
)

type ICMPResponseTiming struct {
	// RTTs holds one entry per sent packet in send order; -1 marks a lost packet.
	RTTs []int64 `json:"rtts"`
}

type ICMPResult struct {
	Timing          ICMPResponseTiming
	Latency         int64
	LatencyMin      int64
	LatencyMax      int64
	PacketsSent     uint8
	PacketsReceived uint8
}

type ICMPResponse struct {
	Region          string             `json:"region"`
	ErrorMessage    string             `json:"errorMessage"`
	JobType         string             `json:"jobType"`
	RequestId       int64              `json:"requestId,omitempty"`
	WorkspaceID     int64              `json:"workspaceId"`
	MonitorID       int64              `json:"monitorId"`
	Timestamp       int64              `json:"timestamp"`
	Latency         int64              `json:"latency"`
	LatencyMin      int64              `json:"latencyMin"`
	LatencyMax      int64              `json:"latencyMax"`
	PacketsSent     uint8              `json:"packetsSent"`
	PacketsReceived uint8              `json:"packetsReceived"`
	Timing          ICMPResponseTiming `json:"timing"`
	Error           uint8              `json:"error,omitempty"`
}

func PingICMP(timeoutMs int64, hostname string) (ICMPResult, error) {
	dst, err := net.ResolveIPAddr("ip", hostname)
	if err != nil {
		return ICMPResult{}, fmt.Errorf("resolve error: %w", err)
	}

	var (
		udpNetwork string
		rawNetwork string
		proto      int
		echoType   icmp.Type
	)
	if dst.IP.To4() != nil {
		udpNetwork, rawNetwork, proto, echoType = "udp4", "ip4:icmp", ipv4.ICMPTypeEcho.Protocol(), ipv4.ICMPTypeEcho
	} else {
		udpNetwork, rawNetwork, proto, echoType = "udp6", "ip6:ipv6-icmp", ipv6.ICMPTypeEchoRequest.Protocol(), ipv6.ICMPTypeEchoRequest
	}

	conn, isRaw, err := listenICMP(udpNetwork, rawNetwork)
	if err != nil {
		return ICMPResult{}, fmt.Errorf("icmp socket error: %w", err)
	}
	defer conn.Close()

	deadline := time.Now().Add(time.Duration(timeoutMs) * time.Millisecond)
	id := os.Getpid() & 0xffff

	timing := ICMPResponseTiming{RTTs: make([]int64, 0, icmpPacketCount)}
	received := make([]int64, 0, icmpPacketCount)
	var packetsSent uint8
	var lastErr error

	for seq := 0; seq < icmpPacketCount; seq++ {
		if seq > 0 {
			time.Sleep(icmpPacketInterval)
		}

		remaining := time.Until(deadline)
		if remaining <= 0 {
			break
		}
		perPacket := remaining / time.Duration(icmpPacketCount-seq)
		packetsSent++

		rtt, err := sendEcho(conn, isRaw, proto, echoType, dst, id, seq, time.Now().Add(perPacket))
		if err != nil {
			lastErr = err
			timing.RTTs = append(timing.RTTs, -1)
			continue
		}
		timing.RTTs = append(timing.RTTs, rtt)
		received = append(received, rtt)
	}

	if len(received) == 0 {
		if lastErr != nil {
			return ICMPResult{}, lastErr
		}
		return ICMPResult{}, fmt.Errorf("no reply from %s", hostname)
	}

	var sum, min, max int64
	for i, rtt := range received {
		sum += rtt
		if i == 0 || rtt < min {
			min = rtt
		}
		if i == 0 || rtt > max {
			max = rtt
		}
	}

	return ICMPResult{
		Timing:          timing,
		Latency:         sum / int64(len(received)),
		LatencyMin:      min,
		LatencyMax:      max,
		PacketsSent:     packetsSent,
		PacketsReceived: uint8(len(received)),
	}, nil
}

// listenICMP prefers an unprivileged datagram socket and falls back to a raw
// socket when the runtime lacks ping_group_range but holds CAP_NET_RAW.
func listenICMP(udpNetwork, rawNetwork string) (*icmp.PacketConn, bool, error) {
	udpBind, rawBind := "0.0.0.0", "0.0.0.0"
	if udpNetwork == "udp6" {
		udpBind, rawBind = "::", "::"
	}

	conn, err := icmp.ListenPacket(udpNetwork, udpBind)
	if err == nil {
		return conn, false, nil
	}

	rawConn, rawErr := icmp.ListenPacket(rawNetwork, rawBind)
	if rawErr != nil {
		return nil, false, fmt.Errorf("udp: %v, raw: %w", err, rawErr)
	}
	return rawConn, true, nil
}

func sendEcho(conn *icmp.PacketConn, isRaw bool, proto int, echoType icmp.Type, dst *net.IPAddr, id, seq int, deadline time.Time) (int64, error) {
	var writeAddr net.Addr = &net.UDPAddr{IP: dst.IP, Zone: dst.Zone}
	if isRaw {
		writeAddr = &net.IPAddr{IP: dst.IP, Zone: dst.Zone}
	}

	msg := icmp.Message{
		Type: echoType,
		Code: 0,
		Body: &icmp.Echo{ID: id, Seq: seq, Data: []byte("openstatus")},
	}
	wb, err := msg.Marshal(nil)
	if err != nil {
		return 0, fmt.Errorf("marshal error: %w", err)
	}

	if err := conn.SetDeadline(deadline); err != nil {
		return 0, err
	}

	start := time.Now()
	if _, err := conn.WriteTo(wb, writeAddr); err != nil {
		return 0, fmt.Errorf("write error: %w", err)
	}

	rb := make([]byte, 1500)
	for {
		n, _, err := conn.ReadFrom(rb)
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				return 0, fmt.Errorf("timeout")
			}
			return 0, fmt.Errorf("read error: %w", err)
		}

		rm, err := icmp.ParseMessage(proto, rb[:n])
		if err != nil {
			continue
		}

		switch body := rm.Body.(type) {
		case *icmp.Echo:
			// The kernel rewrites the Echo ID on datagram sockets, so only raw
			// sockets can trust it; datagram replies are matched on Seq alone.
			if body.Seq != seq || (isRaw && body.ID != id) {
				continue
			}
			return time.Since(start).Milliseconds(), nil
		case *icmp.DstUnreach:
			return 0, fmt.Errorf("destination unreachable")
		case *icmp.TimeExceeded:
			return 0, fmt.Errorf("time exceeded")
		}
	}
}
