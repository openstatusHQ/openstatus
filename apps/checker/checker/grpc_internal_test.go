package checker

import (
	"errors"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestParseGRPCTLSMode(t *testing.T) {
	cases := map[string]GRPCTLSMode{
		"plaintext":    GRPCTLSModePlaintext,
		"tls_insecure": GRPCTLSModeTLSInsecure,
		"tls":          GRPCTLSModeTLS,
		"":             GRPCTLSModeTLS,
		"nonsense":     GRPCTLSModeTLS,
	}

	for input, want := range cases {
		if got := ParseGRPCTLSMode(input); got != want {
			t.Errorf("ParseGRPCTLSMode(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestGRPCTransportMessageNeverEchoesTheRawError(t *testing.T) {
	cases := []struct {
		name string
		code codes.Code
		err  error
		want string
	}{
		{
			name: "certificate",
			code: codes.Unavailable,
			err:  status.Error(codes.Unavailable, `x509: certificate signed by unknown authority (subject CN=internal-billing)`),
			want: "certificate verification failed",
		},
		{
			name: "tls record",
			code: codes.Unavailable,
			err:  status.Error(codes.Unavailable, `tls: first record does not look like a TLS handshake`),
			want: "certificate verification failed",
		},
		{
			name: "refused",
			code: codes.Unavailable,
			err:  status.Error(codes.Unavailable, "connection error: connection refused"),
			want: "connection refused",
		},
		{
			name: "resolve",
			code: codes.Unavailable,
			err:  status.Error(codes.Unavailable, `lookup nope.invalid: no such host`),
			want: "resolve error",
		},
		{
			name: "deadline",
			code: codes.DeadlineExceeded,
			err:  status.Error(codes.DeadlineExceeded, "context deadline exceeded"),
			want: "timeout after 1500 ms",
		},
		{
			name: "other",
			code: codes.Internal,
			err:  errors.New("boom"),
			want: "grpc check failed with code Internal",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := grpcTransportMessage(tc.code, tc.err, 1500)
			if got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
			if got == tc.err.Error() {
				t.Fatal("the raw error must never be returned verbatim")
			}
		})
	}
}

func TestGRPCUnknownServiceMessage(t *testing.T) {
	if got := grpcUnknownServiceMessage(""); got != "server does not know the requested service" {
		t.Fatalf("unexpected message %q", got)
	}
	if got := grpcUnknownServiceMessage("pkg.Svc"); got != `server does not know service "pkg.Svc"` {
		t.Fatalf("unexpected message %q", got)
	}
}

func TestGRPCTimerIsSafeForConcurrentPhases(t *testing.T) {
	timer := &grpcTimer{}

	done := make(chan struct{})
	go func() {
		timer.set(func(t *GRPCResponseTiming) { t.DnsStart = 1 })
		close(done)
	}()
	timer.set(func(t *GRPCResponseTiming) { t.ConnectStart = 2 })
	<-done

	snapshot := timer.snapshot()
	if snapshot.DnsStart != 1 || snapshot.ConnectStart != 2 {
		t.Fatalf("unexpected snapshot %+v", snapshot)
	}
}
