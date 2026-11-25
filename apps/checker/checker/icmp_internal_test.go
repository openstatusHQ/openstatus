package checker

import (
	"net"
	"sync"
	"testing"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
	"golang.org/x/net/ipv6"
)

func TestNextEchoID_DistinguishesConcurrentProbes(t *testing.T) {
	// A raw socket tells probes apart by echo id alone, so two probes running
	// at once must never share one — a per-process id (the pid) did.
	const n = 512

	var wg sync.WaitGroup
	ids := make([]int, n)
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ids[i] = nextEchoID()
		}()
	}
	wg.Wait()

	seen := make(map[int]struct{}, n)
	for _, id := range ids {
		if _, dup := seen[id]; dup {
			t.Fatalf("nextEchoID() handed out %d twice across %d concurrent probes", id, n)
		}
		seen[id] = struct{}{}
		if id < 0 || id > 0xffff {
			t.Errorf("nextEchoID() = %d, outside the 16-bit echo id field", id)
		}
	}
}

func TestAddrIP(t *testing.T) {
	ip := net.ParseIP("192.0.2.7")

	for _, tc := range []struct {
		name string
		addr net.Addr
		want net.IP
	}{
		{name: "raw socket", addr: &net.IPAddr{IP: ip}, want: ip},
		{name: "datagram socket", addr: &net.UDPAddr{IP: ip}, want: ip},
		{name: "unknown shape", addr: &net.TCPAddr{IP: ip}, want: nil},
		{name: "nil", addr: nil, want: nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := addrIP(tc.addr)
			if !got.Equal(tc.want) {
				t.Errorf("addrIP() = %v, want %v", got, tc.want)
			}
			// An unrecognised address must never be mistaken for the target.
			if tc.want == nil && got.Equal(ip) {
				t.Error("addrIP() matched the target for an address it cannot read")
			}
		})
	}
}

// quotedError builds the payload an ICMP error carries: the original IP header
// followed by the datagram that provoked it.
func quotedError(t *testing.T, v4 bool, id, seq int) []byte {
	t.Helper()

	echoType := icmp.Type(ipv4.ICMPTypeEcho)
	if !v4 {
		echoType = ipv6.ICMPTypeEchoRequest
	}
	echo, err := (&icmp.Message{
		Type: echoType,
		Body: &icmp.Echo{ID: id, Seq: seq, Data: []byte("openstatus")},
	}).Marshal(nil)
	if err != nil {
		t.Fatalf("marshal echo: %v", err)
	}

	if v4 {
		// Minimal 20-byte IPv4 header; only the length nibble is read back.
		header := make([]byte, 20)
		header[0] = 0x45
		return append(header, echo...)
	}
	return append(make([]byte, ipv6.HeaderLen), echo...)
}

func TestProvokedByProbe(t *testing.T) {
	const (
		v4proto = 1 // ipv4.ICMPTypeEcho.Protocol()
		id      = 4242
		seq     = 1
	)

	t.Run("accepts the error quoting our own probe", func(t *testing.T) {
		data := quotedError(t, true, id, seq)
		if !provokedByProbe(data, v4proto, id, seq, true) {
			t.Error("provokedByProbe() rejected an error quoting this probe")
		}
	})

	t.Run("rejects another probe's error on the raw path", func(t *testing.T) {
		// The cross-talk case: same sequence (0/1/2 are always reused), a
		// different probe's id. A raw socket sees this packet too.
		data := quotedError(t, true, id+1, seq)
		if provokedByProbe(data, v4proto, id, seq, true) {
			t.Error("provokedByProbe() accepted an error belonging to another probe")
		}
	})

	t.Run("rejects a different sequence", func(t *testing.T) {
		data := quotedError(t, true, id, seq+1)
		if provokedByProbe(data, v4proto, id, seq, true) {
			t.Error("provokedByProbe() accepted an error for a different packet")
		}
	})

	t.Run("ignores the id on the datagram path", func(t *testing.T) {
		// The kernel rewrites the id on datagram sockets, so the quoted value
		// is not ours — but that socket is demultiplexed, so seq is enough.
		data := quotedError(t, true, id+1, seq)
		if !provokedByProbe(data, v4proto, id, seq, false) {
			t.Error("provokedByProbe() matched on an id the kernel owns")
		}
	})

	t.Run("rejects a truncated or unparsable quote", func(t *testing.T) {
		for _, data := range [][]byte{nil, {}, {0x45}, make([]byte, 20)} {
			if provokedByProbe(data, v4proto, id, seq, true) {
				t.Errorf("provokedByProbe() accepted an unusable quote %v", data)
			}
		}
	})

	t.Run("handles ipv6", func(t *testing.T) {
		const v6proto = 58 // ipv6.ICMPTypeEchoRequest.Protocol()
		if !provokedByProbe(quotedError(t, false, id, seq), v6proto, id, seq, true) {
			t.Error("provokedByProbe() rejected a v6 error quoting this probe")
		}
		if provokedByProbe(quotedError(t, false, id+1, seq), v6proto, id, seq, true) {
			t.Error("provokedByProbe() accepted another v6 probe's error")
		}
	})
}
