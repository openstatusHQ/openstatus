package checker_test

import (
	"testing"

	"github.com/openstatushq/openstatus/apps/checker"
)

func TestPingTcp(t *testing.T) {
	type args struct {
		url     string
		timeout int
	}
	tests := []struct {
		name    string
		args    args
		want    checker.TCPResponseTiming
		wantErr bool
	}{
		{name: "will failed", args: args{url: "error", timeout: 60}, wantErr: true},
		{name: "will be ok", args: args{url: "openstat.us:443", timeout: 60}, wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := checker.PingTcp(tt.args.timeout, tt.args.url)
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
