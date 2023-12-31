package checker

import (
	"net/http"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/request"
)

func Test_ping(t *testing.T) {
	type args struct {
		client    *http.Client
		inputData request.CheckerRequest
	}
	tests := []struct {
		name    string
		args    args
		want    PingData
		wantErr bool
	}{
		{name: "200", args: args{client: &http.Client{}, inputData: request.CheckerRequest{URL: "https://openstat.us", CronTimestamp: 1}}, want: PingData{URL: "https://openstat.us", StatusCode: 200}, wantErr: false},
		{name: "500", args: args{client: &http.Client{}, inputData: request.CheckerRequest{URL: "https://openstat.us/500", CronTimestamp: 1}}, want: PingData{URL: "https://openstat.us/500", StatusCode: 500}, wantErr: false},
		{name: "500", args: args{client: &http.Client{}, inputData: request.CheckerRequest{URL: "https://somethingthatwillfail.ed", CronTimestamp: 1}}, want: PingData{URL: "https://openstat.us/500", StatusCode: 0}, wantErr: true},

		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Ping(tt.args.client, tt.args.inputData)

			if (err != nil) != tt.wantErr {
				t.Errorf("Ping() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got.StatusCode != tt.want.StatusCode {
				t.Errorf("Ping() = %v, want %v", got, tt.want)
			}
		})
	}
}
