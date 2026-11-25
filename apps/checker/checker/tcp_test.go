package checker_test

import (
	"context"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/checker"
)

func TestPingTcp(t *testing.T) {
	type args struct {
		url     string
		timeout int64
	}
	tests := []struct {
		name    string
		args    args
		want    checker.TCPResponseTiming
		wantErr bool
	}{
		{name: "will failed", args: args{url: "error", timeout: 5000}, wantErr: true},
		{name: "will be ok", args: args{url: "openstat.us:443", timeout: 5000}, wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := checker.PingTCP(context.Background(), tt.args.timeout, tt.args.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("PingTcp() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got.TCPStart == 0 && tt.wantErr == false {
				t.Errorf("PingTcp() = %v", got)
				return
			}
			if got.TCPDone == 0 && tt.wantErr == false {
				t.Errorf("PingTcp() = %v", got)
				return
			}

		})
	}
}

func TestPingTcpTimeoutIsMilliseconds(t *testing.T) {
	// 192.0.2.0/24 (TEST-NET-1) is never routed, so the dial hangs until the timeout.
	start := time.Now()
	_, err := checker.PingTCP(context.Background(), 500, "192.0.2.1:80")
	if err == nil {
		t.Fatal("PingTCP() expected an error dialing TEST-NET-1")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("PingTCP() took %s, a 500ms timeout was read as seconds", elapsed)
	}
}

func TestPingTcpStopsWhenContextEnds(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	start := time.Now()
	if _, err := checker.PingTCP(ctx, 60_000, "192.0.2.1:80"); err == nil {
		t.Fatal("PingTCP() expected an error once the context ended")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("PingTCP() ignored the context, took %s", elapsed)
	}
}
