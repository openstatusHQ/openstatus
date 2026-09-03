package checker

import (
	"fmt"
	"net"
	"os"
	"sync/atomic"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
	"golang.org/x/net/ipv6"
)

// icmpEchoCounter hands each probe its own echo identifier. A raw socket
// receives every ICMP packet delivered to the host, so probes are told apart by
// the echo id alone; a per-process value (the pid) makes two concurrent probes
// to the same target indistinguishable. Seeded from the pid so a restart does
// not immediately reuse the ids of packets still in flight.
var icmpEchoCounter = func() *atomic.Uint32 {
	var c atomic.Uint32
	c.Store(uint32(os.Getpid()))
	return &c
}()

func nextEchoID() int {
	return int(icmpEchoCounter.Add(1) & 0xffff)
}

const (
	icmpPacketCount    = 3
	icmpPacketInterval = 100 * time.Millisecond
	// Applied when a caller omits the timeout. Without it the deadline below
	// lands in the past, the send loop breaks before the first packet, and the
	// check reports "no reply" having probed nothing.
	icmpDefaultTimeout = 45_000
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
	if timeoutMs <= 0 {
		timeoutMs = icmpDefaultTimeout
	}

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
	id := nextEchoID()

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
		n, peer, err := conn.ReadFrom(rb)
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
			// A reply to our probe can only come from the target. A raw socket
			// is not demultiplexed the way the datagram path is, so without
			// this it also sees replies belonging to other probes.
			if !addrIP(peer).Equal(dst.IP) {
				continue
			}
			// The kernel rewrites the Echo ID on datagram sockets, so only raw
			// sockets can trust it; datagram replies are matched on Seq alone.
			if body.Seq != seq || (isRaw && body.ID != id) {
				continue
			}
			return time.Since(start).Milliseconds(), nil
		case *icmp.DstUnreach:
			// Errors come from whichever hop rejected the packet, not from the
			// target, so the peer says nothing about ownership — the quoted
			// datagram does.
			if !provokedByProbe(body.Data, proto, id, seq, isRaw) {
				continue
			}
			return 0, fmt.Errorf("destination unreachable")
		case *icmp.TimeExceeded:
			if !provokedByProbe(body.Data, proto, id, seq, isRaw) {
				continue
			}
			return 0, fmt.Errorf("time exceeded")
		}
	}
}

// addrIP pulls the IP out of the address shape each socket type reports:
// *net.IPAddr for raw, *net.UDPAddr for the unprivileged datagram path.
func addrIP(addr net.Addr) net.IP {
	switch a := addr.(type) {
	case *net.IPAddr:
		return a.IP
	case *net.UDPAddr:
		return a.IP
	}
	return nil
}

// provokedByProbe reports whether an ICMP error quotes the packet we sent. The
// error carries the original datagram — IP header plus at least its first eight
// bytes, which is the whole echo header — so the quoted id and sequence
// identify the sender. Without this a raw socket would treat an unrelated
// flow's "destination unreachable" as its own probe failing.
func provokedByProbe(data []byte, proto, id, seq int, isRaw bool) bool {
	var quoted []byte
	switch proto {
	case ipv4.ICMPTypeEcho.Protocol():
		h, err := icmp.ParseIPv4Header(data)
		if err != nil || len(data) < h.Len {
			return false
		}
		quoted = data[h.Len:]
	default:
		if len(data) < ipv6.HeaderLen {
			return false
		}
		quoted = data[ipv6.HeaderLen:]
	}

	msg, err := icmp.ParseMessage(proto, quoted)
	if err != nil {
		return false
	}
	echo, ok := msg.Body.(*icmp.Echo)
	if !ok {
		return false
	}
	// Same asymmetry as the echo path: the kernel owns the id on datagram
	// sockets, so only raw probes can match on it.
	return echo.Seq == seq && (!isRaw || echo.ID == id)
}
