package checker_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/stretchr/testify/require"
)

type interceptorHTTPClient struct {
	f func(req *http.Request) (*http.Response, error)
}

func (i *interceptorHTTPClient) RoundTrip(req *http.Request) (*http.Response, error) {
	return i.f(req)
}

func (i *interceptorHTTPClient) GetHTTPClient() *http.Client {
	return &http.Client{
		Transport: i,
	}
}

func TestSendEvent(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	t.Run("it should return an error if it can not send the event", func(t *testing.T) {
		interceptor := &interceptorHTTPClient{
			f: func(req *http.Request) (*http.Response, error) {
				return nil, fmt.Errorf("unable to send request")
			},
		}

		client := checker.NewClient(interceptor.GetHTTPClient())

		err := client.UpdateStatus(ctx, checker.UpdateData{
			Region: "local",
			Status: "up",
		})
		require.Error(t, err)
	})

	var url string

	interceptor := &interceptorHTTPClient{
		f: func(req *http.Request) (*http.Response, error) {
			url = req.URL.String()
			return &http.Response{
				StatusCode: http.StatusAccepted,
			}, nil
		},
	}

	client := checker.NewClient(interceptor.GetHTTPClient())

	err := client.UpdateStatus(ctx, checker.UpdateData{
		Region: "local",
		Status: "up",
	})
	require.NoError(t, err)
	require.Equal(t, "https://openstatus-api.fly.dev/updateStatus", url)

}
