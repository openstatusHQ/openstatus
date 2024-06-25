package tinybird_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
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

		client := tinybird.NewClient(interceptor.GetHTTPClient(), "apiKey")

		err := client.SendEvent(ctx, "event", "test")
		require.Error(t, err)
	})

	t.Run("it should return an error if the response status code is not 200", func(t *testing.T) {
		interceptor := &interceptorHTTPClient{
			f: func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusInternalServerError,
				}, nil
			},
		}

		client := tinybird.NewClient(interceptor.GetHTTPClient(), "apiKey")

		err := client.SendEvent(ctx, "event", "test")
		require.Error(t, err)
	})

	t.Run("it should succeed and return nothing", func(t *testing.T) {
		var url string
		interceptor := &interceptorHTTPClient{
			f: func(req *http.Request) (*http.Response, error) {
				url = req.URL.String()
				return &http.Response{
					StatusCode: http.StatusAccepted,
				}, nil
			},
		}

		client := tinybird.NewClient(interceptor.GetHTTPClient(), "apiKey")

		err := client.SendEvent(ctx, "event", "test")
		require.NoError(t, err)
		require.Equal(t, "https://api.tinybird.co/v0/events?name=test", url)
	})
}
