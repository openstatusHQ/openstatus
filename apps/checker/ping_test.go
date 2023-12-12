package main

import (
	"net/http"
	"testing"
)

func Test_ping(t *testing.T) {
	type args struct {
		client    *http.Client
		inputData InputData
	}
	tests := []struct {
		name    string
		args    args
		want    PingData
		wantErr bool
	}{
		{name: "200", args: args{client: &http.Client{}, inputData: InputData{Url: "https://openstat.us", CronTimestamp: 1}}, want: PingData{Url: "https://openstat.us", StatusCode: 200}, wantErr: false},
		{name: "500", args: args{client: &http.Client{}, inputData: InputData{Url: "https://openstat.us/500", CronTimestamp: 1}}, want: PingData{Url: "https://openstat.us/500", StatusCode: 500}, wantErr: false},
		{name: "500", args: args{client: &http.Client{}, inputData: InputData{Url: "https://somethingthatwillfail.ed", CronTimestamp: 1}}, want: PingData{Url: "https://openstat.us/500", StatusCode: 0}, wantErr: true},

		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ping(tt.args.client, tt.args.inputData)

			if (err != nil) != tt.wantErr {
				t.Errorf("ping() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got.StatusCode != tt.want.StatusCode {
				t.Errorf("ping() = %v, want %v", got, tt.want)
			}
		})
	}
}
