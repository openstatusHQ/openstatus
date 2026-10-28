package checker

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"syscall"
	"testing"

	"github.com/stretchr/testify/assert"
)

type timeoutError struct{}

func (timeoutError) Error() string   { return "i/o timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

func urlError(err error) error {
	return &url.Error{Op: "Get", URL: "https://example.com", Err: err}
}

func TestHTTPErrorMessage(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "timeout",
			err:  urlError(timeoutError{}),
			want: "Timeout after 1200 ms",
		},
		{
			name: "dns not found hides the resolver address",
			err: urlError(&net.OpError{Op: "dial", Net: "tcp", Err: &net.DNSError{
				Err: "no such host", Name: "api.acme.dev", Server: "[fdaa::3]:53", IsNotFound: true,
			}}),
			want: "DNS lookup failed for api.acme.dev: no such host",
		},
		{
			name: "dns servfail",
			err: urlError(&net.OpError{Op: "dial", Net: "tcp", Err: &net.DNSError{
				Err: "server misbehaving", Name: "set.id", Server: "[fdaa::3]:53",
			}}),
			want: "DNS lookup failed for set.id: server misbehaving",
		},
		{
			name: "remote tls alert",
			err:  urlError(&net.OpError{Op: "remote error", Err: errors.New("tls: handshake failure")}),
			want: "TLS handshake failed: tls: handshake failure",
		},
		{
			name: "certificate verification",
			err:  urlError(&tls.CertificateVerificationError{Err: x509.UnknownAuthorityError{}}),
			want: "TLS certificate verification failed: x509: certificate signed by unknown authority",
		},
		{
			name: "connection refused",
			err: urlError(&net.OpError{Op: "dial", Net: "tcp", Err: &os.SyscallError{
				Syscall: "connect", Err: syscall.ECONNREFUSED,
			}}),
			want: "Connection refused",
		},
		{
			name: "connection reset",
			err: urlError(&net.OpError{Op: "read", Net: "tcp", Err: &os.SyscallError{
				Syscall: "read", Err: syscall.ECONNRESET,
			}}),
			want: "Connection reset by peer",
		},
		{
			name: "server closed the connection",
			err:  urlError(io.EOF),
			want: "Connection closed by server before a response was received",
		},
		{
			name: "anything else drops the method and url prefix",
			err:  urlError(errors.New("stopped after 10 redirects")),
			want: "stopped after 10 redirects",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, httpErrorMessage(tt.err, 1200))
		})
	}
}

// A monitor without a timeout must still be bounded: a zero timeout on the
// dialer and TLS handshake means no limit at all.
func TestNewHTTPClientZeroTimeoutFallsBack(t *testing.T) {
	client := NewHTTPClient(0, true)

	assert.Equal(t, defaultHTTPTimeout, client.Timeout)

	transport, ok := client.Transport.(*http.Transport)
	assert.True(t, ok)
	assert.Equal(t, defaultHTTPTimeout, transport.TLSHandshakeTimeout)
	assert.True(t, transport.DisableKeepAlives)
}

func TestTimingClearIncompletePhases(t *testing.T) {
	// Timeout after the TLS handshake: first byte never arrived.
	timing := Timing{
		DnsStart: 1000, DnsDone: 1001,
		ConnectStart: 1001, ConnectDone: 1003,
		TlsHandshakeStart: 1003, TlsHandshakeDone: 1017,
		FirstByteStart: 1017,
	}

	timing.clearIncompletePhases()

	assert.Equal(t, Timing{
		DnsStart: 1000, DnsDone: 1001,
		ConnectStart: 1001, ConnectDone: 1003,
		TlsHandshakeStart: 1003, TlsHandshakeDone: 1017,
	}, timing)
}
