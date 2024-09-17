package checker_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

// RoundTripFunc .
type RoundTripFunc func(req *http.Request) *http.Response

// RoundTrip .
func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

// NewTestClient returns *http.Client with Transport replaced to avoid making real calls
func NewTestClient(fn RoundTripFunc) *http.Client {
	return &http.Client{
		Transport: RoundTripFunc(fn),
	}
}

func Test_ping(t *testing.T) {

	type args struct {
		client    *http.Client
		inputData request.HttpCheckerRequest
	}
	tests := []struct {
		name    string
		args    args
		want    checker.Response
		wantErr bool
	}{
		{name: "200", args: args{client: NewTestClient(func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewBufferString(`OK`)),
				Header:     make(http.Header),
			}
		}), inputData: request.HttpCheckerRequest{URL: "https://openstat.us", CronTimestamp: 1, Headers: []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}{{Key: "", Value: ""}}}}, want: checker.Response{Status: 200, Body: "OK"}, wantErr: false},

		{name: "200 with headers", args: args{client: NewTestClient(func(req *http.Request) *http.Response {
			assert.Equal(t, "Value", req.Header.Get("Test"))
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewBufferString(`OK`)),
				Header:     make(http.Header),
			}
		}), inputData: request.HttpCheckerRequest{URL: "https://openstat.us", CronTimestamp: 1, Headers: []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}{{Key: "Test", Value: "Value"}}}}, want: checker.Response{Status: 200, Body: "OK"}, wantErr: false},

		{name: "500", args: args{client: NewTestClient(func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Body:       io.NopCloser(bytes.NewBufferString(`OK`)),
				Header:     make(http.Header),
			}
		}), inputData: request.HttpCheckerRequest{URL: "https://openstat.us/500", CronTimestamp: 1}},
			want: checker.Response{Status: 500, Body: "OK"}, wantErr: false},

		{name: "Wrong url should return an error", args: args{client: &http.Client{}, inputData: request.HttpCheckerRequest{URL: "https://somethingthatwillfail.ed", CronTimestamp: 1}},
			want: checker.Response{Status: 0}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := checker.Http(context.Background(), tt.args.client, tt.args.inputData)

			if (err != nil) != tt.wantErr {
				t.Errorf("Ping() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if got.Status != tt.want.Status {
				t.Errorf("Ping() = %v, want %v", got, tt.want)
			}

			if got.Body != tt.want.Body {
				t.Errorf("Ping() = %v, want %v", got, tt.want)
			}
		})
	}
}
